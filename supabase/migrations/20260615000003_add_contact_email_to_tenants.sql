-- Add contact_email column to tenants table for per-tenant Lulu production notifications
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_email TEXT;
