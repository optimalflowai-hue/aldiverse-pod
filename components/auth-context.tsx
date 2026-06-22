'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  role: 'superadmin' | 'member' | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'superadmin' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfileAndVerify = async (currentUser: User) => {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('role, deleted_at')
        .eq('id', currentUser.id)
        .single();

      if (error || !data) {
        console.error('Error fetching user profile:', error);
        setUser(null);
        setRole(null);
        return;
      }

      // Check soft-delete status
      if (data.deleted_at) {
        console.warn('User account is soft-deleted/disabled');
        await supabaseClient.auth.signOut();
        setUser(null);
        setRole(null);
        router.push('/login?error=account_disabled');
        return;
      }

      setUser(currentUser);
      setRole(data.role as 'superadmin' | 'member');
    } catch (e) {
      console.error('Exception in fetchProfileAndVerify:', e);
      setUser(null);
      setRole(null);
    }
  };

  const checkUser = async () => {
    setLoading(true);
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session?.user) {
      await fetchProfileAndVerify(session.user);
    } else {
      setUser(null);
      setRole(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setLoading(true);
          await fetchProfileAndVerify(session.user);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    await supabaseClient.auth.signOut();
    setUser(null);
    setRole(null);
    setLoading(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signOut: handleSignOut,
        refreshProfile: checkUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
