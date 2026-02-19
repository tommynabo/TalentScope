-- ═══════════════════════════════════════════════════════════════════════════════
-- MARKETPLACE SYSTEM - UPWORK & FIVERR CAMPAIGNS
-- Persists campaigns with multi-keyword support and candidate tracking
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1️⃣ Marketplace Campaigns Table
CREATE TABLE IF NOT EXISTS public.marketplace_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Campaign Basic Info
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('Upwork', 'Fiverr')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    
    -- Search Configuration (stored as JSONB for flexibility)
    search_terms JSONB NOT NULL, -- contains: keywords[], minHourlyRate, maxHourlyRate, minJobSuccessRate, etc.
    
    -- Stats (denormalized for quick access)
    total_candidates INT DEFAULT 0,
    in_todo INT DEFAULT 0,
    in_contacted INT DEFAULT 0,
    in_replied INT DEFAULT 0,
    in_rejected INT DEFAULT 0,
    in_hired INT DEFAULT 0,
    contact_rate DECIMAL(5,2) DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    
    -- User/Organization
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marketplace_campaigns_user ON public.marketplace_campaigns(user_id);
CREATE INDEX idx_marketplace_campaigns_platform ON public.marketplace_campaigns(platform);
CREATE INDEX idx_marketplace_campaigns_status ON public.marketplace_campaigns(status);

-- 2️⃣ Marketplace Candidates Table (Per Campaign)
CREATE TABLE IF NOT EXISTS public.marketplace_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Campaign Reference
    campaign_id UUID NOT NULL REFERENCES public.marketplace_campaigns(id) ON DELETE CASCADE,
    
    -- Candidate Information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    linkedin_url TEXT,
    
    -- Ratings & Metrics
    hourly_rate DECIMAL(8,2) NOT NULL,
    job_success_rate DECIMAL(5,2) NOT NULL,
    
    -- Pipeline Status
    kanban_lane VARCHAR(50) NOT NULL DEFAULT 'todo' CHECK (kanban_lane IN ('todo', 'contacted', 'replied', 'rejected', 'hired')),
    
    -- Notes & History
    notes TEXT,
    
    -- Platform-specific data (stored as JSONB)
    platform_data JSONB, -- upwork_profile_url, hourly_rate, etc.
    
    -- Timestamps
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marketplace_candidates_campaign ON public.marketplace_candidates(campaign_id);
CREATE INDEX idx_marketplace_candidates_lane ON public.marketplace_candidates(kanban_lane);
CREATE INDEX idx_marketplace_candidates_added_at ON public.marketplace_candidates(added_at);

-- 3️⃣ Enable RLS (Row Level Security) for multi-tenant safety
ALTER TABLE public.marketplace_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_candidates ENABLE ROW LEVEL SECURITY;

-- 4️⃣ RLS Policies for marketplace_campaigns
CREATE POLICY "Users can view own campaigns"
    ON public.marketplace_campaigns
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create campaigns"
    ON public.marketplace_campaigns
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
    ON public.marketplace_campaigns
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
    ON public.marketplace_campaigns
    FOR DELETE
    USING (auth.uid() = user_id);

-- 5️⃣ RLS Policies for marketplace_candidates (inherited from campaign)
CREATE POLICY "Users can view candidates in own campaigns"
    ON public.marketplace_candidates
    FOR SELECT
    USING (
        campaign_id IN (
            SELECT id FROM public.marketplace_campaigns 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create candidates in own campaigns"
    ON public.marketplace_candidates
    FOR INSERT
    WITH CHECK (
        campaign_id IN (
            SELECT id FROM public.marketplace_campaigns 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update candidates in own campaigns"
    ON public.marketplace_candidates
    FOR UPDATE
    USING (
        campaign_id IN (
            SELECT id FROM public.marketplace_campaigns 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete candidates in own campaigns"
    ON public.marketplace_candidates
    FOR DELETE
    USING (
        campaign_id IN (
            SELECT id FROM public.marketplace_campaigns 
            WHERE user_id = auth.uid()
        )
    );

-- 6️⃣ Helper View: Campaign Summary with stats
CREATE OR REPLACE VIEW public.marketplace_campaigns_with_stats AS
SELECT 
    c.id,
    c.name,
    c.platform,
    c.status,
    c.created_at,
    c.search_terms,
    COUNT(DISTINCT m.id) as total_candidates,
    COUNT(DISTINCT CASE WHEN m.kanban_lane = 'todo' THEN m.id END) as in_todo,
    COUNT(DISTINCT CASE WHEN m.kanban_lane = 'contacted' THEN m.id END) as in_contacted,
    COUNT(DISTINCT CASE WHEN m.kanban_lane = 'replied' THEN m.id END) as in_replied,
    COUNT(DISTINCT CASE WHEN m.kanban_lane = 'rejected' THEN m.id END) as in_rejected,
    COUNT(DISTINCT CASE WHEN m.kanban_lane = 'hired' THEN m.id END) as in_hired,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT m.id) = 0 THEN 0
            ELSE COUNT(DISTINCT CASE WHEN m.kanban_lane != 'todo' THEN m.id END)::DECIMAL 
                 / COUNT(DISTINCT m.id) * 100
        END,
        2
    ) as contact_rate,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT m.id) = 0 THEN 0
            ELSE COUNT(DISTINCT CASE WHEN m.kanban_lane IN ('replied', 'hired') THEN m.id END)::DECIMAL 
                 / COUNT(DISTINCT m.id) * 100
        END,
        2
    ) as response_rate
FROM public.marketplace_campaigns c
LEFT JOIN public.marketplace_candidates m ON c.id = m.campaign_id
GROUP BY c.id, c.name, c.platform, c.status, c.created_at, c.search_terms;

-- 7️⃣ Utility Functions
CREATE OR REPLACE FUNCTION update_campaign_stats(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.marketplace_campaigns
    SET 
        total_candidates = (SELECT COUNT(*) FROM public.marketplace_candidates WHERE marketplace_candidates.campaign_id = $1),
        in_todo = (SELECT COUNT(*) FROM public.marketplace_candidates WHERE marketplace_candidates.campaign_id = $1 AND kanban_lane = 'todo'),
        in_contacted = (SELECT COUNT(*) FROM public.marketplace_candidates WHERE marketplace_candidates.campaign_id = $1 AND kanban_lane = 'contacted'),
        in_replied = (SELECT COUNT(*) FROM public.marketplace_candidates WHERE marketplace_candidates.campaign_id = $1 AND kanban_lane = 'replied'),
        in_rejected = (SELECT COUNT(*) FROM public.marketplace_candidates WHERE marketplace_candidates.campaign_id = $1 AND kanban_lane = 'rejected'),
        in_hired = (SELECT COUNT(*) FROM public.marketplace_candidates WHERE marketplace_candidates.campaign_id = $1 AND kanban_lane = 'hired'),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1;
END;
$$ LANGUAGE plpgsql;

-- 8️⃣ Trigger: Auto-update campaign stats on candidate change
CREATE OR REPLACE FUNCTION trigger_update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_campaign_stats(NEW.campaign_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stats_on_candidate_change ON public.marketplace_candidates;
CREATE TRIGGER update_stats_on_candidate_change
AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_candidates
FOR EACH ROW
EXECUTE FUNCTION trigger_update_campaign_stats();

-- 9️⃣ Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaigns_timestamp ON public.marketplace_campaigns;
CREATE TRIGGER update_campaigns_timestamp
BEFORE UPDATE ON public.marketplace_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_candidates_timestamp ON public.marketplace_candidates;
CREATE TRIGGER update_candidates_timestamp
BEFORE UPDATE ON public.marketplace_candidates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ✅ SCHEMA CREATED SUCCESSFULLY
-- Tables: marketplace_campaigns, marketplace_candidates
-- View: marketplace_campaigns_with_stats
-- Functions: update_campaign_stats(), trigger_update_campaign_stats(), update_updated_at()
-- RLS Policies: Row-level security for multi-tenant access
