import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import Stripe from 'stripe';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, bookId, quantity = 1, successUrl, cancelUrl } = body;

    if (!tenantSlug || !bookId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantSlug, bookId, successUrl, cancelUrl' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: 'Quantity must be at least 1' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { data: tenant, error: tenantError } = await supabaseServer
      .from('tenants')
      .select('*')
      .eq('slug', tenantSlug.toLowerCase())
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: `Tenant not found for slug: ${tenantSlug}` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (!tenant.stripe_secret_key) {
      return NextResponse.json(
        { error: 'Stripe keys are not configured for this tenant' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const { data: book, error: bookError } = await supabaseServer
      .from('books')
      .select('*')
      .eq('id', bookId)
      .eq('tenant_id', tenant.id)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        { error: `Book not found or does not belong to tenant: ${bookId}` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (!book.is_active) {
      return NextResponse.json(
        { error: 'Book catalog entry is not currently active' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let decryptedStripeKey: string;
    try {
      decryptedStripeKey = decrypt(tenant.stripe_secret_key);
    } catch (err) {
      console.error('Failed to decrypt tenant Stripe key:', err);
      return NextResponse.json(
        { error: 'Stripe credentials decryption failure' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const stripe = new Stripe(decryptedStripeKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });

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
        allowed_countries: ['US', 'CA', 'GB', 'AU'],
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

    return NextResponse.json(
      { url: session.url, sessionId: session.id },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('Checkout API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
