-- ═══════════════════════════════════════════════════════════════════════════════
-- MARKETPLACE → BUZONES CANDIDATOS: Conecta marketplace con Gmail pipeline
-- 
-- INSTRUCCIONES: Pega TODO esto en el SQL Editor de Supabase → Run
-- 
-- QUÉ HACE:
-- 1. Crea/asegura tablas marketplace_campaigns y marketplace_candidates
-- 2. Sin foreign keys restrictivas (mismo patrón que GitHub)
-- 3. Crea función RPC para upsert robusto
-- 4. Políticas RLS simples
-- 5. Actualiza vista global_email_candidates para incluir marketplace
-- ═══════════════════════════════════════════════════════════════════════════════


-- =====================================================================
-- PASO 1: Tabla marketplace_campaigns
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL DEFAULT 'Upwork',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    search_terms JSONB DEFAULT '{}'::jsonb,
    total_candidates INT DEFAULT 0,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Eliminar FK restrictivas si existen
ALTER TABLE public.marketplace_campaigns 
    DROP CONSTRAINT IF EXISTS marketplace_campaigns_user_id_fkey;

-- Indices
CREATE INDEX IF NOT EXISTS idx_marketplace_campaigns_user ON public.marketplace_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_campaigns_platform ON public.marketplace_campaigns(platform);


-- =====================================================================
-- PASO 2: Tabla marketplace_candidates (adaptada para Gmail pipeline)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    linkedin_url TEXT,
    platform VARCHAR(50) DEFAULT 'Upwork',
    hourly_rate DECIMAL(8,2) DEFAULT 0,
    job_success_rate DECIMAL(5,2) DEFAULT 0,
    talent_score INTEGER DEFAULT 0,
    kanban_lane VARCHAR(50) DEFAULT 'todo',
    platform_data JSONB,
    notes TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Eliminar FK restrictivas si existen
ALTER TABLE public.marketplace_candidates 
    DROP CONSTRAINT IF EXISTS marketplace_candidates_campaign_id_fkey;

-- Agregar columnas que pueden faltar (si tabla ya existía con schema viejo)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marketplace_candidates' AND column_name='user_id') THEN
        ALTER TABLE public.marketplace_candidates ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marketplace_candidates' AND column_name='platform') THEN
        ALTER TABLE public.marketplace_candidates ADD COLUMN platform VARCHAR(50) DEFAULT 'Upwork';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marketplace_candidates' AND column_name='talent_score') THEN
        ALTER TABLE public.marketplace_candidates ADD COLUMN talent_score INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marketplace_candidates' AND column_name='platform_data') THEN
        ALTER TABLE public.marketplace_candidates ADD COLUMN platform_data JSONB;
    END IF;
END $$;

-- Indices
CREATE INDEX IF NOT EXISTS idx_marketplace_candidates_campaign ON public.marketplace_candidates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_candidates_email ON public.marketplace_candidates(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_candidates_user ON public.marketplace_candidates(user_id);


-- =====================================================================
-- PASO 3: UNIQUE constraint para dedup
-- =====================================================================

-- Limpiar duplicados
DELETE FROM public.marketplace_candidates a
USING public.marketplace_candidates b
WHERE a.campaign_id = b.campaign_id
  AND a.name = b.name
  AND a.added_at < b.added_at;

ALTER TABLE public.marketplace_candidates 
    DROP CONSTRAINT IF EXISTS marketplace_candidates_campaign_id_name_key;

ALTER TABLE public.marketplace_candidates 
    ADD CONSTRAINT marketplace_candidates_campaign_id_name_key 
    UNIQUE(campaign_id, name);


-- =====================================================================
-- PASO 4: RLS Políticas simples
-- =====================================================================

ALTER TABLE public.marketplace_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_candidates ENABLE ROW LEVEL SECURITY;

-- Campaigns
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.marketplace_campaigns;
DROP POLICY IF EXISTS "Users can create campaigns" ON public.marketplace_campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.marketplace_campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.marketplace_campaigns;
DROP POLICY IF EXISTS "mp_campaigns_select" ON public.marketplace_campaigns;
DROP POLICY IF EXISTS "mp_campaigns_insert" ON public.marketplace_campaigns;
DROP POLICY IF EXISTS "mp_campaigns_update" ON public.marketplace_campaigns;
DROP POLICY IF EXISTS "mp_campaigns_delete" ON public.marketplace_campaigns;

CREATE POLICY "mp_campaigns_select" ON public.marketplace_campaigns
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mp_campaigns_insert" ON public.marketplace_campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mp_campaigns_update" ON public.marketplace_campaigns
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "mp_campaigns_delete" ON public.marketplace_campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- Candidates (simple, basado en user_id directo)
DROP POLICY IF EXISTS "Users can view candidates in own campaigns" ON public.marketplace_candidates;
DROP POLICY IF EXISTS "Users can create candidates in own campaigns" ON public.marketplace_candidates;
DROP POLICY IF EXISTS "Users can update candidates in own campaigns" ON public.marketplace_candidates;
DROP POLICY IF EXISTS "Users can delete candidates in own campaigns" ON public.marketplace_candidates;
DROP POLICY IF EXISTS "mp_candidates_select" ON public.marketplace_candidates;
DROP POLICY IF EXISTS "mp_candidates_insert" ON public.marketplace_candidates;
DROP POLICY IF EXISTS "mp_candidates_update" ON public.marketplace_candidates;
DROP POLICY IF EXISTS "mp_candidates_delete" ON public.marketplace_candidates;

CREATE POLICY "mp_candidates_select" ON public.marketplace_candidates
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mp_candidates_insert" ON public.marketplace_candidates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mp_candidates_update" ON public.marketplace_candidates
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "mp_candidates_delete" ON public.marketplace_candidates
    FOR DELETE USING (auth.uid() = user_id);


-- =====================================================================
-- PASO 5: FUNCIÓN RPC para upsert marketplace candidato
-- =====================================================================

DROP FUNCTION IF EXISTS public.upsert_marketplace_candidate(jsonb);

CREATE OR REPLACE FUNCTION public.upsert_marketplace_candidate(candidate_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.marketplace_candidates (
        campaign_id,
        user_id,
        name,
        email,
        linkedin_url,
        platform,
        hourly_rate,
        job_success_rate,
        talent_score,
        kanban_lane,
        platform_data,
        notes,
        updated_at
    ) VALUES (
        (candidate_data->>'campaign_id')::uuid,
        (candidate_data->>'user_id')::uuid,
        candidate_data->>'name',
        candidate_data->>'email',
        candidate_data->>'linkedin_url',
        candidate_data->>'platform',
        (candidate_data->>'hourly_rate')::decimal,
        (candidate_data->>'job_success_rate')::decimal,
        (candidate_data->>'talent_score')::integer,
        COALESCE(candidate_data->>'kanban_lane', 'todo'),
        candidate_data->'platform_data',
        candidate_data->>'notes',
        now()
    )
    ON CONFLICT (campaign_id, name)
    DO UPDATE SET
        email              = EXCLUDED.email,
        linkedin_url       = EXCLUDED.linkedin_url,
        platform           = EXCLUDED.platform,
        hourly_rate        = EXCLUDED.hourly_rate,
        job_success_rate   = EXCLUDED.job_success_rate,
        talent_score       = EXCLUDED.talent_score,
        kanban_lane        = EXCLUDED.kanban_lane,
        platform_data      = EXCLUDED.platform_data,
        notes              = EXCLUDED.notes,
        updated_at         = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_marketplace_candidate(jsonb) TO authenticated;


-- =====================================================================
-- PASO 6: Vista global_email_candidates ACTUALIZADA
-- Incluye LinkedIn + GitHub + Marketplace
-- =====================================================================

DROP VIEW IF EXISTS public.global_email_candidates;

CREATE VIEW public.global_email_candidates AS

-- LinkedIn candidates
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

-- GitHub candidates
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

-- Marketplace candidates (Upwork / Fiverr)
SELECT 
    mc.id AS candidate_id,
    mc.platform::text AS source_platform,
    mc.name,
    mc.email,
    COALESCE(mc.linkedin_url, mc.platform_data->>'profile_url') AS profile_url,
    'Freelancer'::text AS current_role,
    mc.added_at AS created_at
FROM public.marketplace_candidates mc
WHERE mc.email IS NOT NULL AND mc.email != '';

GRANT SELECT ON public.global_email_candidates TO authenticated;


-- =====================================================================
-- PASO 7: Forzar recarga schema cache PostgREST
-- =====================================================================

NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- VERIFICACIÓN FINAL
-- =====================================================================

SELECT 'marketplace_campaigns' AS tabla, COUNT(*)::text AS registros 
FROM public.marketplace_campaigns
UNION ALL
SELECT 'marketplace_candidates', COUNT(*)::text 
FROM public.marketplace_candidates
UNION ALL
SELECT 'marketplace_candidates (con email)', COUNT(*)::text 
FROM public.marketplace_candidates WHERE email IS NOT NULL AND email != ''
UNION ALL
SELECT 'github_search_results', COUNT(*)::text 
FROM public.github_search_results
UNION ALL
SELECT 'global_email_candidates (vista)', COUNT(*)::text 
FROM public.global_email_candidates;
