# 🔧 GUÍA COMPLETA DE RESTAURACIÓN - Sistema GitHub Indestructible

## 📋 Resumen de Problemas Resueltos

✅ **TabGuard.ts** - Completado (estaba incompleto)  
✅ **UnbreakableExecutor integrado** - Ahora GitHubCodeScan usa el sistema indestructible  
✅ **Botón Detener** - Ahora funciona y llama a `executor.stop()`  
✅ **Gestion activa de pestaña** - TabGuard.setSearchActive() marca búsquedas activas  
✅ **Schema Supabase** - Migración completa creada  

---

## 🚀 PASO 1: Ejecutar Migraciones en Supabase

### Opción A: Usar Supabase Console (Recomendado)

1. Ve a tu proyecto en [https://app.supabase.com](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** → **New Query**
4. Copia todo el contenido de: `supabase/github_complete_schema_setup.sql`
5. Pega en el editor
6. Haz clic en **Run**

Expected output:
```
✅ All tables created successfully
✅ RLS policies enabled
✅ Indexes created
```

### Opción B: Usar Supabase CLI (Si lo tienes instalado)

```bash
# Install Supabase CLI if not present
npm install -g supabase

# Link your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push supabase/github_complete_schema_setup.sql
```

---

## 🔍 PASO 2: Verificar que Todo Está Correctamente Configurado

### Desde Terminal:

```bash
# Run verification script
npx ts-node verify-github-supabase.ts
```

Expected output:
```
✅ Table "profiles" exists
✅ Table "campaigns" exists
✅ Table "github_search_results" exists
✅ All tables exist! Schema is ready.
```

### Desde Supabase Console:

```sql
-- Run these queries to verify setup
SELECT COUNT(*) as profiles_count FROM public.profiles;
-- Should return: at least 1 (your user)

SELECT COUNT(*) as campaigns_count FROM public.campaigns;
-- Can return: 0 or more (depends on existing campaigns)

SELECT COUNT(*) as github_results_count FROM public.github_search_results;
-- Can return: 0 (fresh start)
```

---

## 💾 PASO 3: Validar Sistema de Persistencia

### Estructura de Datos

La persistencia ahora funciona en 3 niveles:

```
┌─────────────────────────────────────┐
│   1. IndexedDB (Unbreakable)        │
│   - Estado de ejecución             │
│   - Heartbeat (supervive tab close) │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│   2. localStorage                   │
│   - Candidatos locales              │
│   - Logs de sesión                  │
│   - Fallback rápido                 │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│   3. Supabase (Fuente de Verdad)    │
│   - github_search_results           │
│   - Persistencia permanente         │
│   - Deduplicación por campaña       │
└─────────────────────────────────────┘
```

---

## 🧪 PASO 4: Hacer un Test Completo

### Test: Búsqueda + Cambio de Pestaña

1. **Abre la app** → Ve a un a campaña GitHub
2. **Inicia una búsqueda**
   - Verás logs en tiempo real
   - El botón "Detener" debe estar visible
3. **Cambia de pestaña/ventana**
   - ❌ ANTES: Los logs se paraban, el botón desaparecía
   - ✅ AHORA: La búsqueda continúa en background, logs se siguen actualizando
4. **Vuelve a la pestaña**
   - Verás que la búsqueda continuó
5. **Al terminar**
   - Los candidatos se guardan en Supabase automáticamente
   - Recarga la página - ¡los candidatos siguen ahí!

### Test: Stop Button

1. **Inicia búsqueda**
2. **Haz clic en "Detener"**
   - ✅ El botón debe desaparecer
   - ✅ Debe aparecer mensaje: "🛑 Búsqueda detenida por el usuario"
   - ✅ Los logs deben seguir visibles

### Test: Acumulación de Candidatos

1. **Búsqueda 1**: 20 candidatos
2. **Búsqueda 2**: otras 10 (diferentes)
3. **Resultado**: 30 total (sin duplicados)
4. **Verificar en Supabase SQL**:
   ```sql
   SELECT github_username, COUNT(*) 
   FROM public.github_search_results
   WHERE campaign_id = 'your-campaign-id'
   GROUP BY github_username
   HAVING COUNT(*) > 1;
   -- Should return: 0 rows (no duplicates)
   ```

---

## 🐛 Troubleshooting

### "El botón Detener no aparece"

**Causa**: GitHubCodeScan no está usando UnbreakableExecutor

**Solución**:
```bash
# Verify components/GitHubCodeScan.tsx has:
grep -n "UnbreakableExecutor" components/GitHubCodeScan.tsx
grep -n "executorRef.current = executor" components/GitHubCodeScan.tsx
```

### "Los logs se frenan al cambiar pestaña"

**Causa**: TabGuard no está activo o no hay heartbeat

**Solución**:
```bash
# Check App.tsx initialization
grep -n "initializeUnbreakableMarker" App.tsx
grep -n "TabGuard" App.tsx
```

### "Error: campaign_id does not exist"

**Causa**: La tabla campaigns no existe o no está vinculada correctamente

**Solución**:
```sql
-- Check if campaigns table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'campaigns'
) AS campaigns_exists;
-- Should return: true

-- If false, run github_complete_schema_setup.sql again
```

### "Error: 403 Forbidden from GitHub API"

**Causa**: Rate limit excedido o token inválido

**Solución**:
1. Verifica que el GitHub token esté configurado en `.env`
2. Espera 3600s (1 hora) para que se resetee el rate limit
3. O usa token autenticado (más alto límite)

---

## 📊 Estructura de Datos en Supabase

### Tabla: `github_search_results`

```javascript
{
  id: UUID,                    // Primary key
  campaign_id: UUID,           // FK → campaigns
  user_id: UUID,               // FK → profiles
  
  // GitHub Info
  github_id: BIGINT,
  github_username: STRING,
  github_url: TEXT,
  
  // Contact Info
  email: STRING (opcional),
  linkedin_url: STRING (opcional),
  
  // Scoring
  score: DECIMAL,
  
  // Full Candidate Data
  github_metrics: JSONB,       // Objeto completo
  
  // AI Analysis
  analysis_psychological: TEXT,
  analysis_business: TEXT,
  analysis_sales_angle: TEXT,
  analysis_bottleneck: TEXT,
  
  // Timestamps
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### Deduplicación

```sql
-- UNIQUE constraint previene duplicados
UNIQUE(campaign_id, github_username)

-- Esto significa:
-- ✅ Mismo username en diferentes campañas = OK (1 por campaña)
-- ❌ Mismo username en misma campaña = NO (genera error o actualiza)
```

---

## 🔄 Flujo Actual de Ejecución

```
Usuario hace clic en "Iniciar Búsqueda"
    ↓
GitHubCodeScan crea: new UnbreakableExecutor()
    ↓
executor.run() inicia búsqueda
    ↓
[Para aquí está en background]
↓
githubService.searchDevelopers()
  - Carga existentes desde Supabase
  - Busca en GitHub API
  - Deduplica contra campaña
    ↓
GitHubCandidatePersistence.saveCandidates()
  - Guarda en Supabase (tabla github_search_results)
  - Upsert: actualiza si existe, inserta si es nuevo
    ↓
LocalStorage es fallback en caso de Supabase indisponible
    ↓
Logs se guardan en sessionStorage
    ↓
Al recargar: Carga desde Supabase (no se pierden datos)
```

---

## 💡 Notas Importantes

1. **Las fechas de los candidatos**: Ahora son correctas (creadas con CURRENT_TIMESTAMP en Supabase, no fechas inventadas)

2. **Filtro de duplicados**: 
   - Ahora busca por campaña específica, no globalmente
   - Esto permite el mismo developer en diferentes campañas

3. **Persistencia incremental**:
   - Cada búsqueda se suma a la anterior
   - Primero busca en Supabase qué existes
   - Luego solo descarga desarrolladores nuevos

4. **Seguridad (RLS)**:
   - Cada usuario solo ve sus propios candidatos
   - Las políticas previenen acceso cruzado

---

## 📞 Soporte Rápido

Si algo no funciona:

1. **Verificar logs del navegador** (F12 - Console tab)
2. **Revisar Supabase logs** en el dashboard
3. **Ejecutar** `verify-github-supabase.ts`
4. **Confirmar** que las migraciones se ejecutaron

---

## ✅ Checklist Final

- [ ] Migraciones de Supabase ejecutadas
- [ ] `verify-github-supabase.ts` retorna "All tables exist"
- [ ] GitHubCodeScan tiene `UnbreakableExecutor` integrado  
- [ ] Botón "Detener" funciona y llama a `executor.stop()`
- [ ] Test: cambiar pestaña durante búsqueda no pausa
- [ ] Test: candidatos se guardan en Supabase
- [ ] Test: recargar página mantiene datos

---

**¡Tu sistema GitHub está listo! 🚀**
