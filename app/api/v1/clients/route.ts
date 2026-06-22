import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
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

// GET: List all clients (tenants) without sensitive keys
export async function GET(request: NextRequest) {
  const user = await verifyUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: tenants, error } = await supabaseServer
      .from('tenants')
      .select('id, name, slug, lulu_environment, stripe_secret_key, stripe_webhook_secret, lulu_client_key, lulu_client_secret, created_at');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to include connection indicators instead of leaking secrets
    const formattedClients = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      lulu_environment: tenant.lulu_environment,
      stripe_connected: !!tenant.stripe_secret_key,
      stripe_webhook_connected: !!tenant.stripe_webhook_secret,
      lulu_connected: !!tenant.lulu_client_key && !!tenant.lulu_client_secret,
      created_at: tenant.created_at,
    }));

    return NextResponse.json({ clients: formattedClients });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create a new client (tenant)
export async function POST(request: NextRequest) {
  const user = await verifyUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json({ error: 'Missing client name or slug' }, { status: 400 });
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!cleanSlug) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }

    // Insert new client
    const { data: newTenant, error } = await supabaseServer
      .from('tenants')
      .insert({
        name: name.trim(),
        slug: cleanSlug,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ client: newTenant });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
