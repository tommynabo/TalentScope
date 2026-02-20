-- =============================================================================
-- ⚡ SCRIPT RÁPIDO: Cambiar Actor IDs de Apify en Supabase
-- =============================================================================
-- 
-- INSTRUCCIONES:
-- 1. Abre Supabase Dashboard → Tu proyecto → SQL Editor
-- 2. Reemplaza los valores 'powerai/upwork-talent-search-scraper' y 
--    'newpo/fiverr-scraper' con tus ACTOR IDs verdaderos de Apify Store
-- 3. Ejecuta este script
-- 4. Verifica que los cambios se guardaron correctamente
--
-- =============================================================================

-- 🔧 ACTUALIZAR ACTOR ID DE UPWORK
UPDATE public.apify_config 
SET 
    actor_id = 'powerai/upwork-talent-search-scraper',  -- ← Reemplaza aquí con tu Actor ID real
    description = 'Scraper de Upwork - Actualizado ' || NOW()::text,
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'upwork_scraper';

-- 🔧 ACTUALIZAR ACTOR ID DE FIVERR
UPDATE public.apify_config 
SET 
    actor_id = 'newpo/fiverr-scraper',  -- ← Reemplaza aquí con tu Actor ID real
    description = 'Scraper de Fiverr - Actualizado ' || NOW()::text,
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'fiverr_scraper';

-- ✅ VERIFICAR QUE LOS CAMBIOS SE GUARDARON
SELECT 
    config_key as "Configuración",
    platform as "Plataforma",
    actor_id as "Actor ID",
    status as "Estado",
    updated_at as "Última actualización"
FROM public.apify_config 
WHERE status = 'active'
ORDER BY platform;

-- ✅ VER TODOS LOS REGISTROS (incluyendo inactivos)
SELECT 
    config_key as "Configuración",
    platform as "Plataforma",
    actor_id as "Actor ID",
    status as "Estado",
    created_at as "Creado",
    updated_at as "Actualizado"
FROM public.apify_config 
ORDER BY platform, created_at;

-- 🔄 SI NECESITAS REVERTIR A LOS VALORES POR DEFECTO:
-- Descomenta las siguientes líneas para restaurar valores iniciales
/*
UPDATE public.apify_config 
SET actor_id = 'powerai/upwork-talent-search-scraper' 
WHERE config_key = 'upwork_scraper';

UPDATE public.apify_config 
SET actor_id = 'newpo/fiverr-scraper' 
WHERE config_key = 'fiverr_scraper';
*/

-- 🗑️ SI NECESITAS DESACTIVAR UN ACTOR:
-- UPDATE public.apify_config SET status = 'inactive' WHERE config_key = 'upwork_scraper';

-- 📊 MONITOREAR ESTADO ACTUAL:
-- SELECT config_key, platform, actor_id, status FROM public.apify_config_active;
