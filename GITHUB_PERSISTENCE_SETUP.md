# Configuración de Persistencia GitHub en Supabase

## Resumen de Cambios

Se ha implementado un sistema sólido de persistencia de candidatos GitHub en Supabase con:

✅ **Tabla `github_search_results`** - Almacena candidatos por campaña  
✅ **Deduplicación por campaña** - Busca en Supabase, no solo en batch actual  
✅ **Acumulación automática** - Las búsquedas se suman en la campaña  
✅ **Persistencia permanente** - Los datos se guardan en Supabase automáticamente  

---

## Archivos Modificados

### 1. **lib/githubCandidatePersistence.ts** (NUEVO)
Servicio robusto para persistencia:
- `saveCandidates()` - Guardar/actualizar candidatos (upsert)
- `getCampaignCandidates()` - Cargar todos desde campaña
- `getDeduplicationData()` - Datos para deduplicación
- `getCandidatesGroupedByDate()` - Agrupar por fecha (para vistas)

### 2. **lib/githubDeduplication.ts** (ACTUALIZADO)
- Ahora busca deduplicación **por campaña específica**, no globalmente
- `fetchExistingGitHubCandidates(campaignId, userId)` - Nuevo parámetro campaignId

### 3. **lib/githubService.ts** (ACTUALIZADO)
- `searchDevelopers()` ahora acepta `campaignId` y `userId`
- **Guarda automáticamente** en Supabase al terminar búsqueda
- Importa `GitHubCandidatePersistence`

### 4. **components/GitHubCodeScan.tsx** (ACTUALIZADO)
- Carga candidatos **desde Supabase**, no sessionStorage
- Llama a `githubService.searchDevelopers()` con contexto de campaña
- La persistencia es automática en githubService
- Importa `GitHubCandidatePersistence`

### 5. **lib/githubContactService.ts** (CORREGIDO)
- Método público `isIndividualUser()` para filtrar empresas
- Búsqueda mejorada de emails y LinkedIn
- Caché para optimizar búsquedas
- Método correcto: `listPublicEventsForUser` (antes era incorrecto)

### 6. **supabase/github_search_results_migration.sql** (NUEVO)
Migración para crear tabla con:
- Índices para búsqueda rápida
- RLS policies para seguridad
- UNIQUE constraint para evitar duplicados

---

## Flujo de Datos

```
[Búsqueda]
    ↓
[githubService.searchDevelopers(criteria, maxResults, logs, campaignId, userId)]
    ↓
1. Cargar deduplicación: GitHubDeduplicationService.fetchExistingGitHubCandidates(campaignId, userId)
2. Buscar en GitHub
3. Analizar cada usuario
4. Deduplicar contra existentes EN CAMPAÑA
5. Guardar en Supabase: GitHubCandidatePersistence.saveCandidates()
    ↓
[GitHubCodeScan carga desde Supabase]
    ↓
[Mostrar en vista (Kanban/Pipeline/Cards)]
    ↓
[Siguiente búsqueda acumula con anterior]
```

---

## Configuración en Supabase

### Paso 1: Ejecutar Migración SQL
En Supabase, abrir SQL Editor y ejecutar:
```sql
-- Archivo: supabase/github_search_results_migration.sql
```

Esto creará:
- Tabla `github_search_results`
- Índices para performance
- RLS policies para seguridad

### Paso 2: Verificar Tabla
```sql
SELECT * FROM github_search_results LIMIT 1;
```

---

## Uso en Frontend

### Búsqueda Básica
```typescript
// En GitHubCodeScan.tsx - ya implementado
await githubService.searchDevelopers(
    criteria,
    maxResults,
    handleLogMessage,
    campaignId,    // Necesario para persistencia
    userId         // Necesario para persistencia
);
```

### Cargar Candidatos
```typescript
// En componentes
const candidates = await GitHubCandidatePersistence.getCampaignCandidates(
    campaignId,
    userId
);
```

### Agrupar por Fecha
```typescript
// Para vista Pipeline/Kanban
const grouped = await GitHubCandidatePersistence.getCandidatesGroupedByDate(
    campaignId,
    userId
);
// Resultado: { "17 de febrero de 2026": [...], "16 de febrero de 2026": [...] }
```

---

## Comportamiento Esperado

### Primera Búsqueda
```
✅ Ejecutar búsqueda de 20 prospectos
✅ Se guardan en Supabase
✅ Se muestran en vista (Kanban/Pipeline)
✅ Logs: "Saved 20 candidates to database"
```

### Segunda Búsqueda (Acumulación)
```
✅ Buscar 5 más en la misma campaña
✅ Deduplicación: Busca en Supabase ← Encuentra los 20 anteriores
✅ Solo agrega nuevos (no duplicados)
✅ Total: 25 candidatos
✅ Visible: Pipeline agrupa por fecha
```

### Refresco de Página
```
✅ Recarga campaña
✅ Carga automáticamente 25 candidatos desde Supabase
✅ Logs permanecen en sessionStorage
✅ Puedo seguir buscando y acumular más
```

---

## Filtros Y Deduplicación

El sistema deduplica por:
1. **Username** (case-insensitive)
2. **Email** (si disponible)
3. **LinkedIn URL** (si disponible)

Ejemplo:
- Búsqueda 1: Encuentra @usuario1 con email1@gmail.com
- Búsqueda 2: Encuentra el mismo @usuario1
  - ❌ Rechazado: Ya existe por username en BD
- Búsqueda 3: Encuentra @usuario2 con email1@gmail.com
  - ❌ Rechazado: Ya existe por email en BD

---

## Campos Guardados por Candidato

```javascript
{
    campaign_id: UUID,
    user_id: UUID,
    github_id: number,
    github_username: string,
    github_url: string,
    email: string | null,
    linkedin_url: string | null,
    score: number,
    github_metrics: { ... }, // Objeto completo en JSONB
    created_at: ISO string,
    updated_at: ISO string
}
```

---

## Tests Recomendados

### Test 1: Búsqueda y Persistencia
```
1. Abrir campaña GitHub
2. Ejecutar búsqueda con criterios
3. Verificar en Logs: "Saved X candidates to database"
4. Recargar página
5. ✅ Candidatos siguen visibles
```

### Test 2: Acumulación
```
1. Búsqueda 1: 20 candidatos
2. Búsqueda 2: 5 más (diferentes)
3. Verificar: Total = 25
4. Ver agrupación por fecha
5. ✅ Ambas búsquedas están presentes
```

### Test 3: Deduplicación Funciona
```
1. Búsqueda 1: 20 candidatos
2. Búsqueda 2: Mismos 20 + 5 nuevos
3. Verificar logs: "Skipped - duplicate"
4. Total = 25 (no 45)
5. ✅ Solo agregó los 5 nuevos
```

### Test 4: Filtro de Empresas
```
1. Búsqueda con criterios
2. Verificar logs: "@flutter - Not an individual user"
3. ✅ Empresas filtradas automáticamente
```

---

## Troubleshooting

### "No campaign context - results NOT persisted"
**Problema:** GitHubCodeScan no recibe campaignId
**Solución:** Asegurar que se pasa campaignId desde componente padre

### "Error saving candidates to Supabase"
**Problema:** Tabla no existe
**Solución:** Ejecutar migración SQL en Supabase

### "Loaded X existing candidates but search adds same candidate"
**Problema:** Deduplicación no funciona
**Solución:** Verificar que campaignId y userId se pasen correctamente

---

## Performance

- **Índices**: Optimizados para búsqueda rápida
- **RLS**: Solo usuario puede ver sus propios candidatos
- **Caché**: GitHubContactService cachea emails/LinkedIn
- **Batch**: Guarda múltiples en una operación (upsert)

---

## Próximos Pasos

1. ✅ Ejecutar migración SQL en Supabase
2. ✅ Testear búsquedas básica
3. Implementar vista con agrupación por fecha
4. Agregar características de filtrado/ordenamiento
5. Implementar exportación a CSV desde Supabase
