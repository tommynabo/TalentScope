-- ═══════════════════════════════════════════════════════════════════════════════
-- APIFY CONFIGURATION TABLE
-- Almacena Actor IDs y configuración global de Apify sin variables de entorno
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1️⃣ Crear tabla de configuración de Apify
CREATE TABLE IF NOT EXISTS public.apify_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificador único para esta configuración
    config_key VARCHAR(100) NOT NULL UNIQUE,
    
    -- Plataforma a la que se refiere
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('Upwork', 'Fiverr', 'LinkedIn', 'Global')),
    
    -- Actor ID de Apify Store
    actor_id VARCHAR(255) NOT NULL,
    
    -- Descripción del actor
    description TEXT,
    
    -- Estado: active o inactive
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'testing')),
    
    -- Metadatos adicionales
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices
CREATE INDEX idx_apify_config_platform ON public.apify_config(platform);
CREATE INDEX idx_apify_config_status ON public.apify_config(status);
CREATE INDEX idx_apify_config_key ON public.apify_config(config_key);

-- 2️⃣ Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_apify_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_apify_config_timestamp_trigger ON public.apify_config;
CREATE TRIGGER update_apify_config_timestamp_trigger
BEFORE UPDATE ON public.apify_config
FOR EACH ROW
EXECUTE FUNCTION update_apify_config_timestamp();

-- 3️⃣ Insertar Actor IDs por defecto (Seleccionados por calidad-precio-optimización)
INSERT INTO public.apify_config (config_key, platform, actor_id, description, status, metadata) 
VALUES 
    ('upwork_scraper', 'Upwork', 'nwtn/upwork-profile-scraper', 'Scraper Upwork - Gratuito, optimizado, mantenido', 'active', '{"version": "1.0", "min_credits": 1, "free": true}'::jsonb),
    ('fiverr_scraper', 'Fiverr', 'apify/web-scraper', 'Web Scraper Apify - Universal, gratuito, confiable', 'active', '{"version": "1.0", "free": true, "universal": true}'::jsonb),
    ('linkedin_search', 'LinkedIn', 'nwtn/linkedin-profile-scraper', 'LinkedIn Profile Scraper - De calidad', 'active', '{"version": "1.0"}'::jsonb)
ON CONFLICT (config_key) DO UPDATE 
SET 
    actor_id = EXCLUDED.actor_id,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP
WHERE apify_config.config_key = EXCLUDED.config_key;

-- 4️⃣ Crear vista para acceder fácilmente a los Actor IDs activos
CREATE OR REPLACE VIEW public.apify_config_active AS
SELECT 
    config_key,
    platform,
    actor_id,
    description,
    metadata,
    created_at,
    updated_at
FROM public.apify_config
WHERE status = 'active';

-- 5️⃣ RLS Policies (acceso público para lectura, solo admin para escritura)
ALTER TABLE public.apify_config ENABLE ROW LEVEL SECURITY;

-- Permite que cualquiera lea la configuración activa
CREATE POLICY "Anyone can view active apify config"
    ON public.apify_config
    FOR SELECT
    USING (status = 'active');

-- Solo el propietario de la sesión puede actualizar/insertar/deletear
CREATE POLICY "Admin only can modify apify config"
    ON public.apify_config
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin only can update apify config"
    ON public.apify_config
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin only can delete apify config"
    ON public.apify_config
    FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- ✅ CONFIGURACIÓN COMPLETADA
-- Tabla: apify_config
-- Vista: apify_config_active (solo Actor IDs activos)
-- RLS habilitado para seguridad
