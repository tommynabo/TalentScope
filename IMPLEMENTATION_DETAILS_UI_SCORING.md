# 🎨 Estructura Detallada: Formulario y Sistema de Scoring

## 📋 Nuevo Formulario de Crear Campaña - Layout Propuesto

```
┌─────────────────────────────────────────────────────────────────┐
│  ← New Campaign                                        🗑️ Delete │
│  Configure search parameters and "A-Player" signals              │
└─────────────────────────────────────────────────────────────────┘

┌─ SECTION 1: CAMPAIGN BASICS ──────────────────────────────────────┐
│                                                                     │
│  Campaign Title *                    Platform                      │
│  [Flutter Q1 Search          ]        [LinkedIn    ▼]             │
│                                                                     │
│  Target Role *                      Search Source                  │
│  [Flutter Developer         ]        [LinkedIn    ▼]             │
│  (e.g. Product Engineer)                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─ SECTION 2: DEMOGRAPHIC CRITERIA ─────────────────────────────────┐
│  💼 Basic Requirements                                             │
│                                                                     │
│  Age Range *                                                       │
│  [18 ─────●───────────── 35]  Currently: 18-35 years            │
│                                                                     │
│  ☑ Has Engineering Degree *                    Importance: X       │
│    [ ] Do NOT require                                             │
│    [✓] Prefer (cursing or completed)                              │
│    [ ] MUST have (strict filter)                                  │
│                                                                     │
│  Language / Region *                                              │
│  [Spanish    ▼]                                                   │
│                                                                     │
│  Min. Years Experience *                                          │
│  [3 years   ▼]                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─ SECTION 3: TECHNICAL SKILLS (HIGH IMPORTANCE) ────────────────────┐
│  🚀 Core Requirements - XX = 2 Points Each                         │
│                                                                     │
│  Published Apps (iOS/Android) **                  2pts each      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☑ Published Apps on App Store / Play Store                 │  │
│  │   (Links to publicly launched apps required in profile)     │  │
│  │ [✓] Required  [ ] Preferred  [ ] Nice to have             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Flutter / Dart Experience **                    2pts each       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☑ Demonstrated Flutter/Dart Development                    │  │
│  │   (Professional exp, projects, or portfolio)                │  │
│  │ [✓] Required  [ ] Preferred  [ ] Nice to have             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Online Portfolio **                             2pts each       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☑ Personal Portfolio / Personal Website                     │  │
│  │   (GitHub, Dev.to, personal blog, or portfolio site)        │  │
│  │ [✓] Required  [ ] Preferred  [ ] Nice to have             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Open Source Contributions **                    2pts each       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☑ GitHub Activity / Open Source Projects                    │  │
│  │   (Committed, contributions, or owned repos)                │  │
│  │ [✓] Required  [ ] Preferred  [ ] Nice to have             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─ SECTION 4: ENTREPRENEURSHIP & STARTUP MINDSET ────────────────────┐
│  🌟 Entrepreneurial Background                                     │
│                                                                     │
│  Early-Stage Startup Experience **               2pts            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☑ Worked at early-stage startup (seed/Series A/B)          │  │
│  │   (Joined at <50 employees or <$2M raised)                 │  │
│  │ [✓] Required  [ ] Preferred  [ ] Nice to have             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Founded Business / SaaS / App *                 1pt             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☑ Founder or co-founder of SaaS, App, or Software Agency   │  │
│  │   (Any stage - MVP to profitable)                           │  │
│  │ [ ] Required  [✓] Preferred  [ ] Nice to have             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─ SECTION 5: COMPLEMENTARY SKILLS (SECONDARY) ──────────────────────┐
│  ⚡ Nice-to-have Skills - X = 1 Point Each                         │
│                                                                     │
│  Backend Knowledge *                             1pt             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Please select:                                              │  │
│  │ [ ] Not required                                            │  │
│  │ [ ] Firebase / Firestore experience                         │  │
│  │ [✓] Supabase / PostgreSQL experience                        │  │
│  │ [ ] Custom backend (Node, Django, etc.)                     │  │
│  │ [ ] All of the above (show all counts as 1pt)              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  UX/UI Design Awareness *                        1pt             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☑ Has strong UX/UI sensibility or design skills            │  │
│  │   (Design thinking, Figma experience, or design portfolio)  │  │
│  │ [ ] Required  [✓] Preferred  [ ] Nice to have             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  AI Experience *                                 1pt             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☑ Experience applying AI/ML (LLMs, embeddings, ML models)   │  │
│  │   (Projects, production use, or public contributions)       │  │
│  │ [ ] Required  [✓] Preferred  [ ] Nice to have             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─ SECTION 6: SEARCH CONFIGURATION ─────────────────────────────────┐
│  🔧 Advanced Settings                                              │
│                                                                     │
│  Custom Keywords (Boolean Search)                                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ (Flutter OR Dart) AND (Startup OR Founder)                 │  │
│  │ Add more: AND NOT "CTO" AND NOT "India"                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Minimum Match Score Threshold                                   │
│  [60 ────────●─────────── 100]  Currently: 70/100 (Good Match)  │
│  Only show candidates with score ≥ 70 points                     │
│                                                                     │
│  ☑ High Importance Candidates Only                               │
│  [✓] Filter to XX criteria only (ignore single X criteria)      │  │
│  This will find: Apps + Flutter + Portfolio + Open Source +     │  │
│                 Startup Exp: Minimum 8 mandatory points         │  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─ SCORE CALCULATOR SUMMARY ───────────────────────────────────────────┐
│                                                                       │
│  Based on your selections, you will look for:                       │
│                                                                       │
│  MUST HAVE (Required - 4pts minimum):                               │
│    ✓ Flutter/Dart Experience (2pts)                                 │
│    ✓ Published App (2pts)                                           │
│                                                                       │
│  STRONG SIGNALS (Preferred - 8pts if all):                          │
│    ✓ Portfolio (2pts)                                               │
│    ✓ Open Source (2pts)                                             │
│    ✓ Startup Exp (2pts)                                             │
│    ✓ Engineering Degree (1pt)                                       │
│    ✓ Age 18-30 (1pt)                                                │
│                                                                       │
│  BONUS (Nice-to-have - up to 3pts):                                 │
│    • Backend Knowledge (+1pt)                                       │
│    • UX/UI Awareness (+1pt)                                         │
│    • AI Experience (+1pt)                                           │
│                                                                       │
│  ═══════════════════════════════════════════════════════             │
│  EXPECTED SCORE RANGE: 4-15 points (Low to Perfect Match)          │
│  YOUR FILTER THRESHOLD: 70/100 (8+ points minimum)                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────────┘

                  [  Launch Campaign  ]  or  [  Cancel  ]
```

---

## 🎯 Scoring System Flowchart

```

┌─────────────────────────┐
│   Candidate Profile     │
│  (Full name, email,     │
│   LinkedIn, GitHub,     │
│   Experience, etc)      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Extract Candidate Attributes           │
│  - Age/Birth Year from profile           │
│  - Education history parsing             │
│  - Work history analysis (App Store,     │
│    startup mentions, GitHub activity)    │
│  - Portfolio links detection             │
│  - Open source repos count               │
│  - Founder/entrepreneur signals          │
│  - Backend tech mentions                 │
│  - Design portfolio presence             │
│  - AI/ML project mentions                │
└────────────┬────────────────────────────┘
             │
             ▼
    ┌──────────────────────┐
    │   Load Campaign      │
    │   Filter Criteria    │
    │   (SearchFilterCriteria)
    │   and Weights        │
    │   from Database      │
    └──────┬───────────────┘
           │
           ├─────────────────────────────────────────┐
           │                                         │
           ▼                                         ▼
    ┌────────────────────┐              ┌──────────────────────┐
    │  Score Each        │              │  Match Against       │
    │  Criterion         │              │  Filter Settings     │
    │  (0 or weight pts) │              │  (Required/Preferred)│
    │                    │              └──────────────────────┘
    │ A) Age -> 0-1pt    │
    │ B) Eng.Degree->0-1 │
    │ C) Apps -> 0-2pt   │         ┌────────────────────────┐
    │ D) Flutter -> 0-2  │         │  Calculate Final       │
    │ E) Portfolio->0-2  │         │  Symmetry Score        │
    │ F) OpenSource->0-2 │         │                        │
    │ G) Startup -> 0-2  │         │  score = sum(        │
    │ H) Founder -> 0-1  │         │    criterion_pts       │
    │ I) Backend -> 0-1  │         │  )                     │
    │ J) Design -> 0-1   │         │                        │
    │ K) AI -> 0-1       │         │  Normalize to 100:     │
    │                    │         │  normalized_score =    │
    │ ──────────────────│         │  (score / 15) * 100    │
    │ TOTAL: 0-15 pts   │         │                        │
    └────────────────────┘         └────────┬───────────────┘
           │                                 │
           └─────────────────┬───────────────┘
                             │
                             ▼
                ┌─────────────────────────────┐
                │  Apply Threshold Filter      │
                │                              │
                │  if (score >= 8 pts)  ✅      │
                │     Show Candidate           │
                │  else                ❌      │
                │     Filter Out               │
                │                              │
                │  (User configurable:         │
                │   60-100 range = 4-15pts)    │
                └────────────┬─────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
           ┌─────────┐             ┌──────────┐
           │  ACCEPT │             │  REJECT  │
           │ (Show)  │             │ (Filter) │
           └─────────┘             └──────────┘
```

---

## 📊 Scoring Examples & Edge Cases

### Example 1: Perfect Candidate
```
Candidate: Miguel García, 28 years old

Attributes Found:
✅ Age 28 (in 18-30 range): 1pt
✅ Engineering degree (CS from Universidad Autónoma): 1pt  
✅ 2 Published apps (iOS App Store + Google Play): 2pts
✅ 5 years Flutter experience (Leadtech, 3 other startups): 2pts
✅ Portfolio: https://migueldev.com with case studies: 2pts
✅ Active open source: 12 repos, 200+ stars: 2pts
✅ Founded a SaaS (2022): 1pt
✅ Supabase + Firebase experience: 1pt
✅ Design thinking + Figma skills: 1pt
✅ Used LLMs in an app feature: 1pt

TOTAL: 15/15 (100%)
Decision: ✅ HIRE - Perfect Match
```

### Example 2: Strong Candidate
```
Candidate: Ana Martínez, 26 years old

✅ Age 26: 1pt
✅ Engineering Technology degree: 1pt
✅ 1 Published iOS app (under her name): 2pts
✅ 3 years Flutter at early-stage startup: 2pts
✅ Personal blog + GitHub portfolio: 2pts
❌ Open source: No (personal projects only): 0pts
❌ Founded business: No: 0pts
✅ Firebase background: 1pt
✅ Designed some app UI prototypes: 1pt
❌ No AI experience: 0pts

TOTAL: 10/15 (67%)
Threshold: 70 needed
Decision: ⚠️ BORDERLINE - Just below threshold
```

### Example 3: Junior with Potential  
```
Candidate: Carlos López, 22 years old

✅ Age 22: 1pt
✅ Cursing Engineering (3rd year): 1pt
❌ Published apps: No: 0pts
✅ 1 year Flutter freelance: 2pts
❌ Portfolio: Personal GitHub only: 0pts
✅ Active open source contributor: 2pts
❌ Startup experience: No, only freelance: 0pts
❌ Founder: No: 0pts
❌ Backend knowledge: No: 0pts
❌ Design: No: 0pts
❌ AI: No: 0pts

TOTAL: 6/15 (40%)
Decision: ❌ REJECT - Below 70 threshold
Recommendation: Save for "Junior Flutter Track" if needed
```

### Example 4: Experienced Non-Flutter Dev
```
Candidate: Roberto Villanueva, 32 years old

❌ Age 32 (outside 18-30): 0pts
✅ Engineering degree: 1pt
✅ 3 published apps (but React Native, not Flutter): 1pt (partial)
❌ Flutter: No (React Native expert instead): 0pts
✅ Strong portfolio: 2pts
✅ GitHub contributor: 2pts
✅ Founded startup (exited): 1pt
✅ Node.js backend expertise: 1pt
✅ Design-minded: 1pt
✅ AI ML experience: 1pt

TOTAL: 10/15 by criteria, but Flutter weight = 0
Decision: ❌ REJECT - Core tech stack mismatch (can't translate React Native smoothly to Flutter)
Note: Age also outside range
```

---

## 🔄 Integration with Existing Search Engine

### Current Flow (Old):
```
User Input → SearchEngine.startSearch() 
→ LinkedIn API
→ Filter by keywords only
→ Return all candidates
→ DetailView displays with generic score
```

### New Flow:
```
User Input (with new filters)
    ↓
FormData → SearchFilterCriteria (JSON → DB)
    ↓
SearchEngine.startSearch({
    query, 
    source,
    maxResults,
    filters: SearchFilterCriteria,  // NEW
    scoreThreshold: 70              // NEW
})
    ↓
Get candidates from LinkedIn/Mock Data
    ↓
For each candidate:
    - Extract attributes
    - calculateFlutterDeveloperScore()
    - If score ≥ threshold: KEEP
    - Else: FILTER OUT
    ↓
Sort by score DESC
    ↓
Return qualified.slice(0, maxResults)
    ↓
DetailView displays with:
    - Symmetry Score (normalized 0-100)
    - Score Breakdown (A-Player signals)
    - Color coding (Green: 80+, Yellow: 70-79, Red: <70)
```

---

## 🛠️ Mock Data Structure Update

Currently in `lib/search.ts`:
```typescript
const REAL_CANDIDATES_DATA = [
  {
    name: "Javier Gonzalez",
    role: "Senior Flutter Developer",
    company: "Leadtech",
    location: "Barcelona, Spain",
    linkedin: "https://linkedin.com/in/javierdev",
    github: "https://github.com/javierdev",
    // OLD analysis field with generic scoring
    analysis: "..."
  }
]
```

Will become:
```typescript
const REAL_CANDIDATES_DATA = [
  {
    name: "Javier Gonzalez",
    role: "Senior Flutter Developer",
    company: "Leadtech",
    location: "Barcelona, Spain",
    linkedin: "https://linkedin.com/in/javierdev",
    github: "https://github.com/javierdev",
    
    // NEW Flutter-specific fields
    age: 26,
    education: {
      degree: "Engineering (Software)",
      university: "UAB",
      graduation_year: 2018
    },
    published_apps: {
      has_apps: true,
      apps: [
        { name: "FlutterUI Kit", platform: "both", url: "https://apps.apple.com/es/app..." }
      ]
    },
    technical_skills: {
      flutter_dart: { years: 5, proficiency: "expert" },
      backend: "firebase+supabase",
      ui_ux_aware: true,
      ai_experience: false
    },
    entrepreneurship: {
      startup_experience: [
        { company: "Leadtech", stage: "early", employees_at_join: 20 }
      ],
      founded_businesses: false
    },
    community: {
      portfolio_url: "https://javierdev.com",
      open_source: {
        active: true,
        github_repos: 15,
        stars: 200,
        contributions_last_year: 150
      }
    },
    
    // Analysis updated with scoring breakdown
    analysis_flutter: {
      scores: {
        age: 1,
        education: 1,
        published_apps: 2,
        flutter_dart: 2,
        portfolio: 2,
        open_source: 2,
        startup_exp: 2,
        founded: 0,
        backend: 1,
        design: 1,
        ai: 0
      },
      total: 14,
      normalized: 93,
      pass_threshold: true,
      reasoning: [
        "Excellent Flutter expert with 5 years experience",
        "2 published apps show market validation",
        "Strong community presence (200 stars)",
        "Perfect fit for early-stage startup culture"
      ]
    }
  }
]
```

---

## ✅ Validation Checklist by Component

### CampaignCreationView.tsx
- [ ] All 11 criteria have UI inputs
- [ ] Weights default to correct importance levels
- [ ] Form validates before submission
- [ ] Settings JSONB saves all criteria values
- [ ] Score calculator preview updates in real-time
- [ ] Mobile responsive (scrollable for long form)

### Scoring System (lib/scoring.ts)
- [ ] Each criterion calculates correctly
- [ ] Total score never exceeds 15 points
- [ ] Threshold comparison works (≥ 8pts = pass)
- [ ] Normalization to 100 is correct ((score/15)*100)
- [ ] Edge cases handled (null values, missing data)
- [ ] Color coding logic matches thresholds

### SearchEngine.ts Integration
- [ ] Filter criteria passed to scoring function
- [ ] Threshold filtering applied before return
- [ ] Sorted by score descending
- [ ] Score metadata included in Candidate object

### DetailView.tsx
- [ ] Score breakdown card displays all 11 criteria
- [ ] Color changes based on score (green/yellow/red)
- [ ] Breakdown shows which criteria candidate passes
- [ ] Score display prominent but not overwhelming

