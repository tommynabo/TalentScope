# Integración Técnica - Contact Research

## Estructura de Archivos Nuevos

### 1. lib/githubDeepContactResearch.ts

**Responsabilidad**: Motor de búsqueda de contactos con 8 estrategias

**Exporta**:
- `GitHubDeepContactResearch` (class)
- `ContactResearchResult` (interface)
- `githubDeepContactResearch` (singleton instance)

**Métodos públicos**:
```typescript
deepResearchContact(
    username: string,
    topRepos?: any[],
    onProgress?: (message: string) => void
): Promise<ContactResearchResult>

clearCache(username?: string): void
```

**Métodos privados**:
- `fetchUserProfile(username)` - obtiene datos del perfil
- `extractFromBio(profile)` - extrae info de bio/nombre
- `searchEmailInCommits(username, topRepos)` - busca en commits
- `searchEmailInWebsite(websiteUrl)` - busca en sitio web
- `extractFromReadme(owner, repo)` - analiza README
- `searchInGists(username)` - busca en Gists
- `searchInPublicEvents(username)` - analiza eventos
- `searchInPullRequests(owner, repo, username)` - busca PRs
- `isValidEmail(email)` - valida formato
- `determineSearchQuality(result)` - calcula confianza


### 2. lib/githubBatchContactEnricher.ts

**Responsabilidad**: Coordinador de procesamiento en lote

**Exporta**:
- `GitHubBatchContactEnricher` (class - singleton)
- `EnrichmentOptions` (interface)
- `EnrichmentProgress` (interface)
- `EnrichmentResult` (interface)
- `githubBatchContactEnricher` (singleton instance)

**Métodos públicos**:
```typescript
async enrichCandidates(
    candidates: GitHubMetrics[],
    campaignId: string,
    userId: string,
    options?: EnrichmentOptions,
    onProgress?: (progress: EnrichmentProgress, results: EnrichmentResult[]) => void
): Promise<EnrichmentResult[]>

pause(): void
resume(): void
cancel(): void
getStatus(): { isProcessing, isPaused, processedCount, successCount, failedCount, elapsedSeconds }
```

**Métodos privados**:
- `enrichSingleCandidate(candidate, maxRetries, delayBetweenRequests)` - procesa uno
- `estimateTimeRemaining(totalCandidates)` - calcula ETA

**Propiedades internas**:
- `isProcessing: boolean`
- `isPaused: boolean`
- `startTime: number`
- `processedCount: number`
- `successCount: number`
- `failedCount: number`


### 3. components/GitHubContactEnricher.tsx

**Responsabilidad**: Modal UI con progreso en tiempo real

**Props**:
```typescript
interface GitHubContactEnricherProps {
    candidates: GitHubMetrics[];
    campaignId: string;
    userId: string;
    onComplete?: (results: EnrichmentResult[]) => void;
    onClose?: () => void;
    autoStart?: boolean;
}
```

**Estados internos**:
- `isRunning: boolean`
- `isPaused: boolean`
- `progress: EnrichmentProgress | null`
- `results: EnrichmentResult[]`
- `recentUpdates: EnrichmentResult[]`
- `stats: { totalEmails, totalLinkedins, successRate }`

**Sub-componentes**:
- `StatCard` - tarjeta de estadística


---

## Integración en GitHubCodeScan.tsx

### Cambios de Imports
```typescript
import { GitHubContactEnricher, EnrichmentResult } from './GitHubContactEnricher';
import { Mail } from 'lucide-react'; // nuevo icono
```

### Nuevos Estados
```typescript
const [showContactEnricher, setShowContactEnricher] = useState(false);
const [enrichmentStats, setEnrichmentStats] = useState({
    emailsFound: 0,
    linkedinsFound: 0
});
```

### Nuevo Handler
```typescript
const handleContactEnrichmentComplete = (results: EnrichmentResult[]) => {
    // 1. Actualiza candidatos con info enriquecida
    const updatedCandidates = candidates.map(candidate => {
        const enrichResult = results.find(r => r.username === candidate.github_username);
        return enrichResult?.success ? enrichResult.updated : candidate;
    });
    
    // 2. Actualiza estado
    setCandidates(updatedCandidates);
    
    // 3. Calcula y muestra estadísticas
    setEnrichmentStats({
        emailsFound: updatedCandidates.filter(c => c.mentioned_email).length,
        linkedinsFound: updatedCandidates.filter(c => c.linkedin_url).length
    });
};
```

### Botón en UI
```tsx
{candidates.length > 0 && (
    <button
        onClick={() => setShowContactEnricher(true)}
        disabled={loading}
        className="px-6 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 ..."
    >
        <Mail className="h-5 w-5" />
        Enriquecer Contactos
    </button>
)}
```

### Modal Renderizado
```tsx
{showContactEnricher && campaignId && userId && (
    <GitHubContactEnricher
        candidates={candidates}
        campaignId={campaignId}
        userId={userId}
        onComplete={handleContactEnrichmentComplete}
        onClose={() => setShowContactEnricher(false)}
        autoStart={true}
    />
)}
```

### Estadísticas Mostradas
```tsx
{(enrichmentStats.emailsFound > 0 || enrichmentStats.linkedinsFound > 0) && (
    <div className="grid grid-cols-2 gap-4 ...">
        <StatCard emails={enrichmentStats.emailsFound} />
        <StatCard linkedins={enrichmentStats.linkedinsFound} />
    </div>
)}
```

---

## Flujo de Datos

```
GitHubCodeScan State
  ├─ candidates: GitHubMetrics[]
  ├─ showContactEnricher: boolean
  └─ enrichmentStats: { emailsFound, linkedinsFound }
        ↓ pasa a GitHubContactEnricher
        ↓
    GitHubContactEnricher Props
      ├─ candidates
      ├─ campaignId
      ├─ userId
      └─ onComplete callback
            ↓ llama a GitHubBatchContactEnricher.enrichCandidates
            ↓
        GitHubBatchContactEnricher
          └─ Para cada candidato:
               ├─ githubDeepContactResearch.deepResearchContact()
               ├─ Recolecta resultado
               ├─ Persiste en Supabase cada N
               └─ Emite progreso
                    ↓ callback onProgress
                    ↓
                GitHubContactEnricher actualiza UI
                    ├─ Estadísticas
                    ├─ Progreso visual
                    └─ Updates recientes
                        ↓ Al completar
                        ↓
                    Llama onComplete con resultados
                        ↓ GitHubCodeScan.handleContactEnrichmentComplete
                        ↓
                    Actualiza candidatos en state
                    Muestra estadísticas finales
```

---

## Secuencia de Ejecución

### Usuario hace clic "Enriquecer Contactos"

```sequence
1. setShowContactEnricher(true)
   → GitHubContactEnricher.jsx monta

2. GitHubContactEnricher monta, autoStart=true
   → useEffect ejecuta

3. enricher.enrichCandidates() inicia
   ├─ Filtra candidatos (skip si tienen email)
   └─ Inicia loop de procesamiento

4. Para cada candidato:
   ├─ githubDeepContactResearch.deepResearchContact()
   │  ├─ fetchUserProfile() - 1 API call
   │  ├─ searchEmailInCommits() - N API calls (repos)
   │  ├─ extractFromBio() - no API
   │  ├─ searchEmailInWebsite() - puede fallar
   │  ├─ extractFromReadme() - N API calls (repos)
   │  ├─ searchInGists() - 1 API call
   │  ├─ searchInPublicEvents() - 1 API call
   │  └─ searchInPullRequests() - N API calls
   │
   ├─ Retorna ContactResearchResult
   ├─ enricher.enrichSingleCandidate() mapea campos
   │  ├─ mentioned_email ← primary_email
   │  ├─ linkedin_url ← linkedin_url
   │  └─ personal_website ← personal_website
   │
   ├─ Cada 5 candidatos:
   │  └─ GitHubCandidatePersistence.saveCandidates()
   │     └─ Supabase INSERT/UPDATE
   │
   └─ Emite onProgress
      └─ GitHubContactEnricher actualiza UI

5. Completado:
   ├─ enricher retorna EnrichmentResult[]
   ├─ onComplete callback dispara
   ├─ GitHubCodeScan.handleContactEnrichmentComplete()
   ├─ setCandidates() actualiza state
   ├─ setEnrichmentStats() muestra stats
   └─ Modal puede cerrarse
```

---

## Mapeo de Campos

### GitHubMetrics → Updated Fields

```typescript
// Campos actualizados durante enriquecimiento
interface GitHubMetrics {
    // ... existentes ...
    
    // ACTUALIZADOS POR CONTACT RESEARCH:
    mentioned_email: string | null;         // ← primary_email
    linkedin_url: string | null;            // ← linkedin_url
    personal_website: string | null;        // ← personal_website
}

// En Supabase, tabla: github_candidates
// Columnas afectadas:
- mentioned_email (string)  
- linkedin_url (string)
- personal_website (string)
```

---

## Error Handling

### Niveles de Resiliencia

```
Nivel 1: Por candidato
├─ Si falla deepResearchContact()
│  └─ Reintentos con exponential backoff
│     ├─ Intento 1: delay = 500ms
│     ├─ Intento 2: delay = 1000ms
│     └─ Intento 3: delay = 2000ms
│
└─ Si todos fallan
   └─ result.success = false, error guardado

Nivel 2: Por estrategia de búsqueda
├─ Si falla método 1 (commits)
│  └─ Continúa método 2 (bio)
├─ Si falla método 2
│  └─ Continúa método 3 (website)
└─ ... continúa todas las 8 estrategias
   └─ Si alguna funciona → resultado válido

Nivel 3: Batch
├─ Si API devuelve 429 (rate limit)
│  └─ Sleep 10 segundos, reintentar
├─ Si API devuelve 500+ (error servidor)
│  └─ Pausa, usuario puede reanudar
└─ Si network error
   └─ Retry con backoff
```

### Try-Catch Boundaries

```typescript
// deepResearchContact
try {
    // Todas las 8 estrategias en try-catch individual
    // Si una falla, continúa
    result.research_errors.push(error.message)
} catch (error) {
    // Final: retorna con lo que encontró
    // Nunca lanza, siempre retorna resultado
}

// enrichCandidates
try {
    // Procesa batch
    // Persiste entre batches
    // Si Supabase falla, continúa en memoria
} catch (error) {
    console.warn('Batch error, continuing...')
    // Continúa procesamiento
}
```

---

## Performance Optimizations

### Caché
```typescript
// GitHubDeepContactResearch mantiene:
private requestCache = new Map<string, ContactResearchResult>()

// Beneficio:
- Si se enriquece mismo usuario 2x → instantáneo en 2a vez
- Si búsqueda falla, usa caché en reintentos

// Limpiar:
githubDeepContactResearch.clearCache('username')
// o
githubDeepContactResearch.clearCache() // todo
```

### Rate Limiting Inteligente
```typescript
// Por defecto:
- 1 candidato a la vez (parallelRequests: 1)
- Espera 500ms entre candidatos
- Total: ~2-3 segundos por candidato

// Cálculo de API calls por candidato:
- fetchUserProfile: 1
- searchEmailInCommits: 1-10 (por repo, max 10)
- searchInGists: 1
- searchInPublicEvents: 1
- searchInPullRequests: 1 por top repo (max 3)
- README extractions: 1 por repo (max 5)

Total promedio: 15-20 API calls por candidato
Con 5000 req/hora → ~250 candidatos sin issue
```

### Persistencia Incremental
```typescript
// Guarda cada 5 candidatos (configurable)
const persistProgressEvery = 5

// Beneficio:
- Si app crashea, solo pierdes últimos 5
- Usuario ve progreso persistido ya en Supabase
- Puedes empezar nueva búsqueda, no re-procesa
```

---

## Testing

### Unit Test Example

```typescript
import { GitHubDeepContactResearch } from '@/lib/githubDeepContactResearch';

describe('GitHubDeepContactResearch', () => {
    it('should extract email from commits', async () => {
        const research = new GitHubDeepContactResearch(testToken);
        const result = await research.deepResearchContact('torvalds');
        
        expect(result.primary_email).toBeDefined();
        expect(result.search_quality).not.toBe('poor');
    });
    
    it('should handle non-existent users', async () => {
        const result = await research.deepResearchContact('nonexistentuser12345');
        
        expect(result.research_errors).toContain('Could not fetch user profile');
        expect(result.success).toBe(false);
    });
    
    it('should cache results', async () => {
        const result1 = await research.deepResearchContact('user');
        const result2 = await research.deepResearchContact('user');
        
        // 2nd call instant, from cache
        expect(result1).toEqual(result2);
    });
});
```

### Integration Test Example

```typescript
describe('GitHubBatchContactEnricher', () => {
    it('should enrich multiple candidates', async () => {
        const enricher = new GitHubBatchContactEnricher();
        const results = await enricher.enrichCandidates(
            [candidate1, candidate2, candidate3],
            'campaign-id',
            'user-id'
        );
        
        expect(results).toHaveLength(3);
        expect(results.some(r => r.updated.mentioned_email)).toBe(true);
    });
});
```

---

## Extensiones y Mejoras Futuras

### Corto Plazo (1-2 semanas)
- [ ] Frontend: Mostrar fuentes en tarjetas
- [ ] Frontend: Filtrar por "search_quality"
- [ ] Backend: Caché en Redis para persistencia
- [ ] Scraping básico de sitios personales con Cheerio

### Medio Plazo (1-2 meses)
- [ ] Integración Hunter.io para verificación
- [ ] Búsqueda de Twitter/X en bio
- [ ] ML para predecir emails de nuevos usuarios
- [ ] Webhooks de GitHub para actualizaciones

### Largo Plazo (3+ meses)
- [ ] CrunchBase integration
- [ ] Email finder externos (RocketReach, etc)
- [ ] Búsqueda fuzzy avanzada con NLP
- [ ] Dashboard de analytics por calidad

---

## Troubleshooting Común

### "TypeError: Cannot read property 'deepResearchContact' of undefined"
**Causa**: githubDeepContactResearch no está instanciado
**Solución**: Asegúrate de usar la instance exportada:
```typescript
import { githubDeepContactResearch } from '@/lib/githubDeepContactResearch';
```

### "Memory exceeded when enriching 1000+ candidates"
**Causa**: Caché crece demasiado
**Solución**: Limpiar caché cada N batches
```typescript
if (processedCount % 100 === 0) {
    githubDeepContactResearch.clearCache();
}
```

### "Supabase connection timing out"
**Causa**: Rate limiting o conexión lenta
**Solución**: Aumentar persistProgressEvery
```typescript
const options: EnrichmentOptions = {
    persistProgressEvery: 10,  // En lugar de 5
    delayBetweenRequests: 1000 // Más espacio
};
```

---

## Documentación Relacionada

- [GITHUB_CONTACT_RESEARCH_GUIDE.md](./GITHUB_CONTACT_RESEARCH_GUIDE.md) - Guía completa
- [GITHUB_CONTACT_QUICK_START.md](./GITHUB_CONTACT_QUICK_START.md) - Quick start
- [README.md](./README.md) - General project

---

**Vérsión**: 1.0
**Última actualización**: 18 Feb 2026
**Mantenedor**: [Tu nombre]
