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

-- 2️⃣ GITHUB CANDIDATES: using github_search_results table
SELECT 
    id as candidate_id,
    'GitHub' as source_platform,
    COALESCE(github_metrics->>'name', github_username) as name,
    email,
    github_url as profile_url,
    'Developer' as current_role,
    created_at
FROM public.github_search_results
WHERE email IS NOT NULL AND email != ''

UNION ALL

-- 3️⃣ MARKETPLACE CANDIDATES (Upwork/Fiverr) 
SELECT 
    mc.id as candidate_id,
    cmp.platform as source_platform,
    mc.name,
    mc.email,
    mc.platform_data->>'profile_url' as profile_url,
    'Freelancer' as current_role,
    mc.added_at as created_at
FROM public.marketplace_candidates mc
JOIN public.marketplace_campaigns cmp ON mc.campaign_id = cmp.id
WHERE mc.email IS NOT NULL AND mc.email != '';

GRANT SELECT ON public.global_email_candidates TO authenticated;
