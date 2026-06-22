-- Up Migration: User Profiles and Role Management for In-House Admin Panel

-- 1. Create profiles table linked to Supabase Auth users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('superadmin', 'member')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index the primary ID
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- Attach automatic updated_at trigger
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Configure Row Level Security (RLS) on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Define Policies
-- Allow any authenticated team member to read profiles (needed for the users directory)
-- We allow active profiles, or the user's own profile (so they can verify deactivated status)
CREATE POLICY "Allow authenticated team members to read profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (deleted_at IS NULL OR id = auth.uid());

-- Allow only superadmins to manage write operations (INSERT/UPDATE/DELETE)
-- This splits the policy to avoid infinite recursion on SELECT queries
CREATE POLICY "Allow superadmins to insert profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'superadmin'
);

CREATE POLICY "Allow superadmins to update profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'superadmin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'superadmin'
);

CREATE POLICY "Allow superadmins to delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'superadmin'
);

-- 4. Automate Profile Creation on Auth Signup
-- This function automatically creates a profile row in the public schema
-- when a new user registers in Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- The very first user to register becomes the "superadmin"
  -- Subsequent users default to "member"
  IF (SELECT COUNT(*) FROM public.profiles) = 0 THEN
    INSERT INTO public.profiles (id, role)
    VALUES (new.id, 'superadmin');
  ELSE
    INSERT INTO public.profiles (id, role)
    VALUES (new.id, 'member');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to capture auth.users signups
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
