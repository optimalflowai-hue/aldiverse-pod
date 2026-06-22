import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper to verify authenticated team member
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

// PUT: Update a client's settings (encrypting keys if provided)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      lulu_client_key,
      lulu_client_secret,
      lulu_environment,
      stripe_secret_key,
      stripe_webhook_secret,
    } = body;

    const updates: any = {};

    if (name !== undefined) updates.name = name.trim();
    if (lulu_environment !== undefined) {
      if (!['sandbox', 'production'].includes(lulu_environment)) {
        return NextResponse.json({ error: 'Invalid environment' }, { status: 400 });
      }
      updates.lulu_environment = lulu_environment;
    }

    // Encrypt sensitive keys on-the-fly before storing
    if (lulu_client_key) updates.lulu_client_key = encrypt(lulu_client_key.trim());
    if (lulu_client_secret) updates.lulu_client_secret = encrypt(lulu_client_secret.trim());
    if (stripe_secret_key) updates.stripe_secret_key = encrypt(stripe_secret_key.trim());
    if (stripe_webhook_secret) updates.stripe_webhook_secret = encrypt(stripe_webhook_secret.trim());

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid update parameters provided' }, { status: 400 });
    }

    const { data: tenant, error } = await supabaseServer
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select('id, name, slug, lulu_environment, stripe_secret_key, stripe_webhook_secret, lulu_client_key, lulu_client_secret')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return indicator statuses instead of raw or encrypted keys
    const formattedClient = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      lulu_environment: tenant.lulu_environment,
      stripe_connected: !!tenant.stripe_secret_key,
      stripe_webhook_connected: !!tenant.stripe_webhook_secret,
      lulu_connected: !!tenant.lulu_client_key && !!tenant.lulu_client_secret,
    };

    return NextResponse.json({ client: formattedClient });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove a client (tenant)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { error } = await supabaseServer
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Client deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
