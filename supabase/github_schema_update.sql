-- Migration to add Analysis and Contact fields to GitHub Candidates
-- Run this in Supabase SQL Editor

-- 1. Ensure the github_candidates table exists (or update existing candidates table if unified)
-- Assuming 'candidates' table is unified, we add columns if they don't exist.

DO $$ 
BEGIN 
    -- Add linked_in and email if not present (usually present in candidates table)
    -- But if we are storing github specific data in a jsonb column, we might need to extract them.
    -- The user asked to "accumulate data there", implying a column.

    -- Add Analysis Columns for the 4-Card Layout
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'analysis_psychological') THEN
        ALTER TABLE candidates ADD COLUMN analysis_psychological TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'analysis_business') THEN
        ALTER TABLE candidates ADD COLUMN analysis_business TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'analysis_sales_angle') THEN
        ALTER TABLE candidates ADD COLUMN analysis_sales_angle TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidates' AND column_name = 'analysis_bottleneck') THEN
        ALTER TABLE candidates ADD COLUMN analysis_bottleneck TEXT;
    END IF;

    -- Ensure creation date default
    ALTER TABLE candidates ALTER COLUMN created_at SET DEFAULT now();

END $$;
