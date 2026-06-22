import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper to authenticate request and verify superadmin role
async function checkSuperadmin(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) return null;

    // Verify token identity using anonymous client
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error } = await userClient.auth.getUser(token);

    if (error || !user) return null;

    // Check role in profiles using server service-role client
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role, deleted_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'superadmin' || profile.deleted_at) {
      return null;
    }

    return user;
  } catch (err) {
    console.error('Superadmin verification exception:', err);
    return null;
  }
}

// GET: Retrieve all profiles
export async function GET(request: NextRequest) {
  const adminUser = await checkSuperadmin(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized. Superadmin role required.' }, { status: 403 });
  }

  try {
    // Select all profiles ordered by role and created date
    const { data: profiles, error } = await supabaseServer
      .from('profiles')
      .select('*')
      .order('role', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Register a new in-house team member
export async function POST(request: NextRequest) {
  const adminUser = await checkSuperadmin(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized. Superadmin role required.' }, { status: 403 });
  }

  try {
    const { email, password, role } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing email, password, or role' }, { status: 400 });
    }

    if (!['superadmin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Call Supabase Auth Admin API to create user without verification delays
    const { data, error } = await supabaseServer.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Failed to create user' }, { status: 500 });
    }

    // Ensure the profile role and password match what was requested
    const profileUpdates: any = { password };
    if (role === 'superadmin') {
      profileUpdates.role = role;
    }

    const { error: updateError } = await supabaseServer
      .from('profiles')
      .update(profileUpdates)
      .eq('id', data.user.id);

    if (updateError) {
      console.error('Failed to update newly created user profile:', updateError);
    }

    // Fetch and return the fully initialized profile
    const { data: newProfile } = await supabaseServer
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return NextResponse.json({ profile: newProfile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
