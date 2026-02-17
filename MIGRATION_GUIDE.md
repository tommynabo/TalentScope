# 📋 Guía de Reorganización del Sistema - SistemaGithub y SistemaLinkedin

## 🎯 Objetivo

Separar completamente la lógica de búsqueda de GitHub y LinkedIn en dos sistemas independientes para:
- **Evitar contaminación cruzada** de lógica de búsqueda
- **Facilitar mantenimiento** de cada sistema
- **Mejorar organización** del código
- **Claridad en propósito** de cada módulo

---

## 📂 Nueva Estructura

```
/
├── SistemaGithub/              ← GitHub Code Scan (Búsqueda de desarrolladores en GitHub)
│   ├── components/             ← Componentes React de GitHub
│   │   ├── GitHubCodeScan.tsx    ← PRINCIPAL: Panel de búsqueda
│   │   ├── GitHubCampaignList.tsx
│   │   ├── GitHubCandidatesCards.tsx
│   │   ├── GitHubCandidatesKanban.tsx
│   │   ├── GitHubCandidatesPipeline.tsx
│   │   ├── GitHubFilterConfig.tsx
│   │   ├── GitHubScanManager.tsx
│   │   └── GitHubCampaignDashboard.tsx
│   ├── lib/                    ← Servicios específicos de GitHub
│   │   ├── GitHubSearchEngine.ts     ← Motor de búsqueda GitHub
│   │   ├── githubService.ts
│   │   ├── githubSearchService.ts
│   │   ├── githubCandidatePersistence.ts
│   │   ├── githubDeduplication.ts
│   │   ├── githubPresets.ts
│   │   └── githubContactService.ts
│   └── README.md               ← Documentación del sistema
│
├── SistemaLinkedin/            ← LinkedIn Radar (Búsqueda de perfiles en LinkedIn)
│   ├── components/             ← Componentes React de LinkedIn
│   │   └── DetailView.tsx       ← PRINCIPAL: Panel de búsqueda y gestión
│   ├── lib/                    ← Servicios específicos de LinkedIn
│   │   └── LinkedInSearchEngine.ts   ← Motor de búsqueda LinkedIn
│   └── README.md               ← Documentación del sistema
│
├── lib/                        ← Servicios COMPARTIDOS (no duplicados)
├── components/                 ← Componentes COMPARTIDOS
├── types/                      ← Tipos TypeScript compartidos
├── App.tsx                     ← Router principal (actualizado)
└── ...
```

---

## 🔄 Cambios Principales

### 1. **App.tsx** - Importaciones Actualizadas

**Antes:**
```typescript
import { GitHubCampaignList } from './components/GitHubCampaignList';
import { GitHubCodeScan } from './components/GitHubCodeScan';
import DetailView from './components/DetailView';
```

**Ahora:**
```typescript
// Sistema GitHub
import { GitHubCampaignList } from './SistemaGithub/components/GitHubCampaignList';
import { GitHubCodeScan } from './SistemaGithub/components/GitHubCodeScan';
// Sistema LinkedIn
import DetailView from './SistemaLinkedin/components/DetailView';
```

### 2. **DetailView.tsx** (LinkedIn)

**Motor de búsqueda:**
- **Antes:** `import { searchEngine } from '../lib/SearchEngine'`
- **Ahora:** `import { linkedInSearchEngine } from '../lib/LinkedInSearchEngine'`

**Llamada a search:**
- **Antes:** `searchEngine.startSearch(query, 'linkedin', maxResults, options, ...)`
- **Ahora:** `linkedInSearchEngine.startSearch(query, maxResults, options, ...)`

### 3. **GitHubCodeScan.tsx** (GitHub)

**Motor de búsqueda:**
- **Ahora:** Importa `GitHubSearchEngine` desde `../lib/GitHubSearchEngine`

---

## 🚀 URLs de Acceso

### LinkedIn Radar
```
https://app.com/tablero/linkedin
https://app.com/tablero/linkedin/:campaignId
```

**Componente:** `DetailView` (desde `SistemaLinkedin/components`)

### GitHub Code Scan
```
https://app.com/tablero/github
https://app.com/tablero/github/:campaignId
```

**Componentes:** 
- Listado: `GitHubCampaignList` (desde `SistemaGithub/components`)
- Detalle: `GitHubCodeScan` (desde `SistemaGithub/components`)

---

## 🔍 Search Engines

### LinkedInSearchEngine
**Archivo:** `SistemaLinkedin/lib/LinkedInSearchEngine.ts`

```typescript
const linkedInSearchEngine = new LinkedInSearchEngine();

linkedInSearchEngine.startSearch(
  query: string,           // "Python Developer"
  maxResults: number,      // 50
  options: {
    language: string,      // "Spanish"
    maxAge: number,        // 30
    filters?: SearchFilterCriteria,
    scoreThreshold?: number,
    campaignId?: string
  },
  onLog: (msg: string) => void,
  onComplete: (candidates: Candidate[]) => void
);
```

**Características:**
- Búsqueda basada en Google Custom Search a través de Apify
- Análisis IA con OpenAI GPT-4o-mini
- Deduplicación automática
- 10 variaciones de query para máxima cobertura

### GitHubSearchEngine
**Archivo:** `SistemaGithub/lib/GitHubSearchEngine.ts`

```typescript
const gitHubSearchEngine = new GitHubSearchEngine();

// Solo GitHub
gitHubSearchEngine.startGitHubSearch(query, maxResults, options, onLog, onComplete);

// GitHub + LinkedIn (cross-linking)
gitHubSearchEngine.startCrossSearch(query, maxResults, options, onLog, onComplete);
```

**Características:**
- Búsqueda directa en GitHub API
- Filtros predefinidos (presets)
- Persistencia en Supabase
- Deduplicación específica para GitHub
- Cross-linking opcional a LinkedIn

---

## 🔧 Archivos NO Modificados

Los siguientes archivos **permanecen en su ubicación original** porque son compartidos:

```
lib/
├── scoring.ts              ← Cálculo de scores (usado por ambos)
├── deduplication.ts        ← Deduplicación genérica
├── normalization.ts        ← Normalización de URLs
├── search.ts               ← Búsqueda genérica
├── services.ts             ← Servicios de campaña/candidato
├── supabase.ts             ← Cliente de BD
├── analytics.ts            ← Analytics
└── ...

components/
├── ScoreBreakdownCard.tsx   ← Tarjeta de scores (usado por ambos)
├── Toast.tsx               ← Notificaciones
├── KanbanBoard.tsx         ← Vista Kanban compartida
└── ...
```

---

## ⚠️ Cambios en Imports

Si estabas importando desde las ubicaciones antiguas:

### ❌ Antes (Obsoleto)
```typescript
import { GitHubCodeScan } from './components/GitHubCodeScan';
import DetailView from './components/DetailView';
```

### ✅ Ahora
```typescript
import { GitHubCodeScan } from './SistemaGithub/components/GitHubCodeScan';
import DetailView from './SistemaLinkedin/components/DetailView';
```

---

## 🧪 Testing

Validar que funcionen las siguientes rutas:

1. **LinkedIn:**
   - [ ] `/dashboard` → botón LinkedIn funciona
   - [ ] `/tablero/linkedin` → muestra CampaignListView
   - [ ] `/tablero/linkedin/:id` → muestra DetailView (LinkedIn)
   - [ ] Búsqueda inicia correctamente con linkedInSearchEngine

2. **GitHub:**
   - [ ] `/dashboard` → botón GitHub funciona  
   - [ ] `/tablero/github`  → muestra GitHubCampaignList
   - [ ] `/tablero/github/:id` → muestra GitHubCodeScan
   - [ ] Búsqueda inicia correctamente con gitHubSearchEngine

---

## 📝 Próximos Pasos

- [ ] Validar build: `npm run build`
- [ ] Verificar en dev: `npm run dev`
- [ ] Testing de búsquedas LinkedIn
- [ ] Testing de búsquedas GitHub
- [ ] Validar imports en todos los componentes
- [ ] Deploy a staging

---

## 🎓 Beneficios

✅ **Separación de concerns:** Cada sistema es independiente  
✅ **Fácil mantenimiento:** Cambios en LinkedIn no afectan GitHub  
✅ **Código limpio:** Estructura clara y evidente  
✅ **Escalabilidad:** Fácil agregar nuevos sistemas de búsqueda  
✅ **Prevención de bugs:** Sin "cross-contamination" entre sistemas  

