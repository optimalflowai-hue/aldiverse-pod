'use client';

import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/components/auth-context';
import Sidebar from '@/components/sidebar';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';

// Inner Layout Guard that handles redirecting unauthenticated users
function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading && !user) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-background text-foreground overflow-hidden">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase animate-pulse">
            Authenticating Session
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex w-full min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Persistent Left Sidebar */}
      <Sidebar />

      {/* Main Content Workspace Container */}
      <main className="flex-1 h-screen overflow-y-auto px-6 py-6 md:px-8">
        <div className="w-full max-w-6xl mx-auto flex flex-col min-h-full">
          {children}
        </div>
      </main>
      
      {/* Sonner toast container */}
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

// Master Provider wrapper
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConsoleGuard>{children}</ConsoleGuard>
    </AuthProvider>
  );
}
