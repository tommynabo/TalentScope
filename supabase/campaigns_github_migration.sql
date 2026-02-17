-- ============================================================================
-- CAMPAIGNS GITHUB TABLE
-- Separate table for GitHub campaigns - independent from LinkedIn system
-- ============================================================================

-- Create the campaigns_github table
CREATE TABLE IF NOT EXISTS public.campaigns_github (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Running', 'Completed', 'Paused')),
    target_role TEXT,
    platform TEXT DEFAULT 'GitHub',
    criteria JSONB,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS campaigns_github_user_id_idx ON public.campaigns_github(user_id);
CREATE INDEX IF NOT EXISTS campaigns_github_created_at_idx ON public.campaigns_github(created_at DESC);
CREATE INDEX IF NOT EXISTS campaigns_github_status_idx ON public.campaigns_github(status);

-- Enable RLS
ALTER TABLE public.campaigns_github ENABLE ROW LEVEL SECURITY;

-- Create policies for campaigns_github
-- Users can only see their own campaigns
DROP POLICY IF EXISTS "campaigns_github_select_own" ON public.campaigns_github;
CREATE POLICY "campaigns_github_select_own" ON public.campaigns_github
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own campaigns
DROP POLICY IF EXISTS "campaigns_github_insert_own" ON public.campaigns_github;
CREATE POLICY "campaigns_github_insert_own" ON public.campaigns_github
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own campaigns
DROP POLICY IF EXISTS "campaigns_github_update_own" ON public.campaigns_github;
CREATE POLICY "campaigns_github_update_own" ON public.campaigns_github
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own campaigns
DROP POLICY IF EXISTS "campaigns_github_delete_own" ON public.campaigns_github;
CREATE POLICY "campaigns_github_delete_own" ON public.campaigns_github
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS campaigns_github_update_timestamp ON public.campaigns_github;
CREATE TRIGGER campaigns_github_update_timestamp
    BEFORE UPDATE ON public.campaigns_github
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Ensure update_timestamp function exists
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
