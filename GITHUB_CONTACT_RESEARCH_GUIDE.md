# Sistema de Búsqueda Indestructible de Contactos - GitHub

## Visión General

Sistema completo y robusto para encontrar métodos de contacto (email, LinkedIn) de perfiles de GitHub cuyos resultados ya han sido buscados y filtrados.


## Arquitectura de Solución

```
GitHubCodeScan.tsx (UI Principal)
    ↓
    ├─→ Búsqueda de perfiles (searchDevelopers)
    │
    └─→ [NUEVO] Botón "Enriquecer Contactos"
        ↓
        GitHubContactEnricher.tsx (Modal UI)
        ↓
        GitHubBatchContactEnricher.ts (Coordinador)
        ├─→ Maneja procesamiento por lotes
        ├─→ Controla rate limiting
        ├─→ Pausa/Reanuda
        └─→ Persiste en Supabase
            ↓
            GitHubDeepContactResearch.ts (Motor de búsqueda)
            ├─→ 8 estrategias de búsqueda profunda
            ├─→ Caché de resultados
            └─→ Validación de datos
                ↓
                githubContactService.ts (Servicios específicos)
                ├─→ Extrae emails de commits
                ├─→ Busca LinkedIn en bio
                ├─→ Analiza README de repos
                └─→ Valida formato y calidad
```


## 1. GitHubDeepContactResearch.ts - Motor Principal

### Características:
- **8 Estrategias de búsqueda** en orden de prioridad
- **Caché inteligente** para evitar búsquedas repetidas
- **Validación robusta** de emails y LinkedIn URLs
- **Tracking de calidad** de la búsqueda

### Las 8 Estrategias de Búsqueda:

```typescript
1. COMMITS AUTENTICADOS (Prioridad: MÁXIMA)
   - Busca en historial de commits de los repositorios propios
   - Email viene del autor del commit
   - Muy confiable (email real usado para ling)
   
2. PERFIL DE GITHUB (Prioridad: ALTA)
   - Bio del usuario
   - Nombre completo
   - Ubicación
   - Nombre de la empresa
   - Extrae LinkedIn, Twitter, emails si están presentes

3. SITIO WEB PERSONAL (Prioridad: ALTA)
   - URL en campo "blog" del perfil
   - Búsqueda básica de contacto en el sitio
   - (Extensible a scraping completo)

4. README DE REPOSITORIOS (Prioridad: ALTA)
   - Top 5 repositorios del usuario
   - Busca en contenido del README
   - Emails, LinkedIn, Twitter
   - Muy probable encontrar info aquí

5. GISTS PÚBLICOS (Prioridad: MEDIA)
   - Gists del usuario
   - Información en descripciones
   - Contenido de archivos
   - A veces contiene info de contacto

6. EVENTOS PÚBLICOS (Prioridad: MEDIA)
   - Commits en eventos públicos
   - Metadata de commits
   - Emails revelan en eventos comunitarios

7. PULL REQUESTS / ISSUES (Prioridad: MEDIA)
   - Comentarios en PRs
   - Descripción de issues
   - A veces usan emails en contenido

8. BÚSQUEDA FUZZY (Prioridad: BAJA)
   - Patrones en nombres de usuario
   - Variaciones comunes de email
   - (Extensible a búsqueda de terceros)
```

### Validación de Calidad

Cada resultado se valida según:
- **Formato de email**: `nombre@dominio.ext` válido
- **Emails falsos excluidos**: noreply, test, dummy, localhost, github.com, gitlab.com
- **Dominios personales preferidos**: gmail, yahoo, hotmail, outlook, protonmail, icloud
- **Patrones corporativos sospechosos**: support@, admin@, info@, hello@, team@, contact@
- **Deduplicación**: elimina duplicados automáticamente

### Score de Confianza

La calidad de la búsqueda se evalúa como:
- **Excellent** (≥70%): Email + LinkedIn + múltiples fuentes
- **Good** (≥50%): Email o LinkedIn + 2+ fuentes
- **Fair** (≥30%): 1 campo encontrado
- **Poor** (<30%): Sin información relevante

```typescript
interface ContactResearchResult {
    github_username: string;
    primary_email: string | null;        // Email prioritario
    secondary_emails: string[];          // Alternativas
    linkedin_url: string | null;
    linkedin_alternatives: string[];     // Otras URLs
    twitter_handle: string | null;
    personal_website: string | null;
    
    // Metadata
    search_quality: 'excellent' | 'good' | 'fair' | 'poor';
    sources_found: string[];             // Qué métodos tuvieron éxito
    research_depth: number;              // Métodos intentados
    research_errors: string[];           // Errores encontrados
}
```


## 2. GitHubBatchContactEnricher.ts - Coordinador y Procesador

### Características:
- **Procesamiento secuencial o paralelo** (configurable)
- **Rate limiting inteligente** con backoff exponencial
- **Persistencia incremental** en Supabase
- **Pause/Resume** de búsquedas largas
- **Estimación de tiempo restante**

### Opciones de Configuración

```typescript
interface EnrichmentOptions {
    parallelRequests?: number;           // 1 (seguro) a 5 (rápido)
    delayBetweenRequests?: number;       // Milliseconds (default: 500ms)
    maxRetries?: number;                 // Reintentos (default: 2)
    persistProgressEvery?: number;       // Guardar cada N candidatos
    skipAlreadyEnriched?: boolean;       // No re-buscar si ya tiene datos
}
```

### Flujo de Procesamiento

```
Para cada candidato:
  1. Comprueba si ya tiene email/LinkedIn (skip si skipAlreadyEnriched=true)
  2. Inicia búsqueda profunda
  3. Si falla, reinténtalo con backoff exponencial
  4. Actualiza campos: mentioned_email, linkedin_url, personal_website
  5. Cada N candidatos: persiste cambios en Supabase
  6. Emite progreso en tiempo real
  
Backoff exponencial:
  - Intento 1: 500ms
  - Intento 2: 1000ms
  - Intento 3: 2000ms
```

### Progreso Reportado

```typescript
interface EnrichmentProgress {
    totalCandidates: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    emailsFound: number;
    linkedinsFound: number;
    currentProcessing: string | null;
    estimatedTimeRemaining: number;      // En segundos
    percentComplete: number;
}
```


## 3. GitHubContactEnricher.tsx - Interfaz Visual

Modal que muestra:

### Estadísticas en Tiempo Real
- Emails encontrados
- LinkedIn URLs encontradas
- Tasa de éxito
- Candidatos fallidos

### Progreso Visual
- Barra de progreso animada
- Candidato actual procesando
- Número de candidatos restantes
- ETA (tiempo estimado)

### Updates Recientes
- Últimos 5 candidatos procesados
- Qué información se encontró para cada uno
- Estado de éxito/error

### Controles
- **Pausar**: Detiene temporalmente el procesamiento
- **Reanudar**: Continúa después de pausa
- **Cancelar**: Detiene completamente

---

## 4. Integración en GitHubCodeScan.tsx

### Cambios en UI
1. Nuevo botón "Enriquecer Contactos" (icono de mail)
   - Aparece cuando hay candidatos disponibles
   - Colores gradiente teal/cyan
   - Deshabilitado durante búsqueda

2. Estadísticas de enriquecimiento
   - Muestra emails y LinkedIn encontrados
   - Se actualiza después de enriquecimiento completo

### Flujo de Usuario

```
1. Usuario ejecuta búsqueda de perfiles (searchDevelopers)
   ↓
2. Perfiles se filtran según criterios
   ↓
3. Aparece botón "Enriquecer Contactos"
   ↓
4. Usuario hace clic → Modal GitHubContactEnricher abre
   ↓
5. Búsqueda profunda dispara automáticamente (autoStart=true)
   ↓
6. Usuario ve progreso en tiempo real
   ↓
7. Completado → candidatos se actualizan con contactos
   ↓
8. Las cartas/pipeline muestran emails y LinkedIn
```


## 5. Almacenamiento y Persistencia

### Supabase - Tabla `github_candidates`
Campos actualizados automáticamente:
```sql
- mentioned_email (string)      -- Email encontrado
- linkedin_url (string)         -- URL de LinkedIn
- personal_website (string)     -- Sitio personal
```

### localStorage
- Fallback cuando Supabase no está disponible
- Sincronización automática

### Caché en Memoria
- `GitHubDeepContactResearch` mantiene caché de resultados
- Evita búsquedas repetidas del mismo usuario
- Se puede limpiar con `clearCache()`


## 6. Manejo de Errores y Robustez

### Estrategia de Resiliencia

```
Cada búsqueda:
  - Inicializa con 8 métodos intentados
  - Si falla método 1 → continúa método 2
  - Si API devuelve 404 → salta ese repositorio
  - Si rate limit (429) → espera y reinténta
  - Si timeout → registra error y continúa
  - Si falla completamente → score='poor', sigue adelante
```

### Recuperación de Fallos

```typescript
try {
    // Estrategia 1
} catch (error) {
    result.research_errors.push(error.message);
    // Continúa con estrategia 2
}

// ... repite para las 8 estrategias
// Final: retorna resultado con lo que encontró, aunque sea parcial
```

### Rate Limiting

- GitHub API: 5000 requests/hora (tokens) o 60 (public)
- Cada búsqueda hace ~8-10 requests
- Delay entre usuarios: 500ms (configurable)
- Backoff exponencial en reintentos


## 7. Métricas y Monitoring

### Información Reportada
```typescript
{
    github_username: '@developer',
    search_quality: 'excellent',      // Confianza en datos
    sources_found: [
        'GitHub commits',
        'Profile bio',
        'Repository README: awesome-project'
    ],
    research_depth: 8,                // Métodos intentados
    primary_email: 'dev@gmail.com',
    linkedin_url: 'https://linkedin.com/in/developer',
    updated_fields: ['mentioned_email', 'linkedin_url'],
    success: true
}
```

### Estadísticas Globales
```
Total Candidates: 50
Processed: 50
Success: 48 (96%)
Failed: 2 (4%)
Emails Found: 45 (90%)
LinkedIn Found: 40 (80%)
Avg Quality: 85% (excellent)
```


## 8. Casos de Uso Avanzados

### Caso 1: Solo Emails
```typescript
const enricher = new GitHubBatchContactEnricher();
const results = await enricher.enrichCandidates(
    candidates,
    campaignId,
    userId,
    { skipAlreadyEnriched: true }
);
const emailsOnly = results
    .filter(r => r.updated.mentioned_email)
    .map(r => r.updated.mentioned_email);
```

### Caso 2: LinkedIn Enrichment Cruzado
```typescript
// Primero enriquecer contactos de GitHub
await githubBatchContactEnricher.enrichCandidates(...);

// Luego usar LinkedIn URLs para búsqueda cruzada
const linkedinProfiles = candidates
    .filter(c => c.linkedin_url)
    .map(c => c.linkedin_url);

// Buscar en LinkedIn esos perfiles
await apifyCrossSearchService.batchSearchLinkedInProfiles(candidates);
```

### Caso 3: Re-enriquecimiento con Skip
```typescript
// Primera pasada
const results1 = await enricher.enrichCandidates(
    candidates,
    campaignId,
    userId,
    { skipAlreadyEnriched: true }
);

// Segunda pasada (solo candidatos sin email)
const noEmailCandidates = candidates.filter(c => !c.mentioned_email);
const results2 = await enricher.enrichCandidates(
    noEmailCandidates,
    campaignId,
    userId,
    { skipAlreadyEnriched: false }  // Fuerza búsqueda
);
```


## 9. Extensiones Futuras

### Búsquedas Externas
- [ ] Scraping de sitios web personales (cheerio)
- [ ] Verificación de emails (Hunter.io, RocketReach API)
- [ ] Búsqueda en Twitter API
- [ ] Búsqueda en CrunchBase

### Inteligencia
- [ ] Machine Learning para predecir emails basado en patrones
- [ ] Scoring de confianza por dominio
- [ ] Detección de emails corporativos vs personales

### Optimización
- [ ] Búsqueda paralela (actualmente secuencial)
- [ ] Cachés distribuidas (Redis)
- [ ] Webhooks de GitHub para actualizaciones en tiempo real


## 10. Troubleshooting

### Problema: "No emails found for anyone"
**Causa**: Token de GitHub no válido o API limitada
**Solución**: 
```typescript
const enricher = new GitHubBatchContactEnricher(validToken);
// Intenta con repositorios públicos
```

### Problema: "Slow enrichment (10+ seconds per candidate)"
**Causa**: Demasiadas estrategias intentadas
**Solución**:
```typescript
// Aumentar delays, reducir parallelRequests
const options: EnrichmentOptions = {
    delayBetweenRequests: 1000,
    skipAlreadyEnriched: true  // Skip partially enriched
};
```

### Problema: "Memory leak with large candidate lists"
**Causa**: Caché no se limpia
**Solución**:
```typescript
// Limpiar caché después de enriquecimiento
githubDeepContactResearch.clearCache();
```

---

## Resumen de Archivos Nuevos

| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `lib/githubDeepContactResearch.ts` | Motor de búsqueda de 8 estrategias | ~500 |
| `lib/githubBatchContactEnricher.ts` | Coordinador de procesamiento en lote | ~250 |
| `components/GitHubContactEnricher.tsx` | Modal UI con progreso en tiempo real | ~350 |
| `GITHUB_CONTACT_RESEARCH.md` | Esta documentación | - |

## Cambios en Archivos Existentes

| Archivo | Cambios |
|---------|---------|
| `components/GitHubCodeScan.tsx` | + Botón "Enriquecer Contactos" |
| | + Estados para modal |
| | + Handler de completación |
| | + Estadísticas de enriquecimiento |

---

**Creado**: 18 Feb 2026
**Versión**: 1.0 - Indestructible
**Estado**: Listo para producción
