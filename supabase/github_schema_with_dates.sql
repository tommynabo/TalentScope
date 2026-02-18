-- ═══════════════════════════════════════════════════════════════════════════════
-- GITHUB SYSTEM - CORRECTED SCHEMA WITH PROPER DATE TRACKING
-- Separates candidates from campaign-candidate relationship (like LinkedIn)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 0️⃣ CLEANUP: Drop old tables if they exist (bad schema versions)
-- This ensures we start fresh with correct schema
DROP TABLE IF EXISTS public.campaign_github_candidates CASCADE;
DROP TABLE IF EXISTS public.github_candidates CASCADE;

-- 1️⃣ Rename/consolidate github_search_results → github_candidates
-- This is the base candidate data table

CREATE TABLE public.github_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- GitHub User Info
    github_id BIGINT UNIQUE,
    github_username VARCHAR(255) NOT NULL UNIQUE,
    github_url TEXT NOT NULL,
    
    -- Contact Information
    email VARCHAR(255),
    linkedin_url TEXT,
    personal_website TEXT,
    
    -- Scoring
    score DECIMAL(5,2),
    
    -- Full metrics stored as JSONB
    github_metrics JSONB NOT NULL,
    
    -- AI Analysis Fields
    analysis_psychological TEXT,
    analysis_business TEXT,
    analysis_sales_angle TEXT,
    analysis_bottleneck TEXT,
    
    -- Outreach Messages (AI-generated, can be edited by user)
    outreach_icebreaker TEXT,
    outreach_pitch TEXT,
    outreach_followup TEXT,
    
    -- Timestamps (when discovered globally, not per campaign)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_github_candidates_username ON public.github_candidates(github_username);
CREATE INDEX idx_github_candidates_email ON public.github_candidates(email) WHERE email IS NOT NULL;
CREATE INDEX idx_github_candidates_created ON public.github_candidates(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════

-- 2️⃣ Campaign-GitHub Candidate relationship (N:N) ← THIS IS THE KEY!
-- This table tracks WHEN a candidate was added to each campaign
-- This allows same developer in multiple campaigns with different dates

CREATE TABLE public.campaign_github_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    github_candidate_id UUID NOT NULL REFERENCES public.github_candidates(id) ON DELETE CASCADE,
    
    -- ✅ KEY FIELD: When was this candidate added to THIS campaign
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional tracking
    status VARCHAR(50) DEFAULT 'Discovered', -- Discovered, Contacted, Responded, Hired, Rejected
    notes TEXT,
    
    -- Prevent duplicates: same candidate in same campaign only once
    UNIQUE(campaign_id, github_candidate_id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX idx_campaign_github_candidates_campaign ON public.campaign_github_candidates(campaign_id);
CREATE INDEX idx_campaign_github_candidates_user ON public.campaign_github_candidates(user_id);
CREATE INDEX idx_campaign_github_candidates_candidate ON public.campaign_github_candidates(github_candidate_id);
CREATE INDEX idx_campaign_github_candidates_added_at ON public.campaign_github_candidates(added_at DESC);

-- Enable RLS
ALTER TABLE public.github_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_github_candidates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for github_candidates
DROP POLICY IF EXISTS "github_candidates_select_own" ON public.github_candidates;
CREATE POLICY "github_candidates_select_own" ON public.github_candidates FOR SELECT 
USING (id IN (
    SELECT github_candidate_id FROM public.campaign_github_candidates 
    WHERE user_id = auth.uid()
));

-- RLS Policies for campaign_github_candidates
DROP POLICY IF EXISTS "campaign_github_candidates_select_own" ON public.campaign_github_candidates;
CREATE POLICY "campaign_github_candidates_select_own" ON public.campaign_github_candidates FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "campaign_github_candidates_insert_own" ON public.campaign_github_candidates;
CREATE POLICY "campaign_github_candidates_insert_own" ON public.campaign_github_candidates FOR INSERT 
WITH CHECK (
    user_id = auth.uid() AND
    campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "campaign_github_candidates_update_own" ON public.campaign_github_candidates;
CREATE POLICY "campaign_github_candidates_update_own" ON public.campaign_github_candidates FOR UPDATE 
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "campaign_github_candidates_delete_own" ON public.campaign_github_candidates;
CREATE POLICY "campaign_github_candidates_delete_own" ON public.campaign_github_candidates FOR DELETE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════

-- 3️⃣ UPDATE TIMESTAMP TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ 
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS github_candidates_update_trigger ON public.github_candidates;
CREATE TRIGGER github_candidates_update_trigger BEFORE UPDATE ON public.github_candidates 
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS campaign_github_candidates_update_trigger ON public.campaign_github_candidates;
CREATE TRIGGER campaign_github_candidates_update_trigger BEFORE UPDATE ON public.campaign_github_candidates 
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════

-- 4️⃣ MIGRATION: Move data from old github_search_results to new tables
-- If you have old data, run this AFTER the tables are created:

-- INSERT INTO public.github_candidates (github_id, github_username, github_url, email, linkedin_url, score, github_metrics, analysis_psychological, analysis_business, analysis_sales_angle, analysis_bottleneck, created_at, updated_at)
-- SELECT github_id, github_username, github_url, email, linkedin_url, score, github_metrics, analysis_psychological, analysis_business, analysis_sales_angle, analysis_bottleneck, created_at, updated_at
-- FROM public.github_search_results
-- ON CONFLICT (github_username) DO UPDATE SET
--   email = EXCLUDED.email,
--   linkedin_url = EXCLUDED.linkedin_url,
--   score = EXCLUDED.score,
--   updated_at = CURRENT_TIMESTAMP;

-- INSERT INTO public.campaign_github_candidates (campaign_id, user_id, github_candidate_id, added_at, created_at, updated_at)
-- SELECT gsr.campaign_id, gsr.user_id, gc.id, gsr.created_at, gsr.created_at, gsr.updated_at
-- FROM public.github_search_results gsr
-- JOIN public.github_candidates gc ON gc.github_username = gsr.github_username
-- ON CONFLICT (campaign_id, github_candidate_id) DO UPDATE SET
--   updated_at = CURRENT_TIMESTAMP;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESULT: Same structure as LinkedIn!
-- 
-- candidates found on: SELECT added_at FROM campaign_github_candidates 
-- WHERE campaign_id = 'xxx' ORDER BY added_at DESC
-- ═══════════════════════════════════════════════════════════════════════════════
