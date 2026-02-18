-- ═══════════════════════════════════════════════════════════════════════════════
-- GITHUB SYSTEM - COMPLETE SUPABASE SCHEMA SETUP
-- ═══════════════════════════════════════════════════════════════════════════════
-- This migration ensures all necessary tables and relationships exist for the
-- GitHub candidate search and persistence system
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1️⃣ ENSURE profiles TABLE (linked to auth.users)
-- This must exist before other tables can reference it
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════════════════

-- 2️⃣ ENSURE campaigns TABLE
-- Generic campaigns table (can be used for GitHub or LinkedIn)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Running', 'Completed', 'Paused')),
    platform TEXT DEFAULT 'GitHub',
    criteria JSONB,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON public.campaigns(created_at DESC);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select_own" ON public.campaigns FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "campaigns_insert_own" ON public.campaigns FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "campaigns_update_own" ON public.campaigns FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "campaigns_delete_own" ON public.campaigns FOR DELETE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════

-- 3️⃣ CREATE github_search_results TABLE
-- Main table for storing GitHub candidate search results per campaign
CREATE TABLE IF NOT EXISTS public.github_search_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- GitHub User Info
    github_id BIGINT,
    github_username VARCHAR(255) NOT NULL,
    github_url TEXT,
    
    -- Contact Information
    email VARCHAR(255),
    linkedin_url TEXT,
    
    -- Scoring
    score DECIMAL(5,2),
    
    -- Full metrics stored as JSONB for flexibility
    github_metrics JSONB NOT NULL,
    
    -- AI Analysis Fields
    analysis_psychological TEXT,
    analysis_business TEXT,
    analysis_sales_angle TEXT,
    analysis_bottleneck TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure no duplicate results per campaign
    UNIQUE(campaign_id, github_username),
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_github_search_results_campaign ON public.github_search_results(campaign_id);
CREATE INDEX IF NOT EXISTS idx_github_search_results_user ON public.github_search_results(user_id);
CREATE INDEX IF NOT EXISTS idx_github_search_results_username ON public.github_search_results(github_username);
CREATE INDEX IF NOT EXISTS idx_github_search_results_email ON public.github_search_results(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_github_search_results_linkedin ON public.github_search_results(linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_github_search_results_created ON public.github_search_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_search_results_score ON public.github_search_results(score DESC);

-- Enable RLS for security
ALTER TABLE public.github_search_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own campaign results" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can insert results for their campaigns" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can update their own results" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can delete their own results" ON public.github_search_results;

-- Create new policies
CREATE POLICY "github_search_results_select_own" 
    ON public.github_search_results FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "github_search_results_insert_own" 
    ON public.github_search_results FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid())
    );

CREATE POLICY "github_search_results_update_own" 
    ON public.github_search_results FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "github_search_results_delete_own" 
    ON public.github_search_results FOR DELETE
    USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════

-- 4️⃣ UPDATE TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to github_search_results
DROP TRIGGER IF EXISTS github_search_results_update_trigger ON public.github_search_results;
CREATE TRIGGER github_search_results_update_trigger
    BEFORE UPDATE ON public.github_search_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Apply trigger to campaigns
DROP TRIGGER IF EXISTS campaigns_update_trigger ON public.campaigns;
CREATE TRIGGER campaigns_update_trigger
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════

-- 5️⃣ VERIFICATION QUERIES (run these to check everything is set up)
-- SELECT COUNT(*) as profiles_count FROM public.profiles;
-- SELECT COUNT(*) as campaigns_count FROM public.campaigns;
-- SELECT COUNT(*) as github_results_count FROM public.github_search_results;

-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF GITHUB SYSTEM SCHEMA SETUP
-- ═══════════════════════════════════════════════════════════════════════════════
