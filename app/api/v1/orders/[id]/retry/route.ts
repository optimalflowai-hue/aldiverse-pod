import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Verify authenticated team member
async function verifyUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) return null;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error } = await userClient.auth.getUser(token);

    if (error || !user) return null;

    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role, deleted_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.deleted_at) {
      return null;
    }

    return user;
  } catch (err) {
    return null;
  }
}

// POST: Retry sending order to Lulu Print API
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orderId } = await params;

  try {
    // 1. Fetch order details with book and tenant details using service role
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select(`
        *,
        books ( title, interior_pdf_url, cover_pdf_url, pod_package_id ),
        tenants ( lulu_client_key, lulu_client_secret, lulu_environment )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.lulu_job_id) {
      return NextResponse.json({ error: 'Order has already been submitted to Lulu' }, { status: 400 });
    }

    const tenant = order.tenants;
    const book = order.books;

    if (!tenant.lulu_client_key || !tenant.lulu_client_secret) {
      return NextResponse.json({ error: 'Lulu API credentials are not configured for this client' }, { status: 400 });
    }

    // 2. Decrypt credentials
    const luluKey = decrypt(tenant.lulu_client_key);
    const luluSecret = decrypt(tenant.lulu_client_secret);
    const env = tenant.lulu_environment;

    const authUrl = env === 'production' 
      ? 'https://api.lulu.com/auth/realms/glasstree/protocol/openid-connect/token' 
      : 'https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token';

    const apiUrl = env === 'production'
      ? 'https://api.lulu.com/print-jobs/'
      : 'https://api.sandbox.lulu.com/print-jobs/';

    // 3. Authenticate with Lulu
    const authString = Buffer.from(`${luluKey}:${luluSecret}`).toString('base64');
    const tokenRes = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return NextResponse.json({ error: `Lulu authentication failed: ${errText}` }, { status: 500 });
    }

    const { access_token } = await tokenRes.json();

    // 4. Map and dispatch the print job payload
    const jobPayload = {
      contact_email: order.customer_email,
      external_id: order.id,
      line_items: [
        {
          title: book.title,
          cover_pdf: book.cover_pdf_url,
          interior_pdf: book.interior_pdf_url,
          pod_package_id: book.pod_package_id,
          quantity: order.quantity
        }
      ],
      shipping_address: order.shipping_address,
      shipping_level: 'MAIL' // Standard mail fulfillment
    };

    const dispatchRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify(jobPayload)
    });

    const dispatchData = await dispatchRes.json();

    if (!dispatchRes.ok) {
      return NextResponse.json({ 
        error: `Lulu Job Dispatch failed: ${dispatchData?.error?.message || dispatchRes.statusText}` 
      }, { status: 500 });
    }

    const luluJobId = dispatchData.id;
    const luluStatus = dispatchData.status?.name || 'Placed';

    // 5. Update order status in the database
    const { data: updatedOrder, error: updateError } = await supabaseServer
      .from('orders')
      .update({
        lulu_job_id: String(luluJobId),
        lulu_status: luluStatus,
        status: 'submitted_to_lulu'
      })
      .eq('id', orderId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: `Failed to update database record: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Order successfully submitted to Lulu', 
      order: updatedOrder 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
