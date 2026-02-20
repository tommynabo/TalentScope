import { createClient } from '@supabase/supabase-js';

export interface ApifyActorConfig {
  id: string;
  config_key: string;
  platform: 'Upwork' | 'Fiverr' | 'LinkedIn' | 'Global';
  actor_id: string;
  description: string;
  status: 'active' | 'inactive' | 'testing';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Service para gestionar la configuración de Apify desde Supabase
 * Elimina la necesidad de variables de entorno para Actor IDs
 */
export class ApifyConfigService {
  private supabase: any;
  private cache: Map<string, ApifyActorConfig> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutos

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Obtener un Actor ID por clave de configuración
   * @param configKey - Clave de la configuración (ej: 'upwork_scraper', 'fiverr_scraper')
   * @returns Actor ID o null si no existe
   */
  async getActorId(configKey: string): Promise<string | null> {
    try {
      const config = await this.getConfig(configKey);
      return config?.actor_id || null;
    } catch (error) {
      console.error(`❌ Error obteniendo Actor ID para ${configKey}:`, error);
      return null;
    }
  }

  /**
   * Obtener la configuración completa de un Actor
   */
  async getConfig(configKey: string): Promise<ApifyActorConfig | null> {
    try {
      // Revisar cache primero
      if (this.cache.has(configKey)) {
        return this.cache.get(configKey) || null;
      }

      const { data, error } = await this.supabase
        .from('apify_config')
        .select('*')
        .eq('config_key', configKey)
        .eq('status', 'active')
        .single();

      if (error) {
        console.error(`❌ Error en getConfig(${configKey}):`, error);
        return null;
      }

      if (data) {
        // Guardar en cache
        this.cache.set(configKey, data);
        // Limpiar cache después de expirar
        setTimeout(() => this.cache.delete(configKey), this.cacheExpiry);
      }

      return data || null;
    } catch (error) {
      console.error(`❌ Error inesperado en getConfig(${configKey}):`, error);
      return null;
    }
  }

  /**
   * Obtener todos los Actor IDs activos para una plataforma
   */
  async getConfigsByPlatform(platform: string): Promise<ApifyActorConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('apify_config')
        .select('*')
        .eq('platform', platform)
        .eq('status', 'active');

      if (error) {
        console.error(`❌ Error obteniendo configs para ${platform}:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`❌ Error inesperado en getConfigsByPlatform(${platform}):`, error);
      return [];
    }
  }

  /**
   * Actualizar o crear un Actor ID en la base de datos
   * @param configKey - Clave única para la configuración
   * @param actorId - Actor ID de Apify
   * @param platform - Plataforma
   * @param description - Descripción del actor
   */
  async setActorId(
    configKey: string,
    actorId: string,
    platform: 'Upwork' | 'Fiverr' | 'LinkedIn' | 'Global',
    description: string = ''
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('apify_config')
        .upsert({
          config_key: configKey,
          actor_id: actorId,
          platform,
          description,
          status: 'active',
          metadata: {}
        });

      if (error) {
        console.error(`❌ Error al guardar Actor ID:`, error);
        return false;
      }

      // Invalidar cache
      this.cache.delete(configKey);
      return true;
    } catch (error) {
      console.error(`❌ Error inesperado al guardar Actor ID:`, error);
      return false;
    }
  }

  /**
   * Obtener múltiples Actor IDs de una vez
   */
  async getMultipleActorIds(configKeys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};

    for (const key of configKeys) {
      result[key] = await this.getActorId(key);
    }

    return result;
  }

  /**
   * Validar que un Actor ID está disponible y activo
   */
  async validateActorId(configKey: string): Promise<boolean> {
    const config = await this.getConfig(configKey);
    return !!config && config.status === 'active';
  }

  /**
   * Limpiar el cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('✅ Cache de ApifyConfig limpiado');
  }

  /**
   * Obtener todos los Actor IDs activos
   */
  async getAllActiveConfigs(): Promise<ApifyActorConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('apify_config')
        .select('*')
        .eq('status', 'active');

      if (error) {
        console.error('❌ Error obteniendo todas las configs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error inesperado en getAllActiveConfigs:', error);
      return [];
    }
  }
}
