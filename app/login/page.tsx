'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrap, setBootstrap] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_disabled') {
      toast.error('This account has been disabled. Please contact the administrator.');
    }

    const checkBootstrap = async () => {
      try {
        const res = await fetch('/api/v1/auth/bootstrap');
        const data = await res.json();
        if (data.bootstrap) {
          setBootstrap(true);
        }
      } catch (err) {
        console.error('Error checking bootstrap:', err);
      }
    };
    checkBootstrap();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Auto-append domain to username to create standard email
    const finalEmail = username.trim().includes('@')
      ? username.trim()
      : `${username.trim().toLowerCase()}@aldiverse.com`;

    try {
      if (bootstrap) {
        const { data, error } = await supabaseClient.auth.signUp({
          email: finalEmail,
          password,
        });

        if (error) {
          toast.error(error.message);
        } else if (data.user) {
          toast.success('Superadmin account created successfully! Please log in.');
          setBootstrap(false);
          setPassword('');
        }
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: finalEmail,
          password,
        });

        if (error) {
          toast.error(error.message);
        } else if (data.session) {
          const { data: profile, error: pError } = await supabaseClient
            .from('profiles')
            .select('deleted_at')
            .eq('id', data.session.user.id)
            .single();

          if (pError || !profile) {
            await supabaseClient.auth.signOut();
            toast.error('Account configuration error. No profile found.');
          } else if (profile.deleted_at) {
            await supabaseClient.auth.signOut();
            toast.error('This account is disabled. Access denied.');
          } else {
            router.push('/console');
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="z-10 w-full max-w-sm rounded-lg border bg-card text-card-foreground p-8 shadow-md"
    >
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-primary shadow-sm">
          {bootstrap ? <UserPlus className="h-5 w-5 animate-pulse" /> : <Lock className="h-5 w-5" />}
        </div>
        
        <h1 className="text-xl font-bold tracking-tight">
          {bootstrap ? 'Setup Superadmin' : 'Aldiverse Platform'}
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {bootstrap
            ? 'Initialize the master platform account.'
            : 'Sign in to access the management platform.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Username
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              className="w-full h-10 rounded-md border bg-background text-foreground pl-10 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 rounded-md border bg-background text-foreground pl-10 pr-10 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group relative flex w-full h-10 items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-foreground text-xs transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : bootstrap ? (
            <>
              <UserPlus className="h-4 w-4" />
              Initialize Setup
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Sign In
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background text-foreground px-4 font-sans transition-colors duration-300">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase animate-pulse">
            Loading Interface
          </p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
