-- ============================================================================
-- CAMPAIGNS TABLE - LINKEDIN ONLY
-- Separate from GitHub campaigns (campaigns_github)
-- ============================================================================

-- Add platform constraint if not exists
-- Ensure campaigns table only contains LinkedIn campaigns

-- Drop existing constraint if present
ALTER TABLE public.campaigns 
DROP CONSTRAINT IF EXISTS campaigns_platform_check;

-- Add new constraint to ensure platform is always 'LinkedIn'
ALTER TABLE public.campaigns 
ADD CONSTRAINT campaigns_platform_check CHECK (platform = 'LinkedIn' OR platform IS NULL);

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS campaigns_platform_idx ON public.campaigns(platform);

-- Note: Existing LinkedIn campaigns should already be in this table
-- GitHub campaigns should all go to campaigns_github table
-- Any existing GitHub campaigns in campaigns table should be migrated manually via Supabase UI if needed
