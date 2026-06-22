'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  ShoppingBag, 
  DollarSign, 
  Plus, 
  Sparkles,
  TrendingUp,
  X,
  Link as LinkIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ClientStats {
  totalClients: number;
  totalOrders: number;
  totalRevenue: number;
  fulfillmentRate: number;
}

interface OrderItem {
  id: string;
  customer_name: string;
  customer_email: string;
  amount_paid: number;
  status: string;
  created_at: string;
  tenants: {
    name: string;
  } | null;
}

export default function ConsoleDashboard() {
  const [stats, setStats] = useState<ClientStats>({
    totalClients: 0,
    totalOrders: 0,
    totalRevenue: 0,
    fulfillmentRate: 0,
  });
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientSlug, setNewClientSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const loadDashboardData = async () => {
    try {
      const { count: clientsCount } = await supabaseClient
        .from('tenants')
        .select('*', { count: 'exact', head: true });

      const { data: ordersData } = await supabaseClient
        .from('orders')
        .select('id, amount_paid, status, created_at, customer_name, customer_email, tenant_id');

      if (ordersData) {
        const totalRev = ordersData.reduce((acc, order) => acc + Number(order.amount_paid), 0);
        const fulfilledCount = ordersData.filter(o => 
          ['submitted_to_lulu', 'printing', 'shipped'].includes(o.status)
        ).length;
        const rate = ordersData.length > 0 ? Math.round((fulfilledCount / ordersData.length) * 100) : 0;

        setStats({
          totalClients: clientsCount || 0,
          totalOrders: ordersData.length,
          totalRevenue: totalRev,
          fulfillmentRate: rate
        });
      }

      const { data: recent } = await supabaseClient
        .from('orders')
        .select(`
          id, customer_name, customer_email, amount_paid, status, created_at,
          tenants ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recent) {
        setRecentOrders(recent as any);
      }
    } catch (e) {
      console.error('Failed to load dashboard statistics:', e);
      toast.error('Failed to update dashboard data');
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewClientName(val);
    setNewClientSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch('/api/v1/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newClientName, slug: newClientSlug })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create client');
      }

      setIsModalOpen(false);
      setNewClientName('');
      setNewClientSlug('');
      
      toast.success('Client workspace created successfully');
      await loadDashboardData();
      router.push(`/console/${data.client.slug}/settings`);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Aldiverse Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Print-on-Demand In-House Management Platform
          </p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 h-9 bg-primary text-primary-foreground font-semibold rounded-md transition-all hover:opacity-90 active:scale-[0.98] text-xs shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Analytics widgets grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Clients Card */}
        <div className="border rounded-lg bg-card text-card-foreground p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total Clients</span>
            <h3 className="text-2xl font-bold tracking-tight">{stats.totalClients}</h3>
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              Active Publishers
            </span>
          </div>
          <div className="h-9 w-9 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
            <Building2 className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* Total Orders Card */}
        <div className="border rounded-lg bg-card text-card-foreground p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total Print Jobs</span>
            <h3 className="text-2xl font-bold tracking-tight">{stats.totalOrders}</h3>
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              Fulfillment Orders
            </span>
          </div>
          <div className="h-9 w-9 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* Total Revenue Card */}
        <div className="border rounded-lg bg-card text-card-foreground p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Revenue Invoiced</span>
            <h3 className="text-2xl font-bold tracking-tight">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
              Checkout volume
            </span>
          </div>
          <div className="h-9 w-9 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
            <DollarSign className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* Fulfillment Rate Gauge Card */}
        <div className="border rounded-lg bg-card text-card-foreground p-5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Lulu Success Rate</span>
            <h3 className="text-2xl font-bold tracking-tight">{stats.fulfillmentRate}%</h3>
            <div className="w-20 h-1 bg-muted rounded-full overflow-hidden mt-1">
              <div 
                className="h-full bg-primary" 
                style={{ width: `${stats.fulfillmentRate}%` }} 
              />
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
        </div>

      </div>

      {/* Main dashboard content grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Orders table */}
        <div className="lg:col-span-2 border rounded-lg bg-card text-card-foreground p-5 space-y-3 shadow-sm">
          <div>
            <h3 className="text-sm font-bold tracking-tight">Recent Orders</h3>
            <p className="text-[11px] text-muted-foreground">Latest consumer checkouts across clients.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-1">Customer</th>
                  <th className="py-2.5 px-1">Client</th>
                  <th className="py-2.5 px-1">Amount</th>
                  <th className="py-2.5 px-1">Status</th>
                  <th className="py-2.5 px-1 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">No orders logged yet.</td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="group hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-1">
                        <p className="font-semibold text-xs truncate max-w-[120px]">{order.customer_name || 'Guest'}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{order.customer_email}</p>
                      </td>
                      <td className="py-3 px-1 font-semibold text-xs text-primary">
                        {order.tenants?.name || 'Deleted Client'}
                      </td>
                      <td className="py-3 px-1 text-xs font-semibold">
                        ${Number(order.amount_paid).toFixed(2)}
                      </td>
                      <td className="py-3 px-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          ['shipped', 'printing'].includes(order.status)
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : order.status === 'cancelled'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
                        }`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-1 text-right text-muted-foreground text-[10px]">
                        {new Date(order.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Circular Gauge Health Panel */}
        <div className="border rounded-lg bg-card text-card-foreground p-5 flex flex-col justify-between space-y-6 shadow-sm">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold tracking-tight">Fulfillment Status</h3>
            <p className="text-[11px] text-muted-foreground">API integration gateway diagnostics</p>
          </div>

          <div className="relative flex items-center justify-center py-2">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="54"
                className="stroke-muted"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r="54"
                className="stroke-primary"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="339.3"
                strokeDashoffset={339.3 - (339.3 * stats.fulfillmentRate) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-extrabold">{stats.fulfillmentRate}%</span>
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Successful</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between border-b pb-1.5">
              <span className="text-muted-foreground">Lulu Print API</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">ONLINE</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stripe Gateway</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">ONLINE</span>
            </div>
          </div>
        </div>

      </div>

      {/* Add Client Dialog Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div 
            onClick={() => setIsModalOpen(false)}
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
                  <h3 className="font-bold text-sm uppercase tracking-wider">Add New Client</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Patti Mills"
                    value={newClientName}
                    onChange={handleNameChange}
                    className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Client Workspace Slug</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="drpattimills"
                      value={newClientSlug}
                      onChange={(e) => setNewClientSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      className="w-full h-10 pl-9 pr-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-md flex items-center justify-center transition-all hover:opacity-90 active:scale-[0.98] text-xs shadow-sm mt-2"
                >
                  {submitting ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    'Create Client Workspace'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
