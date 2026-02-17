-- Create github_search_results table for persistent candidate storage
-- This table stores all GitHub search results per campaign for accumulation

CREATE TABLE IF NOT EXISTS github_search_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
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
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    UNIQUE(campaign_id, github_username),
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Índices para queries rápidas
CREATE INDEX idx_github_search_results_campaign ON github_search_results(campaign_id);
CREATE INDEX idx_github_search_results_user ON github_search_results(user_id);
CREATE INDEX idx_github_search_results_username ON github_search_results(github_username);
CREATE INDEX idx_github_search_results_email ON github_search_results(email) WHERE email IS NOT NULL;
CREATE INDEX idx_github_search_results_linkedin ON github_search_results(linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX idx_github_search_results_created ON github_search_results(created_at DESC);

-- RLS Policies - Users can only see their own campaign results
ALTER TABLE github_search_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaign results"
    ON github_search_results FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert results for their campaigns"
    ON github_search_results FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update their own results"
    ON github_search_results FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own results"
    ON github_search_results FOR DELETE
    USING (user_id = auth.uid());
