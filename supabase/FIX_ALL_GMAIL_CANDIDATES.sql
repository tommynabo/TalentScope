-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX COMPLETO: Gmail Buzones > Candidatos
-- 
-- INSTRUCCIONES: Copia TODO este script y pégalo en el SQL Editor de Supabase
-- (https://supabase.com/dashboard → tu proyecto → SQL Editor → New Query → Pegar → Run)
-- 
-- Este script arregla:
-- 1. La tabla github_search_results (columnas faltantes + constraint única)
-- 2. La vista global_email_candidates (para que busque en la tabla correcta)
-- 3. Las políticas RLS para que los usuarios autenticados puedan leer/escribir
-- ═══════════════════════════════════════════════════════════════════════════════

-- =====================================================================
-- PASO 1: Asegurar que la tabla github_search_results existe y tiene
--         TODAS las columnas que el código necesita
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

-- Añadir columnas que podrían faltar en tablas existentes
DO $$ 
BEGIN 
    -- AI Analysis Columns
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
    -- Outreach Columns
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
-- PASO 2: ARREGLAR la constraint UNIQUE que causa el Error 409
--         Primero limpiamos duplicados que violan la constraint
-- =====================================================================

-- 2a. Eliminar filas duplicadas (campaign_id, github_username), dejando solo la más reciente
DELETE FROM public.github_search_results a
USING public.github_search_results b
WHERE a.campaign_id = b.campaign_id
  AND a.github_username = b.github_username
  AND a.created_at < b.created_at;

-- 2b. Borrar cualquier constraint vieja que pueda estar corrupta
ALTER TABLE public.github_search_results 
    DROP CONSTRAINT IF EXISTS github_search_results_campaign_id_github_username_key;

ALTER TABLE public.github_search_results 
    DROP CONSTRAINT IF EXISTS github_search_results_unique_campaign_username;

-- 2c. Crear la constraint limpia
ALTER TABLE public.github_search_results 
    ADD CONSTRAINT github_search_results_campaign_id_github_username_key 
    UNIQUE(campaign_id, github_username);


-- =====================================================================
-- PASO 3: Habilitar RLS y crear políticas de acceso
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
-- PASO 4: RECREAR la vista global_email_candidates
--         Apuntando a github_search_results (NO github_candidates)
--         + usando COALESCE para extraer email de JSONB
-- =====================================================================

DROP VIEW IF EXISTS public.global_email_candidates;

CREATE VIEW public.global_email_candidates AS

-- 1) LINKEDIN CANDIDATES
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

-- 2) GITHUB CANDIDATES (from github_search_results, NOT github_candidates)
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

-- 3) MARKETPLACE CANDIDATES (Upwork/Fiverr)
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

-- Permitir que usuarios autenticados lean la vista
GRANT SELECT ON public.global_email_candidates TO authenticated;


-- =====================================================================
-- VERIFICACIÓN: Muestra cuántos registros hay en cada fuente
-- =====================================================================
SELECT 'github_search_results (total)' AS tabla, COUNT(*) AS registros FROM public.github_search_results
UNION ALL
SELECT 'github_search_results (con email)', COUNT(*) FROM public.github_search_results 
    WHERE (email IS NOT NULL AND email != '') OR (github_metrics->>'mentioned_email' IS NOT NULL AND github_metrics->>'mentioned_email' != '')
UNION ALL
SELECT 'global_email_candidates (vista)', COUNT(*) FROM public.global_email_candidates;
