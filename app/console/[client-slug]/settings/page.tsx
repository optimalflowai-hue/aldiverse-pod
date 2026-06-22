'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useParams, useRouter } from 'next/navigation';
import { 
  Save, 
  Eye, 
  EyeOff,
  Link2
} from 'lucide-react';
import { toast } from 'sonner';

interface ClientSettings {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  lulu_environment: 'sandbox' | 'production';
  stripe_connected: boolean;
  stripe_webhook_connected: boolean;
  lulu_connected: boolean;
}

export default function TenantWorkspaceSettings() {
  const params = useParams();
  const clientSlug = params['client-slug'] as string;
  const router = useRouter();

  const [client, setClient] = useState<ClientSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [luluEnvironment, setLuluEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [luluClientKey, setLuluClientKey] = useState('');
  const [luluClientSecret, setLuluClientSecret] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');

  // Visibility states
  const [showLuluKey, setShowLuluKey] = useState(false);
  const [showLuluSecret, setShowLuluSecret] = useState(false);
  const [showStripeKey, setShowStripeKey] = useState(false);
  const [showStripeWebhook, setShowStripeWebhook] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const loadSettings = async () => {
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
        const found = data.clients.find((c: any) => c.slug === clientSlug);
        if (found) {
          setClient(found);
          setName(found.name);
          setContactEmail(found.contact_email || '');
          setLuluEnvironment(found.lulu_environment);
        } else {
          router.push('/console');
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientSlug) {
      loadSettings();
    }
  }, [clientSlug]);

  const handleSubmitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setSubmitting(true);

    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const payload: any = {
        name,
        contact_email: contactEmail,
        lulu_environment: luluEnvironment
      };

      if (luluClientKey) payload.lulu_client_key = luluClientKey;
      if (luluClientSecret) payload.lulu_client_secret = luluClientSecret;
      if (stripeSecretKey) payload.stripe_secret_key = stripeSecretKey;
      if (stripeWebhookSecret) payload.stripe_webhook_secret = stripeWebhookSecret;

      const res = await fetch(`/api/v1/clients/${client.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update credentials');
      }

      toast.success('Client settings saved successfully');
      
      setLuluClientKey('');
      setLuluClientSecret('');
      setStripeSecretKey('');
      setStripeWebhookSecret('');

      await loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold tracking-tight">API Settings</h2>
        <p className="text-xs text-muted-foreground">
          Configure encrypted Stripe gateways and Lulu API developer keys.
        </p>
      </div>

      <form onSubmit={handleSubmitSettings} className="space-y-6">
        
        {/* General Settings */}
        <div className="border rounded-lg bg-card text-card-foreground p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
            General Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Client Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Lulu Environment</label>
              <select
                value={luluEnvironment}
                onChange={(e) => setLuluEnvironment(e.target.value as any)}
                className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="sandbox">Sandbox (Test Environment)</option>
                <option value="production">Production (Real Print Fulfillment)</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Production Contact Email
              </label>
              <input
                type="email"
                placeholder="e.g. production@yourclient.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">
                Lulu sends production status notifications to this email. Used as the contact email on all print job submissions.
              </p>
            </div>
          </div>
        </div>

        {/* Lulu Credentials */}
        <div className="border rounded-lg bg-card text-card-foreground p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Lulu Developer API Integration
            </h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              client.lulu_connected 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
            }`}>
              {client.lulu_connected ? 'Linked' : 'Not Linked'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Lulu Client Key</label>
              <div className="relative">
                <input
                  type={showLuluKey ? 'text' : 'password'}
                  placeholder={client.lulu_connected ? '••••••••••••••••••••••••' : 'Enter Lulu Client Key'}
                  value={luluClientKey}
                  onChange={(e) => setLuluClientKey(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLuluKey(!showLuluKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showLuluKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Lulu Client Secret</label>
              <div className="relative">
                <input
                  type={showLuluSecret ? 'text' : 'password'}
                  placeholder={client.lulu_connected ? '••••••••••••••••••••••••' : 'Enter Lulu Client Secret'}
                  value={luluClientSecret}
                  onChange={(e) => setLuluClientSecret(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLuluSecret(!showLuluSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showLuluSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stripe Credentials */}
        <div className="border rounded-lg bg-card text-card-foreground p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Stripe Payment Gateway
            </h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              client.stripe_connected 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
            }`}>
              {client.stripe_connected ? 'Linked' : 'Not Linked'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Stripe Secret Key</label>
              <div className="relative">
                <input
                  type={showStripeKey ? 'text' : 'password'}
                  placeholder={client.stripe_connected ? '••••••••••••••••••••••••' : 'sk_test_...'}
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowStripeKey(!showStripeKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showStripeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Stripe Webhook Signing Secret</label>
              <div className="relative">
                <input
                  type={showStripeWebhook ? 'text' : 'password'}
                  placeholder={client.stripe_webhook_connected ? '••••••••••••••••••••••••' : 'whsec_...'}
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowStripeWebhook(!showStripeWebhook)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showStripeWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1 bg-muted p-4 rounded-md border text-xs">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase block">Webhook Endpoint URL</span>
            <p className="font-mono select-all text-primary mt-1 break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/v1/webhooks/stripe?tenant=${client.slug}` : `/api/v1/webhooks/stripe?tenant=${client.slug}`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
              Configure this URL in your Stripe developer portal to enable transaction webhook callbacks.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 w-full h-11 bg-primary text-primary-foreground font-semibold rounded-md transition-all hover:opacity-90 active:scale-[0.98] text-xs shadow-sm"
        >
          <Save className="h-4 w-4" />
          <span>Save API Configuration</span>
        </button>

      </form>
    </div>
  );
}
