# 🚀 GitHub Code Scan - Quick Start Guide

## 1️⃣ Configuración Inicial (5 minutos)

### Paso 1: Obtener GitHub Token
```bash
# Ve a: https://github.com/settings/tokens/new
# Permisos: read:user, public_repo, user:email
# Copia el token (⚠️ solo aparece una vez)

# En tu .env.local:
VITE_GITHUB_TOKEN=ghp_abc123xyz...
```

### Paso 2: Ejecutar SQL Migration
```sql
-- En Supabase Dashboard → SQL Editor
-- Copiar todo de: supabase/github_candidates_migration.sql
-- Ejecutar
```

### Paso 3: Verificar que funciona
```bash
npm run dev
# Accede a http://localhost:5173/github-scan
```

---

## 2️⃣ Uso Básico (El Flujo)

### Escenario: Buscar Flutter Developers en España

**Step 1: Abrir GitHub Code Scan**
```
http://localhost:5173/github-scan
```

**Step 2: Configurar Filtros**
```
- Languages: Dart, Flutter
- Min Stars: 50
- Score Threshold: 60
- Originality: ≥30%
- Require Recent Activity: ON
- App Store Required: OFF (búsqueda amplia)
```

**Step 3: Iniciar búsqueda**
```
Click "Start Search"
Esperar ~2-5 minutos
Ver resultados en grid
```

**Step 4: Revisar candidatos**
```
- Click en card → Abre perfil GitHub
- Ver score breakdown
- Check si tiene app store link (⭐)
- Guardar en campaña
```

---

## 3️⃣ Casos de Uso Prácticos

### use Case 1: "Solo Apps Shipping"
```json
{
  "languages": ["dart"],
  "min_stars": 100,
  "min_followers": 50,
  "require_app_store_link": true,    // ← CRITICAL
  "score_threshold": 75,
  "require_recent_activity": true
}
```
**Resultado:** Solo developers que REALMENTE han lanzado apps  
**Tiempo:** ~3 min  
**Usuarios típicos:** 5-15  

### Use Case 2: "Builders Emergentes"
```json
{
  "languages": ["flutter", "dart"],
  "min_stars": 20,                  // ← Baja
  "min_followers": 10,              // ← Baja
  "min_public_repos": 3,
  "require_app_store_link": false,
  "score_threshold": 50,            // ← Baja
  "exclude_generic_repos": true
}
```
**Resultado:** Desarrolladores jóvenes pero con potencial  
**Tiempo:** ~3 min  
**Usuarios típicos:** 20-50  

### Use Case 3: "Especialistas Backend + Frontend"
```json
{
  "languages": ["dart", "typescript", "kotlin"],
  "min_stars": 75,
  "min_followers": 100,
  "min_originality_ratio": 50,
  "require_recent_activity": true,
  "max_months_since_last_commit": 3,
  "score_threshold": 70
}
```
**Resultado:** Full-stack specialists con experiencia  
**Tiempo:** ~3 min  
**Usuarios típicos:** 10-25  

---

## 4️⃣ Ejemplo Código Integrado

### En tu Dashboard/App.tsx:

```tsx
import { GitHubCodeScan } from './components/GitHubCodeScan';
import { GitHubFilterConfig } from './components/GitHubFilterConfig';

export function App() {
  const [showGitHubTab, setShowGitHubTab] = useState(false);
  
  return (
    <div>
      {/* Tabs */}
      <div className="tabs">
        <button onClick={() => setShowGitHubTab(false)}>LinkedIn Search</button>
        <button onClick={() => setShowGitHubTab(true)}>GitHub Code Scan</button>
      </div>

      {/* Content */}
      {showGitHubTab ? (
        <GitHubCodeScan campaignId={currentCampaignId} />
      ) : (
        <LinkedInSearch />
      )}
    </div>
  );
}
```

### En CampaignCreationView:

```tsx
import { GitHubFilterConfig } from './components/GitHubFilterConfig';
import { GitHubFilterCriteria } from '../types/database';

export function CampaignCreationView() {
  const [platform, setPlatform] = useState('LinkedIn');
  const [gitHubCriteria, setGitHubCriteria] = useState<GitHubFilterCriteria | null>(null);

  const handleSaveCampaign = async () => {
    const campaign = {
      title: formData.title,
      platform,
      settings: { ... },
      // GitHub-specific
      ...(platform === 'GitHub' && { github_filter_criteria: gitHubCriteria })
    };
    
    await saveCampaign(campaign);
  };

  return (
    <form>
      <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
        <option value="LinkedIn">LinkedIn</option>
        <option value="GitHub">GitHub</option>
      </select>

      {platform === 'GitHub' && (
        <GitHubFilterConfig 
          onSave={(criteria) => {
            setGitHubCriteria(criteria);
          }}
        />
      )}

      <button onClick={handleSaveCampaign}>Create Campaign</button>
    </form>
  );
}
```

---

## 5️⃣ Resultados Esperados

### Búsqueda Típica: "Flutter Developers, Spain, Apps Published"

```
Entrada:
{
  "languages": ["dart", "flutter"],
  "locations": ["Spain"],
  "min_stars": 50,
  "require_app_store_link": true,  // ← Clave
  "score_threshold": 65
}

Salida (ejemplo):
┌─────────────────────────────────────────────────────────────┐
│ Found 12 developers matching criteria                       │
│                                                              │
│ 1. @javier_dev                               Score: 92/100  │
│    ⭐ App Published (Play Store)                            │
│    👥 320 followers | ⭐ 450 stars total                   │
│    💾 5 repositories | ✨ 100% original                     │
│    Last commit: 2 days ago                                   │
│                                                              │
│ 2. @carmenvega                                Score: 78/100  │
│    Personal website: carmenvega.dev                          │
│    👥 180 followers | ⭐ 320 stars total                   │
│    💾 8 repositories | ✨ 87% original                      │
│    Last commit: 1 week ago                                   │
│                                                              │
│ 3. @davidtech                                 Score: 71/100  │
│    👥 95 followers | ⭐ 210 stars total                    │
│    💾 3 repositories | ✨ 100% original                     │
│    Last commit: 3 weeks ago                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Time taken: 4m 32s
Rate limit: 4,847/5,000 remaining
```

---

## 6️⃣ Interpretar Scores

```
Score 90-100  ✅ A-PLAYER
├─ Published app
├─ Active commits
├─ 1000+ followers
└─ High quality repos

Score 75-89   ✅ STRONG MATCH
├─ Shipped something
├─ Regular contributor
└─ Some community recognition

Score 60-74   ⚠️ GOOD CANDIDATE
├─ Code quality OK
├─ Emerging developer
└─ Needs some vetting

Score <60     ❌ FILTERED OUT
└─ Doesn't meet minimum criteria
```

---

## 7️⃣ Tips Avanzados

### Tip 1: Buscar por múltiples lenguajes
```json
{
  "languages": ["dart", "flutter", "kotlin", "swift"],
  // Encontrará devs con CUALQUIERA de estos lenguajes
}
```

### Tip 2: Solo developers hireable
```json
{
  "available_for_hire": true
  // Busca en bio "Open to work" o "Hireable: true"
}
```

### Tip 3: Encontrar innovadores
```json
{
  "languages": ["dart", "typescript", "rust"],
  "min_stars": 100,
  "score_threshold": 80,
  // Combina lenguajes trendy + stars altos
}
```

### Tip 4: Comparar dos búsquedas
```
Crear 2 campañas con criterios diferentes:

Campaign 1: "Flutter - Proven Shippers"
{
  "require_app_store_link": true,
  "score_threshold": 75
  // ~12 resultados
}

Campaign 2: "Flutter - Builders (Potential)"
{
  "require_app_store_link": false,
  "score_threshold": 60,
}
  // ~50 resultados

Luego: ¿Cuáles tienen mejor conversion en outreach?
```

### Tip 5: Monitorear cambios
```
Guardar búsqueda cada mes
Comparar nuevos scores vs antiguos
Detectar developers ascendentes
```

---

## 8️⃣ Debugging

### Problema: "No results found"

**Checkin:**
```
1. ¿GitHub token válido?
   - Prueba token en: curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

2. ¿Criterios muy estrictos?
   - Reduce min_stars: prueba 30 en vez de 50
   - Reduce score_threshold: prueba 50 en vez de 70

3. ¿Lenguaje muy específico?
   - Agrega más lenguajes a la búsqueda

4. ¿Rate limit?
   - Espera 1 hora o agrega nuevo token
```

### Problema: "Muy lento"

**Optimizaciones:**
```
1. Reduce maxResults: 30 en vez de 100
2. Aumenta score_threshold: solo muestra top candidates
3. Disable require_recent_activity: más rápido
4. Excluye más lenguajes: narrower search
```

### Problema: "Scores bajos"

**Causas posibles:**
```
1. Originality muy baja: muchos forks
   → Aumenta min_originality_ratio

2. Sin app store links
   → set require_app_store_link: true para boost

3. Inactivos
   → set require_recent_activity: true

4. Pocos followers/stars
   → Esto es OK - score aún válido
```

---

## 9️⃣ Almacenamientos de Datos

### Dónde se guardan los resultados:

```
// Tabla: github_candidates
INSERT INTO github_candidates (
  github_username,
  github_url,
  followers,
  total_stars_received,
  github_score,
  has_app_store_link,
  mentioned_email,
  score_breakdown,
  campaign_id
) VALUES (...);

// Tabla: github_repositories
INSERT INTO github_repositories (
  github_candidate_id,
  repo_name,
  stars,
  language,
  has_store_link,
  readme_content
) VALUES (...);
```

### Recuperar resultados después:

```sql
-- Top candidates de una campaña
SELECT * FROM top_github_candidates 
WHERE campaign_id = 'your-campaign-id'
ORDER BY github_score DESC;

-- Estadísticas
SELECT * FROM github_campaign_stats 
WHERE campaign_id = 'your-campaign-id';

-- Custom query
SELECT 
  github_username,
  github_score,
  has_app_store_link,
  mentioned_email,
  followers
FROM github_candidates
WHERE github_score >= 75 
  AND has_app_store_link = true
ORDER BY github_score DESC;
```

---

## 🔟 Checklist: Ready to Go?

- [ ] GitHub token obtenido y en .env.local
- [ ] SQL migration ejecutada
- [ ] npm install completado (Octokit ya incluido)
- [ ] Componentes GitHubFilterConfig y GitHubCodeScan importados
- [ ] Ruta /github-scan accesible
- [ ] Prueba búsqueda simple con 1-2 lenguajes
- [ ] Verifica rate limit: `githubService.getRateLimit()`
- [ ] Resultados guardándose en Supabase
- [ ] UI mostrando candidatos correctamente
- [ ] Integration con SearchEngine testeada

---

## 📖 Documentación Relacionada

- **[GITHUB_CODE_SCAN_SETUP.md](GITHUB_CODE_SCAN_SETUP.md)** - Guía técnica completa
- **[github_scraper_plan.md.resolved](#)** - Plan arquitectónico original
- **[IMPLEMENTATION_PLAN_FLUTTER_FILTER.md](IMPLEMENTATION_PLAN_FLUTTER_FILTER.md)** - Sistema de scoring (similar aplicado a GitHub)

---

**Última actualización:** 16 de Febrero, 2026  
**Versión:** 1.0  
**Estado:** ✅ Ready for Production
