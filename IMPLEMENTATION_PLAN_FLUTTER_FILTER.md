# 🚀 Implementation Plan: Flutter Developer Filter Enhancement

**Objetivo:** Mejorar los criterios de búsqueda para campañas de Flutter Developer con un sistema de scoring basado en importancia (X = 1pt, XX = 2pts)

---

## 📊 Criterios de Búsqueda Definidos

| Criterio | Importancia | Peso | Descripción |
|----------|-------------|------|-------------|
| Edad (18-30 años) | X | 1pt | Rango de edad preferido |
| Grado en Ingeniería | X | 1pt | Cursando o ha cursado |
| Apps Publicadas (iOS/Android) | XX | 2pts | **ALTO** - Experiencia demostrada |
| Startups Early Stage | XX | 2pts | **ALTO** - Mentalidad startup |
| Portafolio Online/Web Personal | XX | 2pts | **ALTO** - Presencia digital |
| Experiencia Flutter/Dart | XX | 2pts | **ALTO** - Tech skills core |
| Fundó SaaS/App/Agencia | X | 1pt | Emprendimiento |
| Side-projects (Open Source) | XX | 2pts | **ALTO** - Comunidad tech |
| Backend (Firebase/Supabase) | X | 1pt | Knowledge Plus |
| UX/UI Design Awareness | X | 1pt | Complementary skill |
| Experiencia con IA | X | 1pt | Innovation mindset |

**Score Máximo:** 15 puntos  
**Umbral Mínimo de Match:** 8 puntos (Symmetry Score 70+)

---

## 🔧 Fases de Implementación

### **FASE 1: Actualizar Tipos de Datos**
**Archivos:** `types/database.ts`

#### 1.1 Crear nueva interfaz `SearchFilterCriteria`
```typescript
export interface SearchFilterCriteria {
  // Demografía
  min_age: number;
  max_age: number;
  has_engineering_degree: boolean;
  engineering_degree_weight: number; // 0-1
  
  // Experiencia Técnica
  has_published_apps: boolean;    // XX (2pts)
  published_apps_weight: number;
  has_flutter_dart_exp: boolean;  // XX (2pts)
  flutter_dart_weight: number;
  
  // Emprendimiento
  startup_early_stage_exp: boolean; // XX (2pts)
  startup_weight: number;
  founded_business: boolean;        // X (1pt)
  founded_weight: number;
  
  // Portfolio & Community
  has_portfolio_online: boolean;    // XX (2pts)
  portfolio_weight: number;
  open_source_contributor: boolean; // XX (2pts)
  open_source_weight: number;
  
  // Backend & Complementary
  backend_knowledge: 'none' | 'firebase' | 'supabase' | 'custom'; // X (1pt)
  backend_weight: number;
  ui_ux_awareness: boolean;         // X (1pt)
  ui_ux_weight: number;
  
  // Innovation
  ai_experience: boolean;           // X (1pt)
  ai_weight: number;
}
```

#### 1.2 Extender interfaz `Campaign`
```typescript
export interface Campaign {
    // ...existing fields...
    settings: {
        // ...existing settings...
        search_filters: SearchFilterCriteria; // NEW
        high_importance_only: boolean;         // NEW - Filter solo XX criteria
        min_score_threshold: number;           // NEW - Default: 70
    };
}
```

---

### **FASE 2: Actualizar Formulario de Crear Campaña**
**Archivo:** `components/CampaignCreationView.tsx`

#### 2.1 Reorganizar estructura del formulario
- **Sección 1: Info Básica** (Título, Rol, Plataforma)
- **Sección 2: Criterios Demográficos** (Edad, Educación)
- **Sección 3: Criterios Técnicos** (XX = 2pts)
  - ✅ Apps Publicadas (iOS/Android)
  - ✅ Experiencia Flutter/Dart
  - ✅ Portfolio Online
  - ✅ Open Source
- **Sección 4: Criterios de Emprendimiento** 
  - ✅ Early Stage Startup Exp (XX)
  - ✅ Fundó SaaS/App (X)
- **Sección 5: Skills Complementarios** (X = 1pt)
  - ✅ Backend (Firebase/Supabase)
  - ✅ UX/UI Design
  - ✅ Experiencia IA
- **Sección 6: Ajustes de Search**
  - Toggle: "Solo Criterios de Alta Importancia (XX)" 
  - Slider: "Score Mínimo Requerido" (60-100)

#### 2.2 Componentes a agregar
```typescript
// Nuevo componente: SearchCriteriaSection
<CriteriasToggleGroup 
  criteria={criteria}
  onCriteriaChange={setCriteria}
/>

// Nuevo componente: WeightSliders
<WeightSlider 
  label="Flutter/Dart Experience Weight"
  value={weights.flutter_dart}
  onChange={(val) => setWeights({...weights, flutter_dart: val})}
/>
```

---

### **FASE 3: Crear Sistema de Scoring**
**Archivo:** `lib/scoring.ts` (NEW)

#### 3.1 Crear función de cálculo de score
```typescript
export function calculateFlutterDeveloperScore(candidate: Candidate, criteria: SearchFilterCriteria): {
  score: number;
  breakdown: ScoreBreakdown;
  passes_threshold: boolean;
} {
  let totalScore = 0;
  const breakdown: ScoreBreakdown = {};

  // Demographics Scoring
  const ageScore = evaluateAge(candidate, criteria);
  totalScore += ageScore;
  breakdown.age = ageScore;

  // Technical Skills (XX)
  const publishedAppsScore = candidate.has_published_apps ? 2 : 0; // TX
  totalScore += publishedAppsScore;
  breakdown.published_apps = publishedAppsScore;

  // ... more scoring logic

  return { 
    score: totalScore, 
    breakdown,
    passes_threshold: totalScore >= 8 // Min 8 pts
  };
}
```

---

### **FASE 4: Actualizar Motor de Búsqueda**
**Archivo:** `lib/SearchEngine.ts`

#### 4.1 Modificar método `startSearch()`
```typescript
public async startSearch(
  query: string,
  source: 'linkedin' | 'github',
  maxResults: number,
  options: {
    language: string;
    maxAge: number;
    filters: SearchFilterCriteria; // NEW
    scoreThreshold: number; // NEW (default: 70)
  },
  onLog: LogCallback,
  onComplete: (candidates: Candidate[]) => void
)
```

#### 4.2 Implementar filtrado con scoring
```typescript
// Dentro de startSearch():
const scoredCandidates = candidates.map(c => ({
  ...c,
  symmetry_score: calculateFlutterDeveloperScore(c, filters).score,
  score_breakdown: calculateFlutterDeveloperScore(c, filters).breakdown
}));

// Filtrar por threshold
const qualifiedCandidates = scoredCandidates.filter(
  c => c.symmetry_score >= scoreThreshold
);
```

---

### **FASE 5: Mejorar Datos de Candidatos**
**Archivo:** `lib/search.ts`

#### 5.1 Enriquecer datos de candidatos MockData
Agregar campos nuevos a cada candidato:
```typescript
const REAL_CANDIDATES_DATA = [
  {
    name: "Javier Gonzalez",
    role: "Senior Flutter Developer",
    // ... existing fields ...
    // NEW FIELDS:
    age: 26,
    has_engineering_degree: true,
    has_published_apps: true,  // App Store link
    published_apps_urls: ['https://apps.apple.com/es/app/...'],
    startup_experience: true,
    startup_companies: ['Leadtech'],
    has_portfolio: true,
    portfolio_url: 'https://javierdev.com',
    open_source_contributor: true,
    github_repos: ['flutter_ui_kit', 'dart_patterns'],
    backend_knowledge: 'firebase',
    ui_ux_awareness: true,
    ai_experience: false,
    founding_experience: false,
    // ... analysis score breakdown ...
  }
]
```

---

### **FASE 6: Actualizar Librerías de Búsqueda**
**Archivo:** `lib/search.ts`

#### 6.1 Crear estrategia específica para Flutter
```typescript
async filterFlutterDevelopers(
  candidates: Candidate[],
  criteria: SearchFilterCriteria
): Promise<Candidate[]> {
  return candidates
    .map(c => ({
      ...c,
      symmetry_score: calculateFlutterDeveloperScore(c, criteria).score
    }))
    .filter(c => c.symmetry_score >= 70)
    .sort((a, b) => b.symmetry_score - a.symmetry_score);
}
```

---

### **FASE 7: Actualizar DetailView**
**Archivo:** `components/DetailView.tsx`

#### 7.1 Mostrar score breakdown
```typescript
// Nuevo componente: ScoreBreakdownCard
<ScoreBreakdownCard
  score={candidate.symmetry_score}
  breakdown={candidate.score_breakdown}
  criteria={campaign.settings.search_filters}
/>
```

#### 7.2 Display de criterios coincidentes
```
✅ Published Apps (iOS/Android) - 2pts
✅ Flutter/Dart Experience - 2pts
✅ Open Source Contributor - 2pts
✅ Early Stage Startup - 2pts
✅ Portfolio Online - 2pts
✅ Age (26 años) - 1pt
✅ AI Experience - 1pt
---
TOTAL SCORE: 14/15 (93%)
```

---

## 📁 Archivos a Crear/Modificar

### **Crear:**
| Archivo | Descripción |
|---------|-------------|
| `lib/scoring.ts` | Sistema de scoring para Flutter Developer |
| `components/CriteriasToggleGroup.tsx` | Componente de toggles para criterios |
| `components/ScoreBreakdownCard.tsx` | Card para mostrar desglose de score |
| `components/WeightSlider.tsx` | Slider para ajustar weights |

### **Modificar:**
| Archivo | Cambios |
|---------|---------|
| `types/database.ts` | Agregar `SearchFilterCriteria` interface |
| `components/CampaignCreationView.tsx` | Agregar 5 secciones de criterios |
| `lib/SearchEngine.ts` | Integrar sistema de scoring |
| `lib/search.ts` | Enriquecer mock data con nuevos campos |
| `components/DetailView.tsx` | Mostrar score breakdown |

---

## 🎯 Order de Implementación Recomendado

1. **Paso 1:** `types/database.ts` - Crear estructuras de datos (30 min)
2. **Paso 2:** `lib/scoring.ts` - Implementar sistema de scoring (45 min)
3. **Paso 3:** `lib/search.ts` - Enriquecer mock data (40 min)
4. **Paso 4:** `components/CampaignCreationView.tsx` - Actualizar formulario (90 min)
5. **Paso 5:** `lib/SearchEngine.ts` - Integrar scoring (45 min)
6. **Paso 6:** Componentes UI nuevos (60 min)
7. **Paso 7:** `components/DetailView.tsx` - Mostrar breakdown (30 min)
8. **Paso 8:** Testing & Refinement (120 min)

**Total Estimado:** ~6-7 horas

---

## 📋 Checklist de Validación

- [ ] Tipos de datos actualizados sin errores TS
- [ ] Formulario captura todos los 11 criterios
- [ ] Sistema de scoring calcula correctamente (max 15pts)
- [ ] Mock data tiene campos enriquecidos
- [ ] Búsqueda filtra por threshold (default 70)
- [ ] DetailView muestra score breakdown
- [ ] Formulario guarda settings en DB correctamente
- [ ] API preserva datos de criterios en JSONB
- [ ] UI responsive en mobile/tablet/desktop
- [ ] No hay valores nulos en scoring

---

## 🧪 Casos de Prueba

### Test 1: High-Quality Flutter Developer
- Age: 26 ✓
- Engineering degree: Yes ✓
- Published apps: 2 ✓
- Flutter/Dart: 4+ years ✓
- Startup exp: Yes ✓
- Portfolio: Yes ✓
- Open source: Yes ✓
- Backend: Firebase ✓
- UX/UI: Yes ✓
- AI exp: No ✗
- **Expected Score:** 13/15 (87%) - **PASS** ✅

### Test 2: Junior with Potential
- Age: 22 ✓
- Engineering degree: Cursing ✓
- Published apps: No ✗
- Flutter/Dart: 1 year ✗
- Startup exp: No ✗
- Portfolio: No ✗
- Open source: Yes ✓
- Backend: No ✗
- UX/UI: No ✗
- AI exp: No ✗
- **Expected Score:** 3/15 (20%) - **REJECT** ❌

### Test 3: Mid-level with Mix
- Age: 28 ✓
- Engineering degree: Yes ✓
- Published apps: Yes ✓
- Flutter/Dart: 2 years ✓
- Startup exp: No ✗
- Portfolio: Yes ✓
- Open source: No ✗
- Backend: Supabase ✓
- UX/UI: No ✗
- AI exp: Yes ✓
- **Expected Score:** 10/15 (67%) - **BORDERLINE** ⚠️

---

## 🚀 Próximos Pasos

Después de implementar el filtro:

1. **Integración con LinkedIn Scraper** - Buscar estos campos en perfiles
2. **Crear template de outreach** personalizado basado en score
3. **A/B Testing** - Comparar conversion rates
4. **Exportar reportes** con score breakdown por candidato
5. **Guardar búsquedas** con criterios específicos

