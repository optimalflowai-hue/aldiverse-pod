'use client';

import React, { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { BookOpen, ShoppingCart, Settings2, Globe, Building } from 'lucide-react';

interface ClientDetail {
  id: string;
  name: string;
  slug: string;
  lulu_environment: string;
}

export default function ClientWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const clientSlug = params['client-slug'] as string;

  useEffect(() => {
    const fetchClient = async () => {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('tenants')
        .select('id, name, slug, lulu_environment')
        .eq('slug', clientSlug)
        .single();

      if (error || !data) {
        console.error('Client workspace not found');
        router.push('/console');
      } else {
        setClient(data);
      }
      setLoading(false);
    };

    if (clientSlug) {
      fetchClient();
    }
  }, [clientSlug, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[300px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!client) return null;

  const tabs = [
    {
      name: 'Books Catalog',
      href: `/console/${clientSlug}/books`,
      icon: BookOpen,
      active: pathname === `/console/${clientSlug}/books`
    },
    {
      name: 'Orders History',
      href: `/console/${clientSlug}/orders`,
      icon: ShoppingCart,
      active: pathname === `/console/${clientSlug}/orders`
    },
    {
      name: 'API Settings',
      href: `/console/${clientSlug}/settings`,
      icon: Settings2,
      active: pathname === `/console/${clientSlug}/settings`
    }
  ];

  return (
    <div className="flex flex-col flex-1 space-y-6 pb-12">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-card-foreground shadow-sm">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Publisher Workspace
            </span>
            <h1 className="text-xl font-bold tracking-tight mt-0.5">{client.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold">Lulu Environment:</span>
          <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
            client.lulu_environment === 'production'
              ? 'bg-destructive/10 text-destructive border-destructive/20'
              : 'bg-secondary text-secondary-foreground'
          }`}>
            <Globe className="h-3 w-3" />
            {client.lulu_environment}
          </span>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b">
        <div className="flex space-x-1 p-1 rounded-lg bg-muted">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.name}
                onClick={() => router.push(tab.href)}
                className={`flex items-center gap-2 px-4 h-9 rounded-md text-xs font-medium transition-all ${
                  tab.active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace content */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
