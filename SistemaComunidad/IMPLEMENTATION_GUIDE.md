# 🚀 SISTEMA COMUNIDAD - GUÍA DE IMPLEMENTACIÓN COMPLETA

## ✅ Estado Actual

### Lo que ya está implementado:

1. **Motor de Extracción OSINT**
   - Archivo: `SistemaComunidad/lib/communityEnrichmentService.ts`
   - Usa: `ContactResearchService` (Apify + OpenAI)
   - Busca: Emails y LinkedIn para candidatos de Discord, Reddit, etc.

2. **UI del Pipeline**
   - Archivo: `SistemaComunidad/components/CommunityCandidatesPipeline.tsx`
   - Botón: "Extraer Email/LinkedIn" (con spinner mientras extrae)
   - Botón: "+ Candidatos" (aparece si tiene email)
   - Análisis: 4 secciones con AI insights

3. **Sincronización Automática**
   - Archivo: `SistemaComunidad/lib/communityCandidateSyncService.ts` (NUEVO)
   - Qué hace: Después de enriquecer, sincroniza automáticamente a `global_email_candidates`
   - Resultado: El candidato aparece en Gmail > Buzones > Candidatos

4. **Fallback en Gmail Service**
   - Archivo: `lib/gmailCandidatesService.ts` (ACTUALIZADO)
   - Ahora consulta: community_candidates directamente si la vista falla
   - Garantiza: Que los candidatos de comunidades siempre aparezcan

5. **Vista Global de Emails**
   - Archivo: `supabase/update_global_email_view.sql` (VERIFICADO)
   - Unifica: LinkedIn + GitHub + Marketplace + Community
   - Tabla: `global_email_candidates` (vista SQL)

---

## 📋 PASOS A EJECUTAR AHORA

### 1️⃣ Ejecutar Script SQL en Supabase

**Ubicación:** `supabase/update_global_email_view.sql`

Entra en tu panel de Supabase:
1. Ve a: **SQL Editor** (lado izquierdo)
2. Click en **New Query**
3. Copia y pega el contenido de `update_global_email_view.sql`
4. Click en **Run** (esquina inferior derecha)

**Qué hace:**
- Crea/reemplaza la vista `global_email_candidates`
- Incluye candidatos de community_candidates con email
- Los candidatos enriquecidos aparecerán automáticamente aquí

### 2️⃣ Verificar Tabla community_candidates en Supabase

En SQL Editor, ejecuta:

```sql
-- Verificar estructura
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'community_candidates'
ORDER BY ordinal_position;

-- Verificar algunos datos
SELECT id, username, email, linkedIn_url, platform, created_at
FROM community_candidates
LIMIT 5;
```

**Campos que NECESITA:**
```
✅ id (uuid)
✅ campaign_id (uuid)
✅ username (text)
✅ display_name (text)
✅ email (text) - puede ser NULL, se llena al extraer
✅ linkedin_url (text) - puede ser NULL, se llena al extraer
✅ platform (text) - 'Discord', 'Reddit', 'Skool', etc.
✅ profile_url (text)
✅ created_at (timestamp)
```

### 3️⃣ Verificar RLS (Row Level Security)

En SQL Editor, ejecuta:

```sql
-- Ver políticas RLS
SELECT * FROM information_schema.tables 
WHERE table_name IN ('community_candidates', 'global_email_candidates');

-- Las vistas deberían ser SELECT-only para usuarios autenticados
```

Los candidatos deberían ser visibles para usuarios autenticados.

### 4️⃣ Verificar Conexión con Gmail

En SQL Editor, ejecuta:

```sql
-- Ver si existe la tabla de outreach
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'gmail_%';

-- Debería haber: gmail_outreach_sequences, gmail_outreach_leads, etc.
```

---

## 🧪 PRUEBA DEL SISTEMA

### Opción 1: Test Simple (Sin Apify)

Ejecuta el test que verifica la estructura:

```bash
# En terminal, en la raíz del proyecto
npx ts-node test-community-enrichment.ts
```

Esto:
- ✅ Carga un candidato de community_candidates
- ✅ Verifica que está en global_email_candidates
- ✅ Muestra las secuencias disponibles

### Opción 2: Test Real (Con Apify)

1. Ve a **SistemaComunidad** en la UI
2. Busca/crea una campaña
3. Desgranadie candidatos en el Pipeline
4. Elige un candidato
5. Click en **"Extraer Email/LinkedIn"**
6. Espera (mientras Apify hace OSINT)
7. Si encuentra email → se guarda automáticamente
8. Si tiene email → click en **"+ Candidatos"**
9. Ve a **Gmail > Buzones > Candidatos**
10. ¡Debería estar allí! ✨

---

## 🔗 FLUJO COMPLETO DE DATOS

```
┌─────────────────────────────────────────────────────────┐
│  SistemaComunidad > CommunityCandidatesPipeline.tsx     │
│  Usuario presiona: "Extraer Email/LinkedIn"             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  CommunityEnrichmentService                            │
│  ├─ Usa ContactResearchService.findLinkedInProfile()  │
│  ├─ Usa ContactResearchService.findEmailAddresses()   │
│  └─ Actualiza: community_candidates.email + linkedin │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  CommunityCandidateSyncService.syncToGmailCandidates() │
│  └─ Verifica que el candidato aparezca en              │
│     global_email_candidates (vista SQL)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  global_email_candidates (SQL VIEW)                    │
│  ├─ Incluye: LinkedIn + GitHub + Marketplace + Community│
│  └─ SELECT * WHERE source_platform = 'Discord' ...    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Gmail Dashboard > Buzones > Candidatos                │
│  └─ Carga via: GmailCandidatesService.getGlobalEmail  │
│     └─ Si vista falla → fallback a community_candidates│
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ ARCHIVOS MODIFICADOS/CREADOS

### Creados:
- ✨ `SistemaComunidad/lib/communityCandidateSyncService.ts`
- ✨ `test-community-enrichment.ts`
- ✨ `SistemaComunidad/SETUP_VERIFICATION.sh`
- ✨ `SistemaComunidad/IMPLEMENTATION_GUIDE.md` (este archivo)

### Actualizados:
- 🔄 `SistemaComunidad/components/CommunityCandidatesPipeline.tsx`
  - Agregados imports: `CommunityCandidateSyncService`, `Check`
  - Actualizada función: `handleEnrichCandidate` (ahora syncroniza automáticamente)
  - Agregado botón: "+ Candidatos" (manual sync si es necesario)

- 🔄 `lib/gmailCandidatesService.ts`
  - Agregado fallback para `community_candidates`
  - Ahora consulta 4 tablas: github, linkedin, marketplace, community

---

## ⚙️ VERIFICACIONES FINALES

Ejecuta esto en Supabase SQL Editor:

```sql
-- 1. Verificar que la vista existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'global_email_candidates';

-- 2. Ver ejemplo de datos
SELECT * FROM global_email_candidates
WHERE source_platform IN ('Discord', 'Reddit', 'Skool')
LIMIT 5;

-- 3. Verificar que hay correos
SELECT COUNT(*) as candidatos_con_email,
       COUNT(DISTINCT source_platform) as plataformas
FROM global_email_candidates;

-- 4. Ver por plataforma
SELECT source_platform, COUNT(*) as count
FROM global_email_candidates
GROUP BY source_platform;
```

---

## 🚨 TROUBLESHOOTING

### Problema: Candidato no aparece en global_email_candidates

**Causas:**
1. ✅ No hay email en el candidato (debe enriquecerse primero)
2. ✅ El script SQL no se ejecutó
3. ✅ RLS está bloqueando

**Solución:**
- Ejecuta el SQL: `supabase/update_global_email_view.sql`
- Verifica: email no sea null o vacío en community_candidates
- Herramienta: SQL Editor en Supabase

### Problema: El botón "Extraer" no funciona

**Causas:**
1. ✅ Falta VITE_APIFY_API_KEY en .env
2. ✅ Falta VITE_OPENAI_API_KEY en .env
3. ✅ Error de red/Apify down

**Solución:**
- Verifica .env tiene las keys
- Revisa console del navegador (F12)
- Ejecuta: `npm run dev` y verifica logs

### Problem: Los candidatos de Comunidad no aparecen en Gmail > Candidatos

**Causas:**
1. ✅ Vista global no se creó
2. ✅ RLS bloquea lectura
3. ✅ Le faltan emails

**Solución:**
1. Abre Supabase > SQL Editor
2. Ejecuta: `supabase/update_global_email_view.sql`
3. Verifica que los candidatos tengan email
4. Recarga la página Gmail

---

## 📊 MÉTRICAS IMPORTANTES

Usa estas queries para monitorear:

```sql
-- Candidatos por plataforma y estado
SELECT 
  source_platform,
  COUNT(*) as total,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as con_email,
  COUNT(CASE WHEN profile_url IS NOT NULL THEN 1 END) as con_profile
FROM global_email_candidates
GROUP BY source_platform;

-- Candidatos más recientes
SELECT 
  name, source_platform, email, created_at
FROM global_email_candidates
ORDER BY created_at DESC
LIMIT 20;
```

---

## ✨ SIGUIENTE FASE

Una vez que esto funciona:

1. **Automatizar Enrollments**: Script para auto-add a secuencias
2. **Analytics**: Trackear who got emails, opens, etc.
3. **IA Mejot**: Mejorar prompts de enrichment
4. **Batch Operations**: Enriquecer múltiples candidatos en paralelo
5. **Integración LinkedIn**: Conexión directa con LinkedIn API (no OSINT)

---

**Última actualización:** 5 de Marzo 2026
**Estado:** 🟢 Sistema funcional, listo para usar
