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

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error } = await userClient.auth.getUser(token);

    if (error || !user) return null;

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
    console.error('Superadmin check error:', err);
    return null;
  }
}

// PUT: Update a team member's details (username, password, role) or restore a soft-deleted account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await checkSuperadmin(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized. Superadmin role required.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { role, restore, username, password } = await request.json();

    const updates: any = {};
    if (role && ['superadmin', 'member'].includes(role)) {
      updates.role = role;
    }
    if (restore === true) {
      updates.deleted_at = null;
      
      // Also unban/enable the user in Supabase auth
      await supabaseServer.auth.admin.updateUserById(id, {
        ban_duration: 'none'
      });
    }

    if (username || password) {
      const authUpdates: any = {};
      if (username) {
        const finalEmail = username.trim().includes('@')
          ? username.trim()
          : `${username.trim().toLowerCase()}@aldiverse.com`;
        authUpdates.email = finalEmail;
        authUpdates.email_confirm = true;
        updates.email = finalEmail;
      }
      if (password) {
        authUpdates.password = password;
        updates.password = password;
      }

      const { error: authError } = await supabaseServer.auth.admin.updateUserById(id, authUpdates);
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Perform a soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await checkSuperadmin(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized. Superadmin role required.' }, { status: 403 });
  }

  const { id } = await params;

  // Prevent superadmin from soft-deleting themselves!
  if (adminUser.id === id) {
    return NextResponse.json({ error: 'Cannot soft delete your own account.' }, { status: 400 });
  }

  try {
    // 1. Mark profile as deleted
    const { data, error } = await supabaseServer
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Ban/Disable the auth user using Supabase Admin API
    // Setting ban_duration to a large number of hours effectively disables the user account.
    const { error: banError } = await supabaseServer.auth.admin.updateUserById(id, {
      ban_duration: '87600h', // 10 years
    });

    if (banError) {
      console.error('Failed to disable auth user in Supabase Auth:', banError);
    }

    return NextResponse.json({ message: 'User soft deleted successfully', profile: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
