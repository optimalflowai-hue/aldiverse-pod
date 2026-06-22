import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, bookId, quantity = 1, successUrl, cancelUrl } = body;

    // 1. Validation
    if (!tenantSlug || !bookId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantSlug, bookId, successUrl, cancelUrl' },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: 'Quantity must be at least 1' },
        { status: 400 }
      );
    }

    // 2. Fetch tenant config & secrets
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

    if (!tenant.stripe_secret_key) {
      return NextResponse.json(
        { error: 'Stripe keys are not configured for this tenant' },
        { status: 500 }
      );
    }

    // 3. Fetch book details
    const { data: book, error: bookError } = await supabaseServer
      .from('books')
      .select('*')
      .eq('id', bookId)
      .eq('tenant_id', tenant.id)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        { error: `Book not found or does not belong to tenant: ${bookId}` },
        { status: 404 }
      );
    }

    if (!book.is_active) {
      return NextResponse.json(
        { error: 'Book catalog entry is not currently active' },
        { status: 400 }
      );
    }

    // 4. Decrypt tenant's Stripe secret key
    let decryptedStripeKey: string;
    try {
      decryptedStripeKey = decrypt(tenant.stripe_secret_key);
    } catch (err) {
      console.error('Failed to decrypt tenant Stripe key:', err);
      return NextResponse.json(
        { error: 'Stripe credentials decrytion failure' },
        { status: 500 }
      );
    }

    // 5. Initialize Stripe with decrypted key
    const stripe = new Stripe(decryptedStripeKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });

    // 6. Create Stripe Checkout Session
    // Convert price to cents (Stripe expects integer cents)
    const unitAmountCents = Math.round(Number(book.price) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: book.title,
              description: book.description || undefined,
            },
            unit_amount: unitAmountCents,
          },
          quantity: quantity,
        },
      ],
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU'], // Standard supported delivery domains
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenant_id: tenant.id,
        book_id: book.id,
        quantity: quantity.toString(),
        tenant_slug: tenant.slug,
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error('Checkout API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
