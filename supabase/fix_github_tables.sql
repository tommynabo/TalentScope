-- FIX GitHub Search Results Table
-- 1. Ensure table exists with correct name matching the code (github_search_results)
-- 2. Ensure all columns exist
-- 3. Ensure created_at has default now()

CREATE TABLE IF NOT EXISTS github_search_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    github_username TEXT NOT NULL,
    github_url TEXT,
    github_id INTEGER,
    github_metrics JSONB, -- Stores the full object
    
    -- Extracted columns for easy querying/display
    email TEXT,
    linkedin_url TEXT,
    score INTEGER,
    
    -- AI Analysis Columns
    analysis_psychological TEXT,
    analysis_business TEXT,
    analysis_sales_angle TEXT,
    analysis_bottleneck TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    UNIQUE(campaign_id, github_username)
);

-- Add AI columns if they don't exist (for existing tables)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_search_results' AND column_name = 'analysis_psychological') THEN
        ALTER TABLE github_search_results ADD COLUMN analysis_psychological TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_search_results' AND column_name = 'analysis_business') THEN
        ALTER TABLE github_search_results ADD COLUMN analysis_business TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_search_results' AND column_name = 'analysis_sales_angle') THEN
        ALTER TABLE github_search_results ADD COLUMN analysis_sales_angle TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'github_search_results' AND column_name = 'analysis_bottleneck') THEN
        ALTER TABLE github_search_results ADD COLUMN analysis_bottleneck TEXT;
    END IF;

    -- Ensure RLS is enabled or policies exist if needed
    -- For now, we assume public/authenticated access is handled by application logic or existing policies
    -- But we explicitly allow authenticated users to view/insert
    
    -- Enable RLS
    ALTER TABLE github_search_results ENABLE ROW LEVEL SECURITY;

END $$;

-- Policy: Users can see their own campaign results
DROP POLICY IF EXISTS "Users can view own github results" ON github_search_results;
CREATE POLICY "Users can view own github results" ON github_search_results
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert/update their own results
DROP POLICY IF EXISTS "Users can insert own github results" ON github_search_results;
CREATE POLICY "Users can insert own github results" ON github_search_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own github results" ON github_search_results;
CREATE POLICY "Users can update own github results" ON github_search_results
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own github results" ON github_search_results;
CREATE POLICY "Users can delete own github results" ON github_search_results
    FOR DELETE USING (auth.uid() = user_id);
