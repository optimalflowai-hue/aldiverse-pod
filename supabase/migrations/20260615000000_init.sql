-- Up Migration: Initialize Schema for Multi-Tenant Print-on-Demand Platform

-- 1. Create automatic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Create Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    lulu_client_key TEXT,
    lulu_client_secret TEXT,
    lulu_environment TEXT DEFAULT 'sandbox' CHECK (lulu_environment IN ('sandbox', 'production')),
    stripe_secret_key TEXT,
    stripe_webhook_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index slug for fast routing lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 3. Create Books Table
CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    interior_pdf_url TEXT NOT NULL,
    cover_pdf_url TEXT NOT NULL,
    pod_package_id TEXT NOT NULL, -- Dotted Lulu SKU format
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_tenant_id ON books(tenant_id);

-- 4. Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    stripe_session_id TEXT NOT NULL UNIQUE,
    lulu_job_id TEXT, -- Populated once sent to Lulu
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    amount_paid NUMERIC(10, 2) NOT NULL CHECK (amount_paid >= 0),
    shipping_address JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'submitted_to_lulu', 'printing', 'shipped', 'cancelled')),
    tracking_number TEXT,
    lulu_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);

-- 5. Attach updated_at triggers
CREATE TRIGGER update_tenants_updated_at 
    BEFORE UPDATE ON tenants 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at 
    BEFORE UPDATE ON books 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Configure Row Level Security (RLS)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies for In-House Production Team Members (Supabase Authenticated Role)
CREATE POLICY "Allow full access to tenants for authenticated team members" 
ON tenants 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow full access to books for authenticated team members" 
ON books 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow full access to orders for authenticated team members" 
ON orders 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
