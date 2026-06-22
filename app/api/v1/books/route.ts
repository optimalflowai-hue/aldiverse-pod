import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenant');

    if (!tenantSlug) {
      return NextResponse.json(
        { error: 'Missing required query parameter: tenant' },
        { status: 400 }
      );
    }

    // 1. Resolve tenant ID from slug
    const { data: tenant, error: tenantError } = await supabaseServer
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug.toLowerCase())
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: `Tenant not found for slug: ${tenantSlug}` },
        { status: 404 }
      );
    }

    // 2. Fetch active books for this tenant
    const { data: books, error: booksError } = await supabaseServer
      .from('books')
      .select('id, title, description, price, pod_package_id, is_active')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);

    if (booksError) {
      console.error('Database error fetching books:', booksError);
      return NextResponse.json(
        { error: 'Failed to retrieve book catalog' },
        { status: 500 }
      );
    }

    return NextResponse.json({ books });
  } catch (err: any) {
    console.error('Unhandled error in catalog API:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
