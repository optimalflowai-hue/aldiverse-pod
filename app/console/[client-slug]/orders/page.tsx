'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useParams } from 'next/navigation';
import { 
  ShoppingCart, 
  RefreshCw, 
  Truck, 
  AlertCircle,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  book_id: string;
  stripe_session_id: string;
  lulu_job_id: string | null;
  customer_name: string;
  customer_email: string;
  quantity: number;
  amount_paid: number;
  status: 'pending' | 'paid' | 'submitted_to_lulu' | 'printing' | 'shipped' | 'cancelled';
  tracking_number: string | null;
  lulu_status: string | null;
  created_at: string;
  books: {
    title: string;
  } | null;
}

export default function OrdersHistory() {
  const params = useParams();
  const clientSlug = params['client-slug'] as string;

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data: clientData } = await supabaseClient
        .from('tenants')
        .select('id')
        .eq('slug', clientSlug)
        .single();

      if (clientData) {
        const { data: ordersData, error } = await supabaseClient
          .from('orders')
          .select(`
            *,
            books ( title )
          `)
          .eq('tenant_id', clientData.id)
          .order('created_at', { ascending: false });

        if (!error && ordersData) {
          setOrders(ordersData as any);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load order history data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientSlug) {
      loadOrders();
    }
  }, [clientSlug]);

  const handleRetryLulu = async (orderId: string) => {
    setRetryingId(orderId);
    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`/api/v1/orders/${orderId}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit order to Lulu');
      } else {
        toast.success('Order successfully submitted to Lulu!');
        await loadOrders();
      }
    } catch (e) {
      console.error(e);
      toast.error('An unexpected error occurred during retry.');
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'shipped':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'printing':
      case 'submitted_to_lulu':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'paid':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
    }
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Orders Pipeline</h2>
        <p className="text-xs text-muted-foreground">
          Track transactions, carrier status updates, and print fulfillment logs.
        </p>
      </div>

      {loading ? (
        <div className="border rounded-lg bg-card p-6 shadow-sm space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b animate-pulse last:border-0">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
              <div className="h-4 w-20 bg-muted rounded mx-4" />
              <div className="h-4 w-12 bg-muted rounded mx-4" />
              <div className="h-5 w-24 bg-muted rounded mx-4" />
              <div className="h-8 w-24 bg-muted rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="border rounded-lg bg-card text-card-foreground p-12 text-center shadow-sm">
          <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-bold text-sm">No Orders Registered</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Completed Stripe checkout sessions will automatically trigger orders in this list.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg bg-card text-card-foreground p-6 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  <th className="py-3 px-3">Order Details</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Fulfillment Status</th>
                  <th className="py-3 px-3 text-right">Lulu Sync / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="group hover:bg-muted/40 transition-colors">
                    
                    {/* Order Details */}
                    <td className="py-4 px-3">
                      <p className="font-bold text-xs">{order.books?.title || 'Unknown Book'}</p>
                      <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Order ID: {order.id}</p>
                      <p className="text-[9px] text-muted-foreground">
                        Placed {new Date(order.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </td>

                    {/* Customer */}
                    <td className="py-4 px-3">
                      <p className="font-semibold text-xs truncate max-w-[150px]">{order.customer_name || 'Guest'}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{order.customer_email}</p>
                    </td>

                    {/* Amount */}
                    <td className="py-4 px-3">
                      <p className="font-semibold text-xs">${Number(order.amount_paid).toFixed(2)}</p>
                      <p className="text-[9px] text-muted-foreground">Qty: {order.quantity}</p>
                    </td>

                    {/* Fulfillment Status */}
                    <td className="py-4 px-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusStyle(order.status)}`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                        
                        {order.lulu_status && (
                          <span className="text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
                            Lulu: {order.lulu_status}
                          </span>
                        )}
                      </div>

                      {order.tracking_number && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold pt-0.5">
                          <Truck className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[150px]">Tracking: {order.tracking_number}</span>
                        </div>
                      )}
                    </td>

                    {/* Lulu Sync / Actions */}
                    <td className="py-4 px-3 text-right">
                      {order.lulu_job_id ? (
                        <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground font-semibold">
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Lulu Job: {order.lulu_job_id}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center gap-1 text-[10px] text-destructive font-semibold">
                            <AlertCircle className="h-3 w-3 shrink-0 animate-pulse" />
                            <span>Unsent</span>
                          </div>
                          
                          <button
                            onClick={() => handleRetryLulu(order.id)}
                            disabled={retryingId === order.id}
                            className="flex items-center justify-center gap-1.5 h-8 px-3 rounded bg-primary text-primary-foreground font-semibold text-xs transition-all active:scale-[0.98] hover:opacity-90"
                          >
                            {retryingId === order.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3" />
                                <span>Retry Lulu</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
