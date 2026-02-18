-- ═══════════════════════════════════════════════════════════════════════════════
-- SAFE MIGRATION: Add outreach message columns to github_search_results
-- Run this if you already have data in github_search_results table
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add message columns if they don't exist
ALTER TABLE public.github_search_results
ADD COLUMN IF NOT EXISTS outreach_icebreaker TEXT,
ADD COLUMN IF NOT EXISTS outreach_pitch TEXT,
ADD COLUMN IF NOT EXISTS outreach_followup TEXT;

-- ✅ Done! Messages can now be saved to github_search_results table

-- Verification query:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'github_search_results' 
-- AND column_name LIKE 'outreach%';
