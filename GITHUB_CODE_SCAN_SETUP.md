# 🔧 GitHub Code Scan - Guía de Configuración Completa

## 📋 Resumen de Implementación

Se ha implementado un sistema completo de GitHub Code Scan que permite:

✅ **Búsqueda avanzada de desarrolladores** en GitHub con criterios específicos  
✅ **Filtrado anti-bootcamp** para evitar perfiles falsos  
✅ **Detección de "Builders"** - desarrolladores que realmente shipping productos  
✅ **Scoring automático** (0-100) basado en 5 factores clave  
✅ **Dashboard interactivo** para visualizar y gestionar candidatos  
✅ **Almacenamiento en Supabase** de todas las métricas  
✅ **Campañas configurables** con diferentes criterios por búsqueda  

---

## 🔑 CREDENCIALES REQUERIDAS

### 1. GitHub Personal Access Token (PAT) - REQUERIDO ⭐

**¿Por qué?** Necesitamos autenticación en la GitHub API para:
- Buscar usuarios por criterios
- Analizar repositorios de profundidad
- Leer archivos README
- Extraer emails de commits
- Evitar rate limits (5,000 req/hr vs 60 req/hr sin auth)

**Cómo obtenerlo:**

1. Ve a: https://github.com/settings/tokens/new
2. Permisos necesarios (select minimum):
   ```
   - read:user
   - public_repo
   - user:email
   ```
3. Copia el token (⚠️ solo se muestra UNA VEZ)
4. Agrega a `.env.local`:
   ```
   VITE_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   ```

**Nota:** Con token:
- 5,000 requests/hora
- Acceso a repos privados del usuario autenticado
- Emails públicos del perfil

**Sin token:**
- 60 requests/hora
- Solo repos públicos
- Sin emails

---

## 📊 ESTRUCTURA DE DATOS - SQL

### Tablas creadas:

**1. `github_candidates`** - Perfil de desarrollador de GitHub
```sql
- github_username (PK)
- github_id, github_url
- public_repos, followers, following
- total_stars_received, average_repo_stars
- original_repos_count, fork_repos_count, originality_ratio
- total_commits, contribution_streak, last_commit_date
- most_used_language
- has_app_store_link, app_store_url (⭐ CRITICAL SIGNAL)
- mentioned_email, personal_website
- github_score (0-100), score_breakdown (JSONB)
- identified_at, created_at, updated_at
```

**2. `github_repositories`** - Análisis profundo por repo
```sql
- repo_name, repo_url
- stars, forks, is_fork
- language, description
- last_commit_date, commits_count, contributors_count
- has_store_link, store_urls[]
- readme_content, has_app_published
```

**3. `campaigns.github_filter_criteria`** - JSONB extensión
```sql
Almacena criterios por campaña:
{
  "min_stars": 50,
  "languages": ["dart", "flutter"],
  "require_app_store_link": false,
  "score_threshold": 60,
  ...
}
```

### Vistas creadas:

**`top_github_candidates`** - Top 100 candidatos por score  
**`github_campaign_stats`** - Estadísticas por campaña

---

## 🎯 ALGORITMO DE SCORING (0-100)

El score se calcula con 5 factores clave:

### 1. **Repository Quality (0-25pts)**
```
>50 stars avg per repo → 25pts
>>20 stars              → 20pts
>10 stars               → 15pts
>5 stars                → 10pts
Else                    → 5pts
```
✨ **Indicador:** Calidad del código y popularidad

### 2. **Code Activity (0-20pts)**
```
Last commit <30 días   → 20pts
<90 días               → 15pts
<180 días              → 10pts
<365 días              → 5pts
>365 días              → 0pts
```
✨ **Indicador:** Developer está activo NOW

### 3. **Community Presence (0-20pts)**
```
≥1000 followers    → 20pts
≥500 followers     → 15pts
≥100 followers     → 10pts
≥50 followers      → 7pts
<50                → 3pts
```
✨ **Indicador:** Reconocimiento en la comunidad

### 4. **App Shipping - THE CRITICAL SIGNAL (0-20pts)**
```
Play Store OR App Store link en README → 20pts (+50% boost)
Sin link pero tiene repos originales    → 5pts
```
⭐ **Este es el factor más importante:** Prueba de que realmente SHIPPED un app

### 5. **Originality Filter (0-15pts)**
```
≥90% non-forks     → 15pts
≥70% non-forks     → 12pts
≥50% non-forks     → 8pts
≥30% non-forks     → 3pts
<30% non-forks     → 0pts (FILTERED OUT - bootcamp profile)
```
✨ **Indicador:** Evita perfiles que son 90% forks (bootcamp red flag)

### Total Score: Repository (25) + Activity (20) + Community (20) + App Shipping (20) + Originality (15) = **100 puntos**

---

## 🚀 CRITERIOS DE FILTRO - EXPLICADOS

### Repository Metrics
```javascript
min_stars: 50           // Solo repos con engagement real
max_stars: 10000        // No buscar mega-stars
min_forks: 0            // Sin restricción
min_originality_ratio: 30  // Anti-bootcamp: ≥30% repos propios
exclude_generic_repos: true // Excluye: "todo", "calc", "weather"
```

### Developer Signals
```javascript
min_public_repos: 5           // Debe tener portfolio
min_followers: 10             // Mínima presencia
min_contributions_per_month: 5 // Must be active
```

### Code Quality
```javascript
require_recent_activity: true      // Filtro de actividad
max_months_since_last_commit: 6    // Hace commit regularmente
```

### The App Store Signal 🌟
```javascript
require_app_store_link: false  
// Si es TRUE: SOLO developers con Play Store / App Store links
// Si es FALSE: Considerar todos pero boost score si tienen link
```

---

## 🎮 COMPONENTES FRONTEND

### 1. **GitHubFilterConfig** (`components/GitHubFilterConfig.tsx`)
```
- Formulario interactivo para configurar criterios
- 6 secciones desplegables
- Presets de lenguajes (Dart, Flutter, Kotlin, etc)
- Slider de score threshold (0-100)
- Resumen de configuración
```

### 2. **GitHubCodeScan** (`components/GitHubCodeScan.tsx`)
```
- Dashboard principal
- Botón para iniciar búsqueda
- Grid de resultados con cards de candidatos
- Logs en tiempo real
- Métricas visuales por candidato
- Acciones: "Add to Campaign", exportar
```

### 3. **CandidateCard** (dentro de GitHubCodeScan)
```
- Username + Score badge (color-coded)
- 🌟 Badge especial si tiene App Store
- Métricas: Stars, Followers, Originality, Language
- Score breakdown (5 factores)
- Links a profile y website personal
```

---

## 🔌 SERVICIOS BACKEND

### **GitHubService** (`lib/githubService.ts`)

Métodos principales:

```typescript
async searchDevelopers(
  criteria: GitHubFilterCriteria,
  maxResults: number,
  onLog: GitHubLogCallback
): Promise<GitHubMetrics[]>
```
- Busca usuarios con criterios
- Analiza profundamente cada uno
- Retorna lista de GitHubMetrics

```typescript
private async analyzeUser(
  username: string,
  criteria: GitHubFilterCriteria,
  onLog: GitHubLogCallback
): Promise<GitHubMetrics | null>
```
- Obtiene perfil del usuario
- Analiza sus repositorios
- Busca en READMEs app store links
- Calcula score
- Extrae email

```typescript
private async findAppStoreLink(
  repos: any[],
  username: string
): Promise<{ hasAppStoreLink: boolean; appStoreUrl: string | null }>
```
- La función MÁS IMPORTANTE
- Busca links play.google.com o apps.apple.com en READMEs
- Retorna URL si encuentra

```typescript
private calculateGitHubScore(metrics: {...}): GitHubScoreBreakdown
```
- Implementa el algoritmo de 5 factores
- Retorna breakdown detallado
- Normaliza a 0-100

---

## 🔗 INTEGRACIÓN CON SEARCHENGINE

Actualizado `lib/SearchEngine.ts`:

```typescript
public async startSearch(
  query: string,
  source: 'linkedin' | 'github',  // ← Ahora acepta 'github'
  maxResults: number,
  options: { 
    language: string;
    maxAge: number;
    filters?: SearchFilterCriteria;
    githubFilters?: GitHubFilterCriteria;  // ← NEW
    scoreThreshold?: number;
  },
  onLog: LogCallback,
  onComplete: (candidates: Candidate[] | GitHubCandidate[]) => void
)
```

**Uso:**
```typescript
const engine = new SearchEngine();

// Para GitHub
await engine.startSearch(
  '',  // query no usado en GitHub
  'github',
  50,
  {
    language: 'es',
    maxAge: 30,
    githubFilters: {
      languages: ['dart', 'flutter'],
      min_stars: 50,
      require_app_store_link: false,
      score_threshold: 60,
      ...
    }
  },
  (log) => console.log(log),
  (candidates) => console.log(candidates)
);
```

---

## ⚡ RATE LIMITS Y CONSIDERACIONES

### GitHub API Rate Limits

**CON GitHub PAT:**
- 5,000 requests/hora
- Promedio por usuario: ~6-8 requests (profile + repos + readme)
- **Capacidad:** ~600-800 usuarios/hora
- **Max por búsqueda:** 50 usuarios recomendado = ~5 min

**SIN GitHub PAT:**
- 60 requests/hora
- No viable para búsquedas reales

### Optimizaciones implemented:

✅ Limita análisis a 10 repos originales por usuario  
✅ Caches en memoria durante sesión  
✅ Timeouts en README fetches  
✅ Manejo de errores graceful  
✅ Logs detallados para debugging  

---

## ⚙️ SETUP PASO A PASO

### 1. **Agregar GitHub PAT al .env.local**
```bash
# .env.local
VITE_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### 2. **Ejecutar SQL migration**
```bash
# En Supabase Dashboard → SQL Editor:
-- Copiar contenido de: supabase/github_candidates_migration.sql
-- Ejecutar
```

### 3. **Importar componentes en App.tsx**
```tsx
import { GitHubCodeScan } from './components/GitHubCodeScan';
import { GitHubFilterConfig } from './components/GitHubFilterConfig';

// En tu routing:
<Route path="/github-scan" element={<GitHubCodeScan />} />
```

### 4. **Usar en Campaign Creation**
```tsx
// En CampaignCreationView.tsx - agregar tab para GitHub
if (platform === 'GitHub') {
  <GitHubFilterConfig onSave={(criteria) => {
    setCampaignSettings({ 
      ...settings, 
      github_filter_criteria: criteria 
    });
  }} />
}
```

### 5. **Guardar criterios en campaña**
```typescript
// Al guardar campaña:
const campaign = {
  ...campaignData,
  platform: 'GitHub',
  settings: {
    language: 'es',
    max_age: 30,
  },
  github_filter_criteria: criteria  // JSONB stored
};
```

---

## 🧪 TESTING CHECKLIST

- [ ] GitHub token activo y funcionando
- [ ] Búsqueda con 1 idioma funciona
- [ ] Finder encuentra app store links real
- [ ] Score calcula correctamente (0-100)
- [ ] Anti-bootcamp filter elimina perfiles con >80% forks
- [ ] Dashboard muestra resultados correctamente
- [ ] Email extraction funciona
- [ ] Rate limits no superados
- [ ] Migration SQL ejecutada exitosamente
- [ ] Búsqueda múltiple con diferentes criterios
- [ ] Integración con SearchEngine funciona

---

## 🎯 PRÓXIMOS PASOS (POST-IMPLEMENTACIÓN)

1. **Enriquecimiento de datos:**
   - Incluir datos de Clay/Nubela para LinkedIn cruzado
   - Buscar emails en perfil de GitHub

2. **Machine Learning:**
   - Entrenar modelo con datos históricos
   - Predecir calidad de candidatos antes de analizar

3. **Integración con outreach:**
   - Generar mensajes personalizados basados en GitHub insights
   - A/B testing de templates

4. **Reporting avanzado:**
   - Exportar a CSV/PDF con métricas
   - Comparar múltiples búsquedas
   - Trend analysis

5. **Webhook updates:**
   - Monitorear GitHub para updates en candidatos
   - Alert si nuevo app store link detectado

---

## ❓ FAQ

**P: ¿Necesito hacer nada con Octokit?**  
R: No, ya está instalado y configurado en el paquete npm.

**P: ¿Puedo buscar sin GitHub token?**  
R: Sí pero con rate limit 60/hora. No recomendado para producción.

**P: ¿Qué pasa si GitHub cambia su structure?**  
R: Octokit es la librería oficial, seguirá siendo compatible.

**P: ¿Dónde se guardan los resultados?**  
R: En tabla `github_candidates` en Supabase.

**P: ¿Puedo combinar GitHub con LinkedIn en una campaña?**  
R: Sí, crea dos campañas separadas y compara resultados.

---

## 📞 TROUBLESHOOTING

### "401 Unauthorized"
→ GitHub token inválido o expirado → Genera uno nuevo

### "403 API rate limit exceeded"
→ Excediste 5000 requests/hora → Espera 1 hora o agrega token

### "No results found"
→ Criterios muy restrictivos → Reduce score_threshold o min_stars

### "App Store link not found"
→ README falta o no tiene link → Manual review recomendado

---

**Documento generado:** 16 de Febrero, 2026  
**Versión:** 1.0 - GitHub Code Scan Implementation
