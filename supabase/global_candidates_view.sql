-- ═══════════════════════════════════════════════════════════════════════════════
-- GLOBAL EMAIL CANDIDATES VIEW
-- Unifies candidates from LinkedIn, GitHub, and Marketplace for Gmail Outreach.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.global_email_candidates;

CREATE VIEW public.global_email_candidates AS
-- 1️⃣ LINKEDIN CANDIDATES
SELECT 
    id as candidate_id,
    'LinkedIn' as source_platform,
    full_name as name,
    email,
    linkedin_url as profile_url,
    job_title as current_role,
    created_at
FROM public.candidates
WHERE email IS NOT NULL AND email != ''

UNION ALL

-- 2️⃣ GITHUB CANDIDATES
SELECT 
    id as candidate_id,
    'GitHub' as source_platform,
    COALESCE(github_metrics->>'name', github_username) as name,
    email,
    github_url as profile_url,
    'Developer' as current_role,
    created_at
FROM public.github_candidates
WHERE email IS NOT NULL AND email != ''

UNION ALL

-- 3️⃣ MARKETPLACE CANDIDATES (Upwork/Fiverr) 
SELECT 
    id as candidate_id,
    platform as source_platform,
    name,
    email,
    platform_data->>'profile_url' as profile_url,
    'Freelancer' as current_role,
    added_at as created_at
FROM public.marketplace_candidates
WHERE email IS NOT NULL AND email != '';

-- Grant access to authenticated users
GRANT SELECT ON public.global_email_candidates TO authenticated;
