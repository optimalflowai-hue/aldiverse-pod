'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import { supabaseClient } from '@/lib/supabase-client';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Building2,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  ChevronRight,
  BookOpen
} from 'lucide-react';

interface ClientTenant {
  id: string;
  name: string;
  slug: string;
}

export default function Sidebar() {
  const { user, role, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [clients, setClients] = useState<ClientTenant[]>([]);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Resolve current active client from URL
  const pathParts = pathname.split('/');
  // /console/[client-slug]/... -> parts[1] === 'console', parts[2] is slug
  const activeSlug = pathParts[1] === 'console' && pathParts[2] && !['clients', 'users'].includes(pathParts[2]) 
    ? pathParts[2] 
    : null;

  useEffect(() => {
    // Expand workspace accordion automatically if on a client workspace route
    if (activeSlug) {
      setWorkspaceOpen(true);
    }

    // Fetch clients
    const fetchClients = async () => {
      const { data, error } = await supabaseClient
        .from('tenants')
        .select('id, name, slug')
        .order('name');
      
      if (!error && data) {
        setClients(data);
      }
    };
    if (user) {
      fetchClients();
    }
  }, [user, activeSlug]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleClientSelect = (slug: string) => {
    router.push(`/console/${slug}/books`);
  };

  const isLinkActive = (href: string) => {
    return pathname === href;
  };

  return (
    <div className="flex flex-col w-64 h-screen border-r bg-card text-card-foreground font-sans p-6 shrink-0 z-20 relative select-none">
      
      {/* Brand logo header */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background shadow-sm text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-bold text-sm leading-tight tracking-tight">Aldiverse</h2>
          <span className="text-[9px] text-muted-foreground tracking-wider uppercase font-semibold">Print Platform</span>
        </div>
      </div>

      {/* Main navigation links */}
      <nav className="flex-1 space-y-1 text-xs">
        
        {/* Dashboard Link */}
        <button
          onClick={() => router.push('/console')}
          className={`flex items-center gap-3 w-full h-10 px-3 rounded-md font-medium transition-all text-left ${
            isLinkActive('/console')
              ? 'bg-secondary text-foreground font-semibold'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard Overview</span>
        </button>

        {/* Clients Directory Link */}
        <button
          onClick={() => router.push('/console/clients')}
          className={`flex items-center gap-3 w-full h-10 px-3 rounded-md font-medium transition-all text-left ${
            isLinkActive('/console/clients')
              ? 'bg-secondary text-foreground font-semibold'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Clients Directory</span>
        </button>

        {/* Collapsible Clients Workspace Accordion */}
        <div className="space-y-0.5">
          <button
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className={`flex items-center justify-between w-full h-10 px-3 rounded-md font-medium transition-all text-left ${
              activeSlug 
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-3">
              <BookOpen className="h-4 w-4" />
              <span>Clients Workspace</span>
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${workspaceOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence initial={false}>
            {workspaceOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden pl-7 space-y-0.5 border-l ml-5 border-border"
              >
                {clients.length === 0 ? (
                  <div className="text-[10px] py-2 text-muted-foreground italic">No clients found</div>
                ) : (
                  clients.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleClientSelect(tenant.slug)}
                      className={`flex items-center justify-between w-full h-8 px-2.5 rounded text-left text-[11px] font-medium transition-all ${
                        tenant.slug === activeSlug
                          ? 'bg-secondary text-foreground font-semibold'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">{tenant.name}</span>
                      <ChevronRight className="h-3 w-3 opacity-60" />
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Management Link (Superadmin only) */}
        {role === 'superadmin' && (
          <button
            onClick={() => router.push('/console/users')}
            className={`flex items-center gap-3 w-full h-10 px-3 rounded-md font-medium transition-all text-left ${
              isLinkActive('/console/users')
                ? 'bg-secondary text-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>User Management</span>
          </button>
        )}

      </nav>

      {/* Footer controls: theme toggler and logout */}
      <div className="border-t pt-4 space-y-1.5 text-xs">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full h-10 px-3 rounded-md font-medium hover:bg-muted transition-all"
        >
          <span className="flex items-center gap-3 text-muted-foreground hover:text-foreground">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </span>
        </button>

        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full h-10 px-3 rounded-md font-medium text-destructive hover:bg-destructive/10 transition-all text-left"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>

        {user && (
          <div className="px-3 py-2 mt-2 rounded-md border bg-muted/30">
            <p className="text-[10px] truncate text-muted-foreground font-medium">{user.email}</p>
            <p className="text-[9px] uppercase tracking-wider text-primary font-bold mt-0.5">{role}</p>
          </div>
        )}
      </div>
    </div>
  );
}
