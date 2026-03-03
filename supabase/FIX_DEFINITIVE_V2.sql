-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX DEFINITIVO v2: Resuelve Error 409 + Schema Cache + Gmail Candidatos
-- 
-- INSTRUCCIONES: Pega TODO esto en el SQL Editor de Supabase → Run
-- 
-- Cambios respecto al script anterior:
-- 1. Crea una función RPC (upsert_github_candidate) que el código TS llamará
--    directamente, evitando el cache de PostgREST que causa el Error 409
-- 2. Fuerza recarga del schema cache de PostgREST
-- 3. Recrea la vista global_email_candidates
-- ═══════════════════════════════════════════════════════════════════════════════


-- =====================================================================
-- PASO 1: Asegurar tabla + columnas (idempotente)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.github_search_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    github_username TEXT NOT NULL,
    github_url TEXT,
    github_id INTEGER,
    github_metrics JSONB,
    email TEXT,
    linkedin_url TEXT,
    score INTEGER,
    analysis_psychological TEXT,
    analysis_business TEXT,
    analysis_sales_angle TEXT,
    analysis_bottleneck TEXT,
    outreach_icebreaker TEXT,
    outreach_pitch TEXT,
    outreach_followup TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='github_search_results' AND column_name='analysis_psychological') THEN
        ALTER TABLE public.github_search_results ADD COLUMN analysis_psychological TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='github_search_results' AND column_name='analysis_business') THEN
        ALTER TABLE public.github_search_results ADD COLUMN analysis_business TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='github_search_results' AND column_name='analysis_sales_angle') THEN
        ALTER TABLE public.github_search_results ADD COLUMN analysis_sales_angle TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='github_search_results' AND column_name='analysis_bottleneck') THEN
        ALTER TABLE public.github_search_results ADD COLUMN analysis_bottleneck TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='github_search_results' AND column_name='outreach_icebreaker') THEN
        ALTER TABLE public.github_search_results ADD COLUMN outreach_icebreaker TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='github_search_results' AND column_name='outreach_pitch') THEN
        ALTER TABLE public.github_search_results ADD COLUMN outreach_pitch TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='github_search_results' AND column_name='outreach_followup') THEN
        ALTER TABLE public.github_search_results ADD COLUMN outreach_followup TEXT;
    END IF;
END $$;


-- =====================================================================
-- PASO 2: Limpiar duplicados y forzar constraint
-- =====================================================================

DELETE FROM public.github_search_results a
USING public.github_search_results b
WHERE a.campaign_id = b.campaign_id
  AND a.github_username = b.github_username
  AND a.created_at < b.created_at;

ALTER TABLE public.github_search_results 
    DROP CONSTRAINT IF EXISTS github_search_results_campaign_id_github_username_key;
ALTER TABLE public.github_search_results 
    DROP CONSTRAINT IF EXISTS github_search_results_unique_campaign_username;

ALTER TABLE public.github_search_results 
    ADD CONSTRAINT github_search_results_campaign_id_github_username_key 
    UNIQUE(campaign_id, github_username);


-- =====================================================================
-- PASO 3: RLS
-- =====================================================================

ALTER TABLE public.github_search_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own github results" ON public.github_search_results;
CREATE POLICY "Users can view own github results" ON public.github_search_results
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own github results" ON public.github_search_results;
CREATE POLICY "Users can insert own github results" ON public.github_search_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own github results" ON public.github_search_results;
CREATE POLICY "Users can update own github results" ON public.github_search_results
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own github results" ON public.github_search_results;
CREATE POLICY "Users can delete own github results" ON public.github_search_results
    FOR DELETE USING (auth.uid() = user_id);


-- =====================================================================
-- PASO 4: FUNCIÓN RPC para UPSERT (evita el cache de PostgREST)
-- Esta función se llama directamente desde el código TypeScript
-- y ejecuta INSERT ... ON CONFLICT UPDATE dentro de PostgreSQL,
-- sin depender de que PostgREST conozca la constraint.
-- =====================================================================

DROP FUNCTION IF EXISTS public.upsert_github_candidate(jsonb);

CREATE OR REPLACE FUNCTION public.upsert_github_candidate(candidate_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.github_search_results (
        campaign_id,
        user_id,
        github_username,
        github_url,
        github_id,
        github_metrics,
        email,
        linkedin_url,
        score,
        analysis_psychological,
        analysis_business,
        analysis_sales_angle,
        analysis_bottleneck,
        outreach_icebreaker,
        outreach_pitch,
        outreach_followup,
        updated_at
    ) VALUES (
        candidate_data->>'campaign_id',
        (candidate_data->>'user_id')::uuid,
        candidate_data->>'github_username',
        candidate_data->>'github_url',
        (candidate_data->>'github_id')::integer,
        candidate_data->'github_metrics',
        candidate_data->>'email',
        candidate_data->>'linkedin_url',
        (candidate_data->>'score')::integer,
        candidate_data->>'analysis_psychological',
        candidate_data->>'analysis_business',
        candidate_data->>'analysis_sales_angle',
        candidate_data->>'analysis_bottleneck',
        candidate_data->>'outreach_icebreaker',
        candidate_data->>'outreach_pitch',
        candidate_data->>'outreach_followup',
        now()
    )
    ON CONFLICT (campaign_id, github_username)
    DO UPDATE SET
        github_url          = EXCLUDED.github_url,
        github_id           = EXCLUDED.github_id,
        github_metrics      = EXCLUDED.github_metrics,
        email               = EXCLUDED.email,
        linkedin_url        = EXCLUDED.linkedin_url,
        score               = EXCLUDED.score,
        analysis_psychological = EXCLUDED.analysis_psychological,
        analysis_business      = EXCLUDED.analysis_business,
        analysis_sales_angle   = EXCLUDED.analysis_sales_angle,
        analysis_bottleneck    = EXCLUDED.analysis_bottleneck,
        outreach_icebreaker    = EXCLUDED.outreach_icebreaker,
        outreach_pitch         = EXCLUDED.outreach_pitch,
        outreach_followup      = EXCLUDED.outreach_followup,
        updated_at             = now();
END;
$$;

-- Permitir que usuarios autenticados llamen la función
GRANT EXECUTE ON FUNCTION public.upsert_github_candidate(jsonb) TO authenticated;


-- =====================================================================
-- PASO 5: Vista global_email_candidates
-- =====================================================================

DROP VIEW IF EXISTS public.global_email_candidates;

CREATE VIEW public.global_email_candidates AS
SELECT 
    id AS candidate_id,
    'LinkedIn'::text AS source_platform,
    full_name AS name,
    email,
    linkedin_url AS profile_url,
    job_title AS current_role,
    created_at
FROM public.candidates
WHERE email IS NOT NULL AND email != ''

UNION ALL

SELECT 
    id AS candidate_id,
    'GitHub'::text AS source_platform,
    COALESCE(github_metrics->>'name', github_username) AS name,
    COALESCE(email, github_metrics->>'mentioned_email') AS email,
    github_url AS profile_url,
    'Developer'::text AS current_role,
    created_at
FROM public.github_search_results
WHERE (email IS NOT NULL AND email != '') 
   OR (github_metrics->>'mentioned_email' IS NOT NULL AND github_metrics->>'mentioned_email' != '')

UNION ALL

SELECT 
    mc.id AS candidate_id,
    cmp.platform::text AS source_platform,
    mc.name,
    mc.email,
    mc.platform_data->>'profile_url' AS profile_url,
    'Freelancer'::text AS current_role,
    mc.added_at AS created_at
FROM public.marketplace_candidates mc
JOIN public.marketplace_campaigns cmp ON mc.campaign_id = cmp.id
WHERE mc.email IS NOT NULL AND mc.email != '';

GRANT SELECT ON public.global_email_candidates TO authenticated;


-- =====================================================================
-- PASO 6: FORZAR recarga del schema cache de PostgREST
-- =====================================================================

NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================

SELECT 'github_search_results (total)' AS tabla, COUNT(*) AS registros FROM public.github_search_results
UNION ALL
SELECT 'github_search_results (con email)', COUNT(*) FROM public.github_search_results 
    WHERE (email IS NOT NULL AND email != '') OR (github_metrics->>'mentioned_email' IS NOT NULL AND github_metrics->>'mentioned_email' != '')
UNION ALL
SELECT 'global_email_candidates (vista)', COUNT(*) FROM public.global_email_candidates;
