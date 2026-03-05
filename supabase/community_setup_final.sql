-- ============================================================================
-- COMMUNITY CANDIDATES - SETUP & VERIFICATION SCRIPT
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1️⃣ CREAR/ACTUALIZAR LA VISTA GLOBAL DE EMAILS
-- (Si aun no se ha ejecutado update_global_email_view.sql)

DROP VIEW IF EXISTS public.global_email_candidates CASCADE;

CREATE VIEW public.global_email_candidates AS
-- LINKEDIN CANDIDATES
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

-- GITHUB CANDIDATES
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

-- MARKETPLACE CANDIDATES
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
WHERE mc.email IS NOT NULL AND mc.email != ''

UNION ALL

-- COMMUNITY CANDIDATES (Discord/Reddit/Skool/GitHubDiscussions)
SELECT 
    cc.id as candidate_id,
    cc.platform as source_platform,
    COALESCE(cc.display_name, cc.username) as name,
    cc.email,
    cc.profile_url,
    'Community Member' as current_role,
    cc.created_at
FROM public.community_candidates cc
WHERE cc.email IS NOT NULL AND cc.email != '';

-- Grant access to authenticated users
GRANT SELECT ON public.global_email_candidates TO authenticated;

-- 2️⃣ VERIFICACIONES DE ESTRUCTURA

-- Verificar que community_candidates existe y tiene los campos necesarios
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'community_candidates'
    ) THEN
        RAISE NOTICE '✅ Table community_candidates exists';
        
        -- Listar columnas
        SELECT STRING_AGG(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
        INTO NULL
        FROM information_schema.columns
        WHERE table_name = 'community_candidates';
        
    ELSE
        RAISE NOTICE '❌ Table community_candidates does NOT exist!';
    END IF;
END $$;

-- 3️⃣ VERIFICAR DATOS EN LA VISTA

-- Count de candidatos por plataforma
SELECT 
    source_platform,
    COUNT(*) as total_candidates,
    COUNT(DISTINCT candidate_id) as unique_candidates,
    MAX(created_at) as latest,
    MIN(created_at) as oldest
FROM global_email_candidates
GROUP BY source_platform
ORDER BY source_platform;

-- Últimos candidatos agregados
SELECT 
    candidate_id,
    name,
    source_platform,
    email,
    profile_url,
    created_at
FROM global_email_candidates
ORDER BY created_at DESC
LIMIT 10;

-- Candidatos de COMUNIDADES específicamente
SELECT 
    candidate_id,
    name,
    source_platform,
    email,
    profile_url,
    created_at
FROM global_email_candidates
WHERE source_platform IN ('Discord', 'Reddit', 'Skool', 'GitHubDiscussions')
ORDER BY created_at DESC;

-- 4️⃣ ÍNDICES PARA PERFORMANCE (Opcional pero recomendado)

-- Si existen candidatos muchos, crear índices
CREATE INDEX IF NOT EXISTS idx_community_candidates_email 
ON community_candidates(email) 
WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_candidates_campaign 
ON community_candidates(campaign_id);

CREATE INDEX IF NOT EXISTS idx_global_email_candidates_platform 
ON global_email_candidates(source_platform);

-- 5️⃣ RLS POLICIES (Si no existen)

-- Permitir lectura a usuarios autenticados
ALTER TABLE community_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own campaign candidates" ON community_candidates;

CREATE POLICY "Users can read own campaign candidates" 
ON community_candidates FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM campaigns WHERE user_id = auth.uid()
  )
);

-- Permitir update de email y linkedin_url
DROP POLICY IF EXISTS "Users can update email enrichment" ON community_candidates;

CREATE POLICY "Users can update email enrichment"
ON community_candidates FOR UPDATE
USING (
  campaign_id IN (
    SELECT id FROM campaigns WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  campaign_id IN (
    SELECT id FROM campaigns WHERE user_id = auth.uid()
  )
);

-- 6️⃣ REFRESH VIEW (Si es necesario)

-- Las vistas se actualizan en tiempo real, pero si quieres forzar:
-- REFRESH MATERIALIZED VIEW IF EXISTS public.global_email_candidates;
-- (Nota: Solo si cambias a MATERIALIZED VIEW)

-- 7️⃣ TEST FINAL - Verificar que todo funciona

-- Test 1: ¿La vista se puede consultar?
SELECT COUNT(*) as total_all_platforms
FROM global_email_candidates;

-- Test 2: ¿Hay candidatos de comunidades?
SELECT COUNT(*) as community_candidates_count
FROM global_email_candidates
WHERE source_platform IN ('Discord', 'Reddit', 'Skool', 'GitHubDiscussions');

-- Test 3: ¿Los candidatos de comunidades tienen emails?
SELECT COUNT(*) as community_with_emails
FROM global_email_candidates
WHERE source_platform IN ('Discord', 'Reddit', 'Skool', 'GitHubDiscussions')
AND email IS NOT NULL;

-- Si el último query devuelve > 0, ¡entonces funciona!

-- ============================================================================
-- FIN DEL SETUP
-- ============================================================================
-- Próximo paso: Verificar en SistemaComunidad que los candidatos aparecen
-- al hacer click en "Extraer Email/LinkedIn"
