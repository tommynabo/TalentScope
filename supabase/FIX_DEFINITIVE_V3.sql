-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX DEFINITIVO v3: Resuelve FK constraints + UUID type mismatch
-- 
-- INSTRUCCIONES: Pega TODO esto en el SQL Editor de Supabase → Run
-- 
-- PROBLEMAS RESUELTOS:
-- 1. Foreign key campaign_id → campaigns(id) BLOQUEABA todos los inserts
--    porque las campañas GitHub están en campaigns_github, no en campaigns
-- 2. Foreign key user_id → profiles(id) podía bloquear si no hay perfil
-- 3. RPC function casteaba campaign_id como TEXT pero la columna es UUID
-- ═══════════════════════════════════════════════════════════════════════════════


-- =====================================================================
-- PASO 1: ELIMINAR FOREIGN KEYS QUE BLOQUEAN INSERTS
-- Esta es la causa raíz de todos los errores 409
-- =====================================================================

-- FK campaign_id → campaigns(id) - INCORRECTO, debería ser campaigns_github
ALTER TABLE public.github_search_results 
    DROP CONSTRAINT IF EXISTS github_search_results_campaign_id_fkey;

-- FK user_id → profiles(id) - puede bloquear si no hay perfil creado
ALTER TABLE public.github_search_results 
    DROP CONSTRAINT IF EXISTS github_search_results_user_id_fkey;

-- Verificar que se eliminaron
DO $$
DECLARE
    fk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE table_name = 'github_search_results'
      AND constraint_type = 'FOREIGN KEY';
    
    RAISE NOTICE 'Foreign keys restantes en github_search_results: %', fk_count;
    
    IF fk_count > 0 THEN
        -- Eliminar CUALQUIER FK restante en la tabla
        DECLARE
            fk_name TEXT;
        BEGIN
            FOR fk_name IN 
                SELECT constraint_name 
                FROM information_schema.table_constraints
                WHERE table_name = 'github_search_results'
                  AND constraint_type = 'FOREIGN KEY'
            LOOP
                EXECUTE format('ALTER TABLE public.github_search_results DROP CONSTRAINT IF EXISTS %I', fk_name);
                RAISE NOTICE 'Dropped FK: %', fk_name;
            END LOOP;
        END;
    END IF;
END $$;


-- =====================================================================
-- PASO 2: Asegurar que campaign_id es UUID (no TEXT)
-- =====================================================================

-- Si por algún motivo la columna es TEXT, convertirla a UUID
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'github_search_results' 
      AND column_name = 'campaign_id';
    
    RAISE NOTICE 'campaign_id type: %', col_type;
    
    IF col_type = 'text' OR col_type = 'character varying' THEN
        -- Remove constraints that depend on campaign_id first
        ALTER TABLE public.github_search_results 
            DROP CONSTRAINT IF EXISTS github_search_results_campaign_id_github_username_key;
        
        -- Convert to UUID
        ALTER TABLE public.github_search_results 
            ALTER COLUMN campaign_id TYPE UUID USING campaign_id::uuid;
        
        -- Re-add unique constraint
        ALTER TABLE public.github_search_results 
            ADD CONSTRAINT github_search_results_campaign_id_github_username_key 
            UNIQUE(campaign_id, github_username);
        
        RAISE NOTICE 'Converted campaign_id from % to UUID', col_type;
    END IF;
END $$;


-- =====================================================================
-- PASO 3: Asegurar UNIQUE constraint existe
-- =====================================================================

ALTER TABLE public.github_search_results 
    DROP CONSTRAINT IF EXISTS github_search_results_campaign_id_github_username_key;

-- Limpiar duplicados antes de crear constraint
DELETE FROM public.github_search_results a
USING public.github_search_results b
WHERE a.campaign_id = b.campaign_id
  AND a.github_username = b.github_username
  AND a.created_at < b.created_at;

ALTER TABLE public.github_search_results 
    ADD CONSTRAINT github_search_results_campaign_id_github_username_key 
    UNIQUE(campaign_id, github_username);


-- =====================================================================
-- PASO 4: Asegurar columnas extra existen
-- =====================================================================

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
-- PASO 5: RLS - Políticas simples y permisivas
-- =====================================================================

ALTER TABLE public.github_search_results ENABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas existentes para empezar limpio
DROP POLICY IF EXISTS "Users can view own github results" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can insert own github results" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can update own github results" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can delete own github results" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can view their own campaign results" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can insert results for their campaigns" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can update their own results" ON public.github_search_results;
DROP POLICY IF EXISTS "Users can delete their own results" ON public.github_search_results;

-- Crear políticas simples (sin sub-queries a otras tablas)
CREATE POLICY "github_results_select" ON public.github_search_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "github_results_insert" ON public.github_search_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "github_results_update" ON public.github_search_results
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "github_results_delete" ON public.github_search_results
    FOR DELETE USING (auth.uid() = user_id);


-- =====================================================================
-- PASO 6: FUNCIÓN RPC CORREGIDA (campaign_id como UUID)
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
        (candidate_data->>'campaign_id')::uuid,     -- ← UUID cast (was missing!)
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

GRANT EXECUTE ON FUNCTION public.upsert_github_candidate(jsonb) TO authenticated;


-- =====================================================================
-- PASO 7: Vista global_email_candidates
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
-- PASO 8: Forzar recarga de schema cache
-- =====================================================================

NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- VERIFICACIÓN FINAL
-- =====================================================================

-- Mostrar FK constraints restantes (debería ser 0)
SELECT 
    'FK constraints' AS check_type,
    constraint_name AS detail
FROM information_schema.table_constraints
WHERE table_name = 'github_search_results'
  AND constraint_type = 'FOREIGN KEY';

-- Mostrar tipo de campaign_id (debería ser uuid)
SELECT 
    'campaign_id type' AS check_type,
    data_type AS detail
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'github_search_results' 
  AND column_name = 'campaign_id';

-- Contar registros
SELECT 'github_search_results (total)' AS tabla, COUNT(*)::text AS registros 
FROM public.github_search_results
UNION ALL
SELECT 'campaigns_github (total)', COUNT(*)::text 
FROM public.campaigns_github
UNION ALL
SELECT 'global_email_candidates (vista)', COUNT(*)::text 
FROM public.global_email_candidates;
