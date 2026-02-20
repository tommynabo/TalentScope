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
-- Actor seleccionado: apify/web-scraper
-- Razones: 
--   ✅ Oficial de Apify (máxima confianza)
--   ✅ Completamente gratuito
--   ✅ Funciona con cualquier sitio (flexible)
--   ✅ Bien documentado y soportado
--   ✅ nwtn/upwork-profile-scraper no está disponible en todas las cuentas
UPDATE public.apify_config 
SET 
    actor_id = 'apify/web-scraper',  -- Official Apify actor, universal
    description = 'Web Scraper Apify - Universal para Upwork, gratuito, confiable',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'upwork_scraper';

-- 🔧 ACTUALIZAR ACTOR ID DE FIVERR
-- Actor seleccionado: apify/web-scraper
-- Razones:
--   ✅ Oficial de Apify (máxima confianza)
--   ✅ Completamente gratuito
--   ✅ Funciona con cualquier sitio (flexible)
--   ✅ Bien documentado y soportado
UPDATE public.apify_config 
SET 
    actor_id = 'apify/web-scraper',  -- Official Apify actor, 100% free, universal
    description = 'Web Scraper oficial de Apify - Gratuito, universal, muy confiable',
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

-- 🔄 Si necesitas cambiar los valores, edita los Actor IDs directamente:
-- UPDATE public.apify_config SET actor_id = 'nuevo-actor-id' WHERE config_key = 'upwork_scraper';

-- 🗑️ Para desactivar un actor:
-- UPDATE public.apify_config SET status = 'inactive' WHERE config_key = 'upwork_scraper';

-- 📊 Monitorear estado actual:
-- SELECT config_key, platform, actor_id, status FROM public.apify_config_active;
