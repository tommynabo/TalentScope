# 🏗️ Arquitectura del Sistema de Actor IDs

## Flujo Anterior (❌ Problema Original)

```
┌─────────────────────┐
│   CampaignDashboard │
│                     │
│  Hacer búsqueda     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│ MarketplaceRaidService      │
│                             │
│  getInstance(apifyKey,     │
│   openaiKey)                │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  ApifyService                │
│                              │
│  private actors = {          │
│    upwork: ENV var + default │  ❌ Faltan valores
│    fiverr: ENV var + default │  ❌ No se actualizan
│  }                           │  ❌ Sin persistencia
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Hardcoded valores por       │
│  defecto que no funcionan:   │
│                              │
│  powerai/upwork-...          │  ❌ No existen en tu cuenta
│  newpo/fiverr-scraper        │  ❌ Errores de autenticación
└──────────────────────────────┘

RESULTADO: ❌ "No se encontraron candidatos"
PROBLEMA:  Los logs se limpian automáticamente
           Sin forma de guardar/actualizar Actor IDs
```

---

## Flujo Nuevo (✅ Solucionado)

```
┌──────────────────────────────────┐
│    CampaignDashboard.tsx         │
│                                  │
│  Selecciona plataforma           │
│  Hace clic en "Buscar"           │
│                                  │
│  const supabaseUrl = ...         │
│  const supabaseKey = ...         │
│  const apifyKey = ...            │
├──────────────────────────────────┤
│ getInstance(                     │
│   apifyKey,                      │
│   openaiKey,                     │
│   supabaseUrl, ← NUEVO           │
│   supabaseKey  ← NUEVO           │
│ )                                │
└────────────────┬─────────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│   MarketplaceRaidService         │
│                                  │
│   constructor(...                │
│     supabaseUrl,                 │
│     supabaseKey                  │
│   ) {                            │
│     this.apifyService =          │
│       new ApifyService(          │
│         apiKey,                  │
│         supabaseUrl,    ← NUEVO  │
│         supabaseKey     ← NUEVO  │
│       )                          │
│   }                              │
└────────────────┬─────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│      ApifyService                    │
│                                      │
│  constructor(                        │
│    apiKey,                           │
│    supabaseUrl,              ← NUEVO│
│    supabaseKey               ← NUEVO│
│  ) {                                 │
│    this.configService =              │
│      new ApifyConfigService(         │
│        supabaseUrl,                  │
│        supabaseKey                   │
│      )                               │
│    this.initializeActorIds()         │
│  }                                   │
│                                      │
│  private async                       │
│    initializeActorIds() {            │
│      this.actors.upwork =            │
│        await configService           │
│          .getActorId(                │
│            'upwork_scraper'          │
│          )                           │
│  }                                   │
└────────────────┬─────────────────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
     ▼                       ▼
┌──────────────────┐  ┌────────────────────┐
│ Supabase BD      │  │ Caché Local        │
│                  │  │ (5 min)            │
│ apify_config     │  │                    │
│                  │  │ upwork_scraper →   │
│ config_key →     │  │ actor_id           │
│ upwork_scraper   │  │                    │
│ actor_id →       │  │ fiverr_scraper →   │
│ powerai/upwork...│  │ actor_id           │
│ status → active  │  │                    │
│                  │  │ linkedin_search →  │
│ config_key →     │  │ actor_id           │
│ fiverr_scraper   │  └────────────────────┘
│ actor_id →       │
│ newpo/fiverr...  │
│ status → active  │
│                  │
│ (Tabla actualiz- │
│  able en cualquier│
│  momento sin      │
│  redeploy)       │
└──────────────────┘
     ▲              
     │ Leer cuando   
     │ se necesita   
     │              
┌────────────────────────────┐
│  ApifyConfigService        │
│                            │
│  getActorId(configKey)    │
│  ├── Revisar caché        │
│  ├── Si no está:          │
│  │   Consultar Supabase   │
│  │   Guardar en caché     │
│  └── Retornar valor       │
│                            │
│  setActorId(...)          │
│  ├── Actualizar BD        │
│  ├── Invalidar caché      │
│  └── Retornar resultado   │
└────────────────────────────┘

RESULTADO: ✅ Búsqueda funciona correctamente
VENTAJAS:  
  ✓ Actor IDs guardados en BD
  ✓ Sin variables de entorno
  ✓ Actualización instantánea
  ✓ Logs persistentes
  ✓ Escalable y mantenible
```

---

## Tabla de Base de Datos: `apify_config`

```sql
┌─────────────────────────────────────────────────────────────┐
│ apify_config                                                │
├─────────────────┬──────────────┬────────────────────────────┤
│ Column          │ Type         │ Value (Ejemplo)            │
├─────────────────┼──────────────┼────────────────────────────┤
│ id              │ UUID         │ 550e8400-e29b-...          │
│ config_key      │ VARCHAR(100) │ upwork_scraper             │
│ platform        │ VARCHAR(50)  │ Upwork                     │
│ actor_id        │ VARCHAR(255) │ powerai/upwork-talent...  │
│ description     │ TEXT         │ Scraper de Upwork...       │
│ status          │ VARCHAR(50)  │ active                     │
│ metadata        │ JSONB        │ {"version": "1.0"}        │
│ created_at      │ TIMESTAMP    │ 2024-01-15 10:30:00       │
│ updated_at      │ TIMESTAMP    │ 2024-01-20 15:45:00       │
└─────────────────┴──────────────┴────────────────────────────┘

// Registros de ejemplo:
┌────────────────────┬──────────────┬────────────────────────────┐
│ config_key         │ platform     │ actor_id                   │
├────────────────────┼──────────────┼────────────────────────────┤
│ upwork_scraper     │ Upwork       │ powerai/upwork-talent...  │
│ fiverr_scraper     │ Fiverr       │ newpo/fiverr-scraper      │
│ linkedin_search    │ LinkedIn     │ nFJndFXA5zjCTuudP         │
└────────────────────┴──────────────┴────────────────────────────┘
```

---

## Flujo de Actualización de Actor ID

```
Usuario en interface
        │
        ▼
┌──────────────────────────────────────┐
│ "Actualizar Actor ID de Upwork"      │
│                                      │
│ New Actor ID:                        │
│ [_________________________]           │
│ [Guardar]                            │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ ApifyService.updateActorId(          │
│   'upwork',                          │
│   'nuevo/actor-id'                   │
│ )                                    │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ ApifyConfigService.setActorId(       │
│   'upwork_scraper',                  │
│   'nuevo/actor-id',                  │
│   'Upwork'                           │
│ )                                    │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ Supabase:                            │
│                                      │
│ UPDATE apify_config                  │
│ SET                                  │
│   actor_id = 'nuevo/actor-id',       │
│   updated_at = NOW()                 │
│ WHERE config_key = 'upwork_scraper'  │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ Limpiar caché:                       │
│ cache.delete('upwork_scraper')       │
└────────────────┬─────────────────────┘
                 │
                 ▼
        ✅ Listo para usar
        
        (Sin redeploy, sin reiniciar)
```

---

## Ventajas de esta Arquitectura

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Almacenamiento** | Variables de entorno | Base de datos Supabase |
| **Persistencia** | Solo en proceso | Permanente en BD |
| **Actualización** | Requiere redeploy | Instantánea, sin redeploy |
| **Escalabilidad** | Solo 2 Actor IDs hardcoded | Ilimitado, cualquier plataforma |
| **RLS/Seguridad** | No hay | Políticas de Supabase |
| **Auditoría** | No hay | timestamps automáticos |
| **Caché** | No hay | Caché local 5 min |
| **Fallback** | ENV vars o defaults | BD → cache → defaults |

---

## Cómo Añadir Nuevas Plataformas

1. **Insertar en apify_config:**
```sql
INSERT INTO apify_config (config_key, platform, actor_id, status)
VALUES (
  'linkedin_scraper',
  'LinkedIn',
  'myuser/linkedin-scraper',
  'active'
);
```

2. **Usar en código:**
```typescript
const linkedinActorId = await configService.getActorId('linkedin_scraper');
```

**¡Es así de simple!**

---

## Resumen: De problema a solución

### El Problema Original
- ❌ Actor IDs hardcodeados que no existen
- ❌ No se pueden actualizar sin cambiar código
- ❌ Logs se limpian automáticamente
- ❌ Sin forma de debuguear

### La Solución Implementada  
- ✅ Actor IDs en BD, actualizables al instante
- ✅ Logs persistentes
- ✅ Mensajes de error claros con soluciones
- ✅ Sistema escalable para cualquier plataforma
- ✅ Caché inteligente para rendimiento

### Resultado
**Búsquedas funcionales de Upwork/Fiverr con configuración flexible y persistente** 🚀
