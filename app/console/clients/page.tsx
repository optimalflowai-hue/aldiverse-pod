'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Settings, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ClientItem {
  id: string;
  name: string;
  slug: string;
  lulu_environment: string;
  stripe_connected: boolean;
  stripe_webhook_connected: boolean;
  lulu_connected: boolean;
  created_at: string;
}

export default function ClientsDirectory() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [editName, setEditName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const loadClients = async () => {
    setLoading(true);
    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch('/api/v1/clients', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.clients) {
        setClients(data.clients);
      }
    } catch (e) {
      console.error('Failed to load clients list:', e);
      toast.error('Failed to load clients list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleOpenEdit = (client: ClientItem) => {
    setEditingClient(client);
    setEditName(client.name);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setSubmitting(true);

    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`/api/v1/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update client details');
      }

      toast.success('Client updated successfully');
      setEditingClient(null);
      await loadClients();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this client? This will remove all their books, orders, and credentials permanently.')) {
      return;
    }

    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`/api/v1/clients/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        toast.success('Client deleted successfully');
        setEditingClient(null);
        await loadClients();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete client');
      }
    } catch (e) {
      console.error(e);
      toast.error('An unexpected error occurred');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="border-b pb-5">
        <h1 className="text-xl font-bold tracking-tight">Clients Directory</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage publishing clients, environment configurations, and integration links.
        </p>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border rounded-lg bg-card p-5 space-y-5 shadow-sm animate-pulse">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
                <div className="h-7 w-7 bg-muted rounded" />
              </div>
              <div className="space-y-2 border-t pt-4">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
              <div className="flex justify-between items-center border-t pt-4">
                <div className="h-3 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="border rounded-lg bg-card text-card-foreground p-12 text-center shadow-sm">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-bold text-sm">No clients setup</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Publishers must be added to the platform before checkout or printing fulfillment can occur.
          </p>
          <button
            onClick={() => router.push('/console')}
            className="mt-4 px-4 h-9 bg-primary text-primary-foreground font-semibold text-xs rounded-md"
          >
            Create First Client
          </button>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {clients.map((client) => (
            <motion.div
              key={client.id}
              variants={itemVariants}
              className="border rounded-lg bg-card text-card-foreground p-5 flex flex-col justify-between space-y-5 shadow-sm hover:shadow transition-all group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm leading-none tracking-tight truncate max-w-[170px]">{client.name}</h3>
                    <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground inline-block mt-1">
                      /{client.slug}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenEdit(client)}
                    className="p-1.5 rounded border bg-background text-muted-foreground hover:bg-muted"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>

                {/* Connection check list */}
                <div className="space-y-2 border-t pt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Stripe Integration</span>
                    {client.stripe_connected ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                        <XCircle className="h-3.5 w-3.5" /> Not Configured
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lulu Print API</span>
                    {client.lulu_connected ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                        <XCircle className="h-3.5 w-3.5" /> Not Configured
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Environment</span>
                    <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted border text-muted-foreground">
                      {client.lulu_environment}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t text-[10px] text-muted-foreground">
                <span>
                  Created {new Date(client.created_at).toLocaleDateString()}
                </span>
                
                <button
                  onClick={() => router.push(`/console/${client.slug}/books`)}
                  className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform"
                >
                  <span>Enter Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Edit Client Dialog Overlay */}
      <AnimatePresence>
        {editingClient && (
          <div 
            onClick={() => setEditingClient(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground w-full max-w-md rounded-lg border shadow-lg p-6 space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4.5 w-4.5 text-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Edit Client</h3>
                </div>
                <button onClick={() => setEditingClient(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Client Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Client Workspace Slug</label>
                  <input
                    type="text"
                    disabled
                    value={editingClient.slug}
                    className="w-full h-10 px-3 rounded-md border bg-background text-foreground opacity-55 cursor-not-allowed text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Workspace slugs cannot be renamed to protect API integrations.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteClient(editingClient.id)}
                    className="h-10 px-3.5 border border-destructive/20 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold rounded-md flex items-center justify-center transition-all active:scale-[0.98]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-10 bg-primary text-primary-foreground font-semibold rounded-md flex items-center justify-center transition-all hover:opacity-90 active:scale-[0.98] text-xs shadow-sm"
                  >
                    {submitting ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      'Save Client Details'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
