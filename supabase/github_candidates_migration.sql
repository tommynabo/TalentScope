-- GitHub Candidates Table
-- Stores all GitHub profiles discovered through GitHub Code Scan

CREATE TABLE IF NOT EXISTS github_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Basic GitHub Info
    github_username VARCHAR(255) NOT NULL UNIQUE,
    github_url VARCHAR(500) NOT NULL,
    github_id BIGINT,
    
    -- Repository Metrics
    public_repos INT DEFAULT 0,
    followers INT DEFAULT 0,
    following INT DEFAULT 0,
    total_stars_received INT DEFAULT 0,
    average_repo_stars DECIMAL(10, 2) DEFAULT 0,
    
    -- Code Analysis
    original_repos_count INT DEFAULT 0,
    fork_repos_count INT DEFAULT 0,
    originality_ratio DECIMAL(5, 2) DEFAULT 0, -- 0-100%
    
    total_commits INT DEFAULT 0,
    contribution_streak INT DEFAULT 0, -- days of active commits
    last_commit_date TIMESTAMP,
    most_used_language VARCHAR(100),
    
    -- Critical Signal: App Store Presence
    has_app_store_link BOOLEAN DEFAULT FALSE,
    app_store_url VARCHAR(500),
    
    -- Enrichment
    pinned_repos_count INT DEFAULT 0,
    open_source_contributions INT DEFAULT 0,
    mentioned_email VARCHAR(255),
    personal_website VARCHAR(500),
    
    -- Scoring
    github_score INT DEFAULT 0, -- 0-100
    score_breakdown JSONB DEFAULT '{}'::jsonb, -- Contains all score components
    
    -- Additional metadata
    github_profile_data JSONB DEFAULT '{}'::jsonb, -- Full response cached
    identified_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- For linking to candidates table if enriched
    candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_github_candidates_campaign ON github_candidates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_github_candidates_score ON github_candidates(github_score DESC);
CREATE INDEX IF NOT EXISTS idx_github_candidates_username ON github_candidates(github_username);
CREATE INDEX IF NOT EXISTS idx_github_candidates_app_store ON github_candidates(has_app_store_link);
CREATE INDEX IF NOT EXISTS idx_github_candidates_created ON github_candidates(created_at DESC);

-- Table for storing repository analysis
CREATE TABLE IF NOT EXISTS github_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_candidate_id UUID REFERENCES github_candidates(id) ON DELETE CASCADE,
    
    repo_name VARCHAR(255) NOT NULL,
    repo_url VARCHAR(500) NOT NULL,
    
    -- Metrics
    stars INT DEFAULT 0,
    forks INT DEFAULT 0,
    is_fork BOOLEAN DEFAULT FALSE,
    language VARCHAR(100),
    description TEXT,
    
    -- Activity
    last_commit_date TIMESTAMP,
    commits_count INT DEFAULT 0,
    contributors_count INT DEFAULT 0,
    
    -- App Store signal
    has_store_link BOOLEAN DEFAULT FALSE,
    store_urls TEXT[], -- Array of Play Store / App Store links
    
    -- Content analysis
    readme_content TEXT,
    has_app_published BOOLEAN DEFAULT FALSE,
    
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_repos_candidate ON github_repositories(github_candidate_id);
CREATE INDEX IF NOT EXISTS idx_github_repos_stars ON github_repositories(stars DESC);
CREATE INDEX IF NOT EXISTS idx_github_repos_store_link ON github_repositories(has_store_link);

-- Campaign Settings for GitHub Scraper
-- Extends the campaigns.settings JSONB with GitHub-specific criteria
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS github_filter_criteria JSONB DEFAULT '{}'::jsonb;

-- Example structure for github_filter_criteria:
-- {
--   "min_stars": 50,
--   "max_stars": 10000,
--   "min_forks": 0,
--   "languages": ["dart", "flutter", "typescript"],
--   "min_public_repos": 5,
--   "min_followers": 10,
--   "min_contributions_per_month": 5,
--   "min_originality_ratio": 30,
--   "exclude_generic_repos": true,
--   "require_recent_activity": true,
--   "max_months_since_last_commit": 6,
--   "require_app_store_link": false,
--   "locations": ["Spain", "Barcelona"],
--   "available_for_hire": true,
--   "score_threshold": 60
-- }

-- View: Top GitHub Candidates by Score
CREATE OR REPLACE VIEW top_github_candidates AS
SELECT 
    gc.id,
    gc.github_username,
    gc.github_url,
    gc.followers,
    gc.original_repos_count,
    gc.total_stars_received,
    gc.github_score,
    gc.has_app_store_link,
    c.title as campaign_title,
    gc.created_at
FROM github_candidates gc
LEFT JOIN campaigns c ON gc.campaign_id = c.id
WHERE gc.github_score >= 70
ORDER BY gc.github_score DESC
LIMIT 100;

-- View: GitHub Campaign Statistics
CREATE OR REPLACE VIEW github_campaign_stats AS
SELECT 
    c.id as campaign_id,
    c.title,
    COUNT(gc.id) as total_candidates,
    COUNT(CASE WHEN gc.github_score >= 80 THEN 1 END) as excellent_match,
    COUNT(CASE WHEN gc.has_app_store_link THEN 1 END) as with_app_store,
    AVG(gc.github_score) as avg_score,
    MAX(gc.github_score) as max_score,
    COUNT(CASE WHEN gc.mentioned_email IS NOT NULL THEN 1 END) as with_email
FROM campaigns c
LEFT JOIN github_candidates gc ON c.id = gc.campaign_id
GROUP BY c.id, c.title;

-- RLS Policies for GitHub tables (if you use multi-tenant setup)
ALTER TABLE github_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY github_candidates_user_access ON github_candidates
    FOR SELECT USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE user_id = auth.uid()
        )
    );

CREATE POLICY github_candidates_insert ON github_candidates
    FOR INSERT WITH CHECK (
        campaign_id IN (
            SELECT id FROM campaigns WHERE user_id = auth.uid()
        )
    );

CREATE POLICY github_repositories_user_access ON github_repositories
    FOR SELECT USING (
        github_candidate_id IN (
            SELECT id FROM github_candidates WHERE campaign_id IN (
                SELECT id FROM campaigns WHERE user_id = auth.uid()
            )
        )
    );
