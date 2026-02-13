# 🚀 Quick Implementation Reference Guide

## 📑 Rápido Índice por Tarea

| Tarea | Archivo | Líneas | Complejidad | Tiempo |
|-------|---------|--------|------------|--------|
| Crear tipos | `types/database.ts` | +80 | 🟢 Fácil | 30min |
| Scoring logic | `lib/scoring.ts` | ~200 | 🟡 Medio | 45min |
| Enriquecer datos | `lib/search.ts` | +150 | 🟡 Medio | 40min |
| Formulario | `components/CampaignCreationView.tsx` | +250 | 🔴 Difícil | 90min |
| Integración motor | `lib/SearchEngine.ts` | +50 | 🟡 Medio | 45min |
| Componentes UI | `components/*` | +300 | 🟡 Medio | 60min |
| DetailView | `components/DetailView.tsx` | +100 | 🟡 Medio | 30min |

---

## 💡 Code Snippets Listos para Copy-Paste

### 1️⃣ Snippet: Tipos dato nueva (types/database.ts)

```typescript
// ADD to types/database.ts after existing interfaces

export type CriterionImportance = 'X' | 'XX';
export type CriterionMatch = 'required' | 'preferred' | 'nice_to_have';

export interface SearchFilterCriteria {
  // Demografía
  min_age: number;
  max_age: number;
  
  has_engineering_degree: boolean;
  engineering_match: CriterionMatch;
  
  // Experiencia Técnica (XX = 2pts)
  has_published_apps: boolean;
  published_apps_match: CriterionMatch;
  
  has_flutter_dart_exp: boolean;
  flutter_dart_match: CriterionMatch;
  
  has_portfolio_online: boolean;
  portfolio_match: CriterionMatch;
  
  open_source_contributor: boolean;
  open_source_match: CriterionMatch;
  
  // Emprendimiento
  startup_early_stage_exp: boolean;
  startup_match: CriterionMatch;
  
  founded_business: boolean;
  founded_match: CriterionMatch;
  
  // Skills Complementarios (X = 1pt)
  backend_knowledge: 'none' | 'firebase' | 'supabase' | 'custom';
  backend_match: CriterionMatch;
  
  ui_ux_awareness: boolean;
  ui_ux_match: CriterionMatch;
  
  ai_experience: boolean;
  ai_match: CriterionMatch;
}

export interface ScoreBreakdown {
  age: number;
  education: number;
  published_apps: number;
  flutter_dart: number;
  portfolio: number;
  open_source: number;
  startup: number;
  founder: number;
  backend: number;
  ui_ux: number;
  ai: number;
  total: number;
  normalized: number;
  passes_threshold: boolean;
}

// Update Campaign interface
export interface Campaign {
  // ... existing fields ...
  settings: {
    // ... existing settings ...
    search_filters?: SearchFilterCriteria;
    score_threshold?: number; // default: 70
    high_importance_only?: boolean; // default: false
    created_at?: string;
  };
}
```

---

### 2️⃣ Snippet: Sistema de Scoring (lib/scoring.ts - NEW FILE)

```typescript
// lib/scoring.ts - CREATE NEW FILE

import { Candidate } from '../types/database';
import { SearchFilterCriteria, ScoreBreakdown } from '../types/database';

export function calculateFlutterDeveloperScore(
  candidate: Candidate,
  criteria: SearchFilterCriteria
): { score: number; breakdown: ScoreBreakdown; passes_threshold: boolean } {
  
  const breakdown: ScoreBreakdown = {
    age: 0,
    education: 0,
    published_apps: 0,
    flutter_dart: 0,
    portfolio: 0,
    open_source: 0,
    startup: 0,
    founder: 0,
    backend: 0,
    ui_ux: 0,
    ai: 0,
    total: 0,
    normalized: 0,
    passes_threshold: false
  };

  // 1. Age (0-1pt)
  const candidateAge = extractAge(candidate);
  if (candidateAge && candidateAge >= criteria.min_age && candidateAge <= criteria.max_age) {
    breakdown.age = 1;
  }

  // 2. Engineering Degree (0-1pt)
  if (criteria.has_engineering_degree && hasEngineeringDegree(candidate)) {
    breakdown.education = 1;
  }

  // 3. Published Apps (0-2pts)
  if (criteria.has_published_apps && hasPublishedApps(candidate)) {
    breakdown.published_apps = 2;
  }

  // 4. Flutter/Dart Experience (0-2pts)
  if (criteria.has_flutter_dart_exp && hasFlutterDartExperience(candidate)) {
    breakdown.flutter_dart = 2;
  }

  // 5. Portfolio Online (0-2pts)
  if (criteria.has_portfolio_online && hasPortfolio(candidate)) {
    breakdown.portfolio = 2;
  }

  // 6. Open Source (0-2pts)
  if (criteria.open_source_contributor && hasOpenSourceActivity(candidate)) {
    breakdown.open_source = 2;
  }

  // 7. Startup Experience (0-2pts)
  if (criteria.startup_early_stage_exp && hasStartupExperience(candidate)) {
    breakdown.startup = 2;
  }

  // 8. Founded Business (0-1pt)
  if (criteria.founded_business && hasFoundedBusiness(candidate)) {
    breakdown.founder = 1;
  }

  // 9. Backend Knowledge (0-1pt)
  if (criteria.backend_knowledge !== 'none' && hasBackendKnowledge(candidate, criteria.backend_knowledge)) {
    breakdown.backend = 1;
  }

  // 10. UX/UI Awareness (0-1pt)
  if (criteria.ui_ux_awareness && hasUIUXAwareness(candidate)) {
    breakdown.ui_ux = 1;
  }

  // 11. AI Experience (0-1pt)
  if (criteria.ai_experience && hasAIExperience(candidate)) {
    breakdown.ai = 1;
  }

  // Calculate total
  breakdown.total = 
    breakdown.age + 
    breakdown.education + 
    breakdown.published_apps + 
    breakdown.flutter_dart + 
    breakdown.portfolio + 
    breakdown.open_source + 
    breakdown.startup + 
    breakdown.founder + 
    breakdown.backend + 
    breakdown.ui_ux + 
    breakdown.ai;

  // Normalize to 100 (max 15 points)
  breakdown.normalized = Math.round((breakdown.total / 15) * 100);
  breakdown.passes_threshold = breakdown.total >= 8; // minimum 8pts

  return {
    score: breakdown.total,
    breakdown,
    passes_threshold: breakdown.passes_threshold
  };
}

// Helper functions - Detection logic
function extractAge(candidate: Candidate): number | null {
  // Try to extract from experience_years or LinkedIn profile
  // Placeholder: would need actual LinkedIn API or parsing
  return null;
}

function hasEngineeringDegree(candidate: Candidate): boolean {
  if (!candidate.education) return false;
  const engineeringKeywords = ['engineering', 'computer science', 'informática', 'software', 'ingeniería'];
  return engineeringKeywords.some(kw => candidate.education?.toLowerCase().includes(kw));
}

function hasPublishedApps(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  // Check for iOS App Store or Google Play mentions
  const storeKeywords = ['app store', 'google play', 'published app', 'shipped product'];
  return storeKeywords.some(kw => candidate.ai_analysis?.toLowerCase().includes(kw));
}

function hasFlutterDartExperience(candidate: Candidate): boolean {
  if (!candidate.skills) return false;
  return candidate.skills.some(skill => 
    ['flutter', 'dart'].includes(skill.toLowerCase())
  );
}

function hasPortfolio(candidate: Candidate): boolean {
  if (!candidate.github_url && !candidate.ai_analysis) return false;
  // Check for portfolio URL or website mentions
  const analysisLower = candidate.ai_analysis?.toLowerCase() || '';
  const portfolioKeywords = ['portfolio', 'website', 'personal site', '.com'];
  return portfolioKeywords.some(kw => analysisLower.includes(kw));
}

function hasOpenSourceActivity(candidate: Candidate): boolean {
  if (!candidate.github_url) return false;
  // For mock data, check GitHub URL existence and profile analysis
  return candidate.github_url.includes('github.com');
}

function hasStartupExperience(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  const startupKeywords = ['startup', 'early stage', 'seed', 'series a', 'series b', 'founder'];
  return startupKeywords.some(kw => candidate.ai_analysis?.toLowerCase().includes(kw));
}

function hasFoundedBusiness(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  const founderKeywords = ['founded', 'founder', 'saas', 'agency', 'own company', 'cofounded'];
  return founderKeywords.some(kw => candidate.ai_analysis?.toLowerCase().includes(kw));
}

function hasBackendKnowledge(candidate: Candidate, expectedBackend: string): boolean {
  if (!candidate.skills) return false;
  const backendMap: { [key: string]: string[] } = {
    'firebase': ['firebase', 'firestore'],
    'supabase': ['supabase', 'postgresql', 'postgres'],
    'custom': ['node', 'django', 'python', 'express', 'fastapi']
  };
  const keywords = backendMap[expectedBackend] || [];
  return keywords.some(kw => candidate.skills?.some(s => s.toLowerCase().includes(kw)));
}

function hasUIUXAwareness(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  const designKeywords = ['design', 'figma', 'ui/ux', 'user experience', 'design thinking'];
  return designKeywords.some(kw => candidate.ai_analysis?.toLowerCase().includes(kw));
}

function hasAIExperience(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  const aiKeywords = ['ai', 'machine learning', 'llm', 'gpt', 'embeddings', 'neural', 'ml model'];
  return aiKeywords.some(kw => candidate.ai_analysis?.toLowerCase().includes(kw));
}

// Utility function for threshold checking
export function getScoreColor(normalizedScore: number): string {
  if (normalizedScore >= 80) return 'text-green-400'; // Excellent
  if (normalizedScore >= 70) return 'text-yellow-400'; // Good
  return 'text-red-400'; // Below threshold
}

export function getScoreLabel(normalizedScore: number): string {
  if (normalizedScore >= 90) return 'A-Player 🌟';
  if (normalizedScore >= 80) return 'Strong Match ✅';
  if (normalizedScore >= 70) return 'Good Candidate ⚠️';
  return 'Below Threshold ❌';
}
```

---

### 3️⃣ Snippet: Integración SearchEngine (lib/SearchEngine.ts - MODIFY)

```typescript
// Inside SearchEngine.ts - Modify startSearch() method

public async startSearch(
  query: string,
  source: 'linkedin' | 'github' | 'communities',
  maxResults: number,
  options: {
    language: string;
    maxAge: number;
    filters?: SearchFilterCriteria;      // ← NEW PARAM
    scoreThreshold?: number;              // ← NEW PARAM (default 70)
  },
  onLog: LogCallback,
  onComplete: (candidates: Candidate[]) => void
) {
  this.isRunning = true;
  
  try {
    let results: Candidate[] = [];
    
    if (source === 'linkedin') {
      results = await this.startFastSearch(query, maxResults, onLog, onComplete);
    }
    
    // ← NEW: Apply scoring and filtering
    if (options.filters) {
      onLog(`[Scoring] Applying Flutter Developer filter criteria...`);
      
      const { calculateFlutterDeveloperScore } = await import('./scoring');
      
      results = results
        .map(candidate => {
          const scoring = calculateFlutterDeveloperScore(candidate, options.filters!);
          return {
            ...candidate,
            symmetry_score: scoring.breakdown.normalized,
            score_breakdown: scoring.breakdown
          };
        })
        .filter(c => c.symmetry_score >= (options.scoreThreshold || 70))
        .sort((a, b) => (b.symmetry_score || 0) - (a.symmetry_score || 0));
      
      onLog(`[Scoring] Filtered to ${results.length} candidates above threshold`);
    }
    
    onComplete(results.slice(0, maxResults));
  } catch (error) {
    onLog(`[Error] ${error}`);
  } finally {
    this.isRunning = false;
  }
}
```

---

### 4️⃣ Snippet: Componente Score Breakdown (components/ScoreBreakdownCard.tsx - NEW)

```typescript
// components/ScoreBreakdownCard.tsx - CREATE NEW FILE

import React from 'react';
import { Check, X } from 'lucide-react';
import { ScoreBreakdown } from '../types/database';

interface ScoreBreakdownCardProps {
  score: number;
  breakdown: ScoreBreakdown;
  candidateName?: string;
}

export const ScoreBreakdownCard: React.FC<ScoreBreakdownCardProps> = ({
  score,
  breakdown,
  candidateName
}) => {
  const scoreColor = score >= 80 ? 'text-green-400' : 
                     score >= 70 ? 'text-yellow-400' : 'text-red-400';
  
  const scoreBgColor = score >= 80 ? 'bg-green-950/30 border-green-500/20' :
                       score >= 70 ? 'bg-yellow-950/30 border-yellow-500/20' : 
                       'bg-red-950/30 border-red-500/20';

  const criteria = [
    { label: 'Age', points: breakdown.age, max: 1 },
    { label: 'Engineering Degree', points: breakdown.education, max: 1 },
    { label: 'Published Apps', points: breakdown.published_apps, max: 2 },
    { label: 'Flutter/Dart Experience', points: breakdown.flutter_dart, max: 2 },
    { label: 'Online Portfolio', points: breakdown.portfolio, max: 2 },
    { label: 'Open Source Activity', points: breakdown.open_source, max: 2 },
    { label: 'Startup Experience', points: breakdown.startup, max: 2 },
    { label: 'Founded Business', points: breakdown.founder, max: 1 },
    { label: 'Backend Knowledge', points: breakdown.backend, max: 1 },
    { label: 'UX/UI Awareness', points: breakdown.ui_ux, max: 1 },
    { label: 'AI Experience', points: breakdown.ai, max: 1 }
  ];

  return (
    <div className={`rounded-xl border p-4 ${scoreBgColor}`}>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-slate-300">
            {candidateName ? `${candidateName} - Score Breakdown` : 'Score Breakdown'}
          </h3>
          <span className={`text-2xl font-bold ${scoreColor}`}>{breakdown.normalized}/100</span>
        </div>
        <div className="w-full bg-slate-950 rounded-full h-2">
          <div
            className={`h-full rounded-full transition-all ${
              breakdown.normalized >= 80 ? 'bg-green-500' :
              breakdown.normalized >= 70 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${breakdown.normalized}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {criteria.map(criterion => (
          <div key={criterion.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {criterion.points > 0 ? (
                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
              ) : (
                <X className="h-4 w-4 text-gray-500 flex-shrink-0" />
              )}
              <span className={criterion.points > 0 ? 'text-slate-200' : 'text-slate-500'}>
                {criterion.label}
              </span>
            </div>
            <span className="text-slate-400">
              {criterion.points}/{criterion.max}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between">
        <span className="text-xs font-semibold text-slate-300">Total Points</span>
        <span className={`text-sm font-bold ${scoreColor}`}>
          {breakdown.total}/15
        </span>
      </div>
    </div>
  );
};
```

---

### 5️⃣ Snippet: Actualizar DetailView (components/DetailView.tsx - MODIFY)

```typescript
// Inside DetailView.tsx - After existing imports, add:

import { ScoreBreakdownCard } from './ScoreBreakdownCard';

// Inside the render where candidates are displayed, add this after candidate row:
{selectedCandidate && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
      {/* Candidate header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <img 
            src={selectedCandidate.avatar_url} 
            alt={selectedCandidate.full_name}
            className="h-16 w-16 rounded-full"
          />
          <div>
            <h2 className="text-2xl font-bold text-white">{selectedCandidate.full_name}</h2>
            <p className="text-slate-400">{selectedCandidate.job_title}</p>
          </div>
        </div>
        <button onClick={() => setSelectedCandidate(null)} className="text-slate-500 hover:text-white">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Score Breakdown - NEW */}
      {selectedCandidate.score_breakdown && (
        <div className="mb-6">
          <ScoreBreakdownCard
            score={selectedCandidate.symmetry_score || 0}
            breakdown={selectedCandidate.score_breakdown}
            candidateName={selectedCandidate.full_name}
          />
        </div>
      )}

      {/* Rest of candidate details ... */}
    </div>
  </div>
)}
```

---

## 🧪 Testing Checklist

### Unit Tests (Scoring Logic)
```typescript
describe('calculateFlutterDeveloperScore', () => {
  test('should calculate perfect candidate score', () => {
    const result = calculateFlutterDeveloperScore(perfectDevCandidate, filterCriteria);
    expect(result.breakdown.total).toBe(15);
    expect(result.breakdown.normalized).toBe(100);
    expect(result.passes_threshold).toBe(true);
  });

  test('should filter out junior candidate', () => {
    const result = calculateFlutterDeveloperScore(juniorDevCandidate, filterCriteria);
    expect(result.breakdown.total).toBeLessThan(8);
    expect(result.passes_threshold).toBe(false);
  });
});
```

### Integration Tests
- [ ] Form submission saves all 11 criteria
- [ ] SearchEngine uses correct threshold
- [ ] Score breakdown displays in DetailView
- [ ] Candidates filtered correctly (examples 1-4 above)
- [ ] Mock data returns expected scores
- [ ] Score normalized correctly to 0-100

### E2E Tests
- [ ] Create campaign with all criteria checked
- [ ] Run search and verify only ≥70 candidates shown
- [ ] Click on candidate and see score breakdown
- [ ] Export includes score information

---

## 📝 Migration Notes

### Para Campañas Existentes
Si hay campañas en la DB sin los nuevos campos:

```typescript
// Run migration in DetailView or on app startup:
const migrateOldCampaign = (campaign: Campaign): Campaign => {
  if (!campaign.settings?.search_filters) {
    return {
      ...campaign,
      settings: {
        ...campaign.settings,
        search_filters: getDefaultFlutterFilters(), // Define defaults
        score_threshold: 70
      }
    };
  }
  return campaign;
};

function getDefaultFlutterFilters(): SearchFilterCriteria {
  return {
    min_age: 18,
    max_age: 30,
    has_engineering_degree: true,
    engineering_match: 'preferred',
    has_published_apps: true,
    published_apps_match: 'required',
    has_flutter_dart_exp: true,
    flutter_dart_match: 'required',
    has_portfolio_online: true,
    portfolio_match: 'preferred',
    open_source_contributor: true,
    open_source_match: 'preferred',
    startup_early_stage_exp: true,
    startup_match: 'preferred',
    founded_business: false,
    founded_match: 'nice_to_have',
    backend_knowledge: 'supabase',
    backend_match: 'nice_to_have',
    ui_ux_awareness: true,
    ui_ux_match: 'nice_to_have',
    ai_experience: false,
    ai_match: 'nice_to_have'
  };
}
```

---

## 🐛 Common Issues & Solutions

| Problema | Causa | Solución |
|----------|-------|----------|
| Score siempre 0 | Detection functions retornan false | Verificar candidate data structure (skills array, ai_analysis string) |
| Formulario no guarda | Missing JSON serialization | Verificar SearchFilterCriteria se serializa correctamente |
| NaN normalized score | Division por cero | Verificar breakdown.total no sea null |
| Todos candidatos filtrados | Threshold muy alto | Default a 70 (35.7 pts en scale 0-15 = ~8pts) |
| Performance lento | Calcular score para todos | Implementar client-side caching de scores |

