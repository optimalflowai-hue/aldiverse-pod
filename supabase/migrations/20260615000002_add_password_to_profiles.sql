-- Alter public.profiles table to store plaintext password for the superadmin
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;
