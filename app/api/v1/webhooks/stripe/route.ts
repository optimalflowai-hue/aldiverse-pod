import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { createPrintJob } from '@/lib/lulu';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get('tenant');

  if (!tenantSlug) {
    return NextResponse.json(
      { error: 'Missing tenant query parameter' },
      { status: 400 }
    );
  }

  // 1. Fetch tenant credentials
  const { data: tenant, error: tenantError } = await supabaseServer
    .from('tenants')
    .select('*')
    .eq('slug', tenantSlug.toLowerCase())
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json(
      { error: `Tenant not found for slug: ${tenantSlug}` },
      { status: 404 }
    );
  }

  if (!tenant.stripe_secret_key || !tenant.stripe_webhook_secret) {
    return NextResponse.json(
      { error: 'Stripe keys are not configured for this tenant' },
      { status: 500 }
    );
  }

  let decryptedStripeKey: string;
  let decryptedWebhookSecret: string;
  try {
    decryptedStripeKey = decrypt(tenant.stripe_secret_key);
    decryptedWebhookSecret = decrypt(tenant.stripe_webhook_secret);
  } catch (err) {
    console.error('Failed to decrypt credentials for webhook signature check:', err);
    return NextResponse.json(
      { error: 'Credential decryption failed' },
      { status: 500 }
    );
  }

  const stripe = new Stripe(decryptedStripeKey, {
    apiVersion: '2025-01-27.acacia' as any,
  });

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, decryptedWebhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // 2. Handle Stripe Webhook Event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const metadata = session.metadata;

    if (!metadata || !metadata.book_id || !metadata.quantity) {
      console.warn('Stripe checkout session completed but lacks book metadata:', session.id);
      return NextResponse.json({ received: true });
    }

    const bookId = metadata.book_id;
    const quantity = parseInt(metadata.quantity, 10);

    // 3. Fetch book details
    const { data: book, error: bookError } = await supabaseServer
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      console.error(`Book ${bookId} not found in DB for checkout session ${session.id}`);
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // 4. Construct shipping address to match Lulu format
    const shippingDetails = session.shipping_details;
    const customerEmail = session.customer_details?.email || 'unknown@example.com';
    const customerName = shippingDetails?.name || session.customer_details?.name || 'Customer';

    const shippingAddress = {
      name: customerName,
      street1: shippingDetails?.address?.line1 || '',
      street2: shippingDetails?.address?.line2 || undefined,
      city: shippingDetails?.address?.city || '',
      state_code: shippingDetails?.address?.state || '',
      country_code: shippingDetails?.address?.country || '',
      postcode: shippingDetails?.address?.postal_code || '',
      phone_number: session.customer_details?.phone || '000-000-0000', // Default if phone not collected
    };

    // 5. Create Order in DB in "paid" status
    let dbOrder;
    try {
      const { data: newOrder, error: insertError } = await supabaseServer
        .from('orders')
        .insert({
          tenant_id: tenant.id,
          book_id: book.id,
          stripe_session_id: session.id,
          customer_email: customerEmail,
          customer_name: customerName,
          quantity: quantity,
          amount_paid: Number(session.amount_total) / 100, // Cents to Dollars
          shipping_address: shippingAddress,
          status: 'paid',
        })
        .select()
        .single();

      if (insertError) {
        // If order already exists (due to Stripe duplicate delivery), return success 200
        if (insertError.code === '23505') {
          console.log(`Duplicate order caught for Stripe Session ID ${session.id}`);
          return NextResponse.json({ received: true, duplicate: true });
        }
        throw insertError;
      }
      dbOrder = newOrder;
    } catch (err: any) {
      console.error('Error inserting order to database:', err);
      return NextResponse.json({ error: 'Database order insert failed' }, { status: 500 });
    }

    // 6. Submit Print-Job to Lulu
    if (!tenant.lulu_client_key || !tenant.lulu_client_secret) {
      console.error(`Lulu keys not configured for tenant ${tenant.name}. Order stored as paid but not fulfilled.`);
      return NextResponse.json({ received: true, error: 'Lulu config missing' });
    }

    try {
      const decryptedLuluKey = decrypt(tenant.lulu_client_key);
      const decryptedLuluSecret = decrypt(tenant.lulu_client_secret);

      const luluConfig = {
        clientKey: decryptedLuluKey,
        clientSecret: decryptedLuluSecret,
        environment: tenant.lulu_environment || 'sandbox',
      };

      console.log(`Submitting print job to Lulu for order ${dbOrder.id}...`);

      const luluResult = await createPrintJob(luluConfig, {
        contact_email: tenant.contact_email || 'production@drpattimills.com',
        external_id: dbOrder.id, // Link Lulu job directly to our DB order primary key
        shipping_address: shippingAddress,
        shipping_level: 'MAIL',
        line_items: [
          {
            title: book.title,
            cover: book.cover_pdf_url,
            interior: book.interior_pdf_url,
            pod_package_id: book.pod_package_id,
            quantity: dbOrder.quantity,
          },
        ],
      });

      console.log(`Lulu Print Job successfully placed: ${luluResult.id} (Status: ${luluResult.status.name})`);

      // 7. Update database with Lulu tracking details
      const { error: updateError } = await supabaseServer
        .from('orders')
        .update({
          lulu_job_id: luluResult.id.toString(),
          status: 'submitted_to_lulu',
          lulu_status: luluResult.status.name,
        })
        .eq('id', dbOrder.id);

      if (updateError) {
        console.error(`Failed to update order ${dbOrder.id} with Lulu job ID:`, updateError);
      }
    } catch (luluErr: any) {
      console.error(`Lulu API fulfillment failed for order ${dbOrder.id}:`, luluErr.message);
      // We do NOT return a 500 error here. The order was successfully paid for and logged.
      // Keeping order status as 'paid' allows the dashboard team to manual retry.
    }
  }

  return NextResponse.json({ received: true });
}
