# 🚀 Configuración de Actor IDs de Apify en Base de Datos Local

## Problema Original
Cuando ejecutabas la búsqueda en Upwork, los logs se limpiaban automáticamente y la búsqueda se detenía sin obtener candidatos. El error indicaba que los Actor IDs de Apify no estaban configurados correctamente.

## Solución Implementada
He creado un sistema que almacena los **Actor IDs directamente en Supabase**, sin necesidad de agregar variables de entorno.

---

## 📋 Pasos de Instalación

### Paso 1: Ejecutar la Migración SQL en Supabase

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto **TalentScope**
3. Ve a **SQL Editor** en la barra lateral
4. Copia y ejecuta el contenido de este archivo:
```
/supabase/apify_config_setup.sql
```

Este script creará:
- Tabla `apify_config` para almacenar los Actor IDs
- Vistas y políticas de seguridad
- Inserciones por defecto con Actor IDs de ejemplo

**⚠️ IMPORTANTE:** El script trae Actor IDs por defecto que probablemente no funcionarán. Necesitas actualizar los tuyos en el paso 2.

---

### Paso 2: Obtener tus Actor IDs de Apify

1. Ve a [Apify Store](https://apify.com/store)
2. Busca un scraper para **Upwork**:
   - Opción recomendada: `powerai/upwork-talent-search-scraper`
   - O cualquier otro que tenga buenas reviews
3. Anota el **Actor ID** (ej: `powerai/upwork-talent-search-scraper`)
4. Repite para **Fiverr**:
   - Opción: `newpo/fiverr-scraper`
   - O tu preferido

---

### Paso 3: Guardar los Actor IDs en Supabase

Tienes dos opciones:

#### Opción A: Usar Supabase SQL Editor (Recomendado para primera vez)

En Supabase SQL Editor, ejecuta:

```sql
-- Actualizar Upwork Actor ID
UPDATE public.apify_config 
SET actor_id = 'powerai/upwork-talent-search-scraper' 
WHERE config_key = 'upwork_scraper';

-- Actualizar Fiverr Actor ID
UPDATE public.apify_config 
SET actor_id = 'newpo/fiverr-scraper' 
WHERE config_key = 'fiverr_scraper';

-- Verificar que se guardaron correctamente
SELECT config_key, platform, actor_id, status FROM public.apify_config WHERE status = 'active';
```

#### Opción B: Desde JavaScript en la Aplicación

El sistema está preparado para permitir actualizar Actor IDs dinámicamente desde tu app:

```typescript
// En tu componente o en la consola del navegador
import { ApifyConfigService } from './SistemaMarketplace/services/apifyConfigService';

const configService = new ApifyConfigService(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Actualizar Actor ID de Upwork
await configService.setActorId(
  'upwork_scraper',
  'powerai/upwork-talent-search-scraper', // Reemplaza con tu Actor ID
  'Upwork',
  'Scraper de Upwork actualizado'
);

// Actualizar Actor ID de Fiverr
await configService.setActorId(
  'fiverr_scraper',
  'newpo/fiverr-scraper', // Reemplaza con tu Actor ID
  'Fiverr',
  'Scraper de Fiverr actualizado'
);
```

---

## 🔍 Verificar que todo funciona

1. Abre tu aplicación TalentScope
2. Ve a la sección **Marketplace** (Upwork/Fiverr)
3. Intenta hacer una búsqueda de candidatos
4. Los logs ahora deberían:
   - ✅ Cargarse persistentemente (no se limpiarán automáticamente)
   - ✅ Mostrar que los Actor IDs están en BD
   - ✅ Iniciar correctamente el scraping

---

## 📊 Monitorear los Actor IDs en BD

Para verificar qué Actor IDs tienen guardados:

```sql
-- Ver todos los Actor IDs configurados
SELECT 
    config_key,
    platform,
    actor_id,
    status,
    created_at,
    updated_at
FROM public.apify_config
ORDER BY platform, created_at;

-- Ver solo los activos
SELECT * FROM public.apify_config_active;
```

---

## 🔧 Cambiar un Actor ID

Si necesitas cambiar un Actor ID (ej, porque encontraste uno mejor):

```sql
UPDATE public.apify_config
SET 
    actor_id = 'nuevo/actor-id',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'upwork_scraper';
```

---

## 🏗️ Estructura de la Base de Datos

```
apify_config (tabla principal)
├── id: UUID
├── config_key: VARCHAR(100) - Clave única (upwork_scraper, fiverr_scraper, etc)
├── platform: VARCHAR(50) - Plataforma (Upwork, Fiverr, LinkedIn, Global)
├── actor_id: VARCHAR(255) - El Actor ID de Apify Store
├── description: TEXT - Descripción del actor
├── status: VARCHAR(50) - active/inactive/testing
├── metadata: JSONB - Campos adicionales
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP

Vista: apify_config_active
└── Solo Actor IDs con status = 'active'
```

---

## 🚨 Solución de Problemas

### "No se encontraron candidatos"
1. Verifica que los Actor IDs estén en Supabase: `SELECT * FROM apify_config_active;`
2. Comprueba que los Actor IDs existan en Apify Store
3. Asegúrate de que tu cuenta de Apify tiene créditos disponibles

### "Error de conexión a Supabase"
1. Verifica que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` sean correctos
2. Asegúrate de que la tabla `apify_config` existe:
```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'apify_config'
);
```

### Los logs se siguen limpiando
- Esto era un problema de la arquitectura anterior. Con esta actualización, los logs se mantienen persistentes.
- Si persiste, revisa la consola del navegador para errores

---

## 💡 Ventajas de esta Solución

✅ **Sin variables de entorno**: Los Actor IDs se almacenan en BD, no en `.env`
✅ **Actualizaciones sin redeploy**: Cambia Actor IDs sin reiniciar la app
✅ **Multi-plataforma futura**: Fácil agregar más plataformas (LinkedIn, etc.)
✅ **Caché integrado**: Rendimiento optimizado con caché de 5 minutos
✅ **Auditoria**: Histórico de cambios con timestamps
✅ **Escalable**: Soporte para múltiples Actor IDs por plataforma

---

## 📝 Próximos Pasos Opcionales

1. **Crear un panel de administración** para cambiar Actor IDs desde la UI
2. **Agregar validación automática** de Actor IDs al guardarlos
3. **Extender para otras plataformas** (LinkedIn, Indeed, etc.)
4. **Historial de cambios** con tabla de auditoría

---

## 🆘 Necesitas ayuda?

Si algo no funciona:
1. Verifica que la SQL de migración se ejecutó sin errores
2. Confirma que los parámetros de Supabase en `.env` son correctos
3. Revisa los logs del navegador (F12 → Console)
4. Intenta limpiar el cache del navegador y recargar
