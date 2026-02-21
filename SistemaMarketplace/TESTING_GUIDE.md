# 🧪 MARKETPLACE REDESIGN - TESTING & VALIDATION GUIDE

## 1. Verification Points

### A. Console Output Validation

**Expected output when scraping:**

```
✅ Actor IDs cargados:
   - Upwork: apify/web-scraper
   - Fiverr: apify/web-scraper
   - LinkedIn: apify/web-scraper

📊 Scraping Upwork...
🔍 Upwork: Iniciando búsqueda con buffer de intentos múltiples...
📊 Upwork: Búsqueda con buffer - Target: 50 candidatos en 5 intentos

[Attempt 1/5] 🔍 Buscando "flutter"...
🔗 Upwork URL: https://www.upwork.com/nx/search/talent/?q=flutter&sort=relevance
🚀 Ejecutando actor: apify/web-scraper
⏳ Actor iniciado, run ID: XYZ123ABC
⏳ Status: RUNNING (tiempo en segundos)
...
⏳ Status: SUCCEEDED
📊 Raw dataset items: 12         ← CAMBIO: Antes era 1
📊 Flattened results: 11         ← NUEVO: Extracción limpia
✅ 11 candidates retrieved       ← CAMBIO: Antes era 0
   ✅ 10 candidates after dedup
   📦 Buffer: 10/50

[Attempt 2/5] 🔍 Buscando ""flutter" Top Rated"...
... (next attempts)

✅ Búsqueda completada: 50 candidatos únicos encontrados
   → Upwork: 50 candidatos
```

**Key Differences from Before:**
- ❌ "✅ 0 resultados raw obtenidos" 
- ✅ "✅ N candidatos retrieved"

### B. TalentScore Validation

Each candidate should have a score from 0-100:

```typescript
// Expected candidate object:
{
  id: "upwork-0-1640000000000",
  name: "Juan Developer",
  platform: "Upwork",
  platformUsername: "juandev",
  profileUrl: "https://www.upwork.com/o/juandev",
  title: "Senior Flutter Developer",
  country: "Spain",
  hourlyRate: 45,
  jobSuccessRate: 92,
  talentScore: 79,  // ← NEW: Calculated score
  skills: ["Flutter", "Dart", "Firebase"],
  scrapedAt: "2026-02-21T12:00:00Z",
  // ... other fields
}
```

**Score Breakdown:**
```
SUCCESS RATE: 92 * 0.4 = 36.8 pts
EXPERIENCE: (50/4) = 12.5 pts (50 jobs)
SKILLS MATCH: 20 pts (has "flutter")
RATE RELEVANCE: 5 pts ($45/hr in ideal range)
RECENCY BONUS: 3 pts (scraped today)
RELEVANCE BONUS: 2 pts (has "Top Rated" badge)

TOTAL: ~79/100
```

**Validation:**
- ✅ MUST have `talentScore` value
- ✅ Score should be 0-100
- ✅ Score should vary based on metrics

### C. Deduplication Validation

Test dedup with multiple runs:

```typescript
// First run: 50 candidates
const run1 = await searchService.scrapeUpwork(filter);
console.log(run1.length); // Expect: 50

// Second run: Same query
const run2 = await searchService.scrapeUpwork(filter);
console.log(run2.length); // Expect: < 50 (some deduplicated)

// Check dedupService stats
const stats = dedupService.getStats();
// {
//   urls: 50,
//   usernames: 48,
//   emails: 0,
//   names: 45
// }
```

**Validation:**
- ✅ Second run should have fewer candidates
- ✅ Stats should show increasing counts
- ✅ No duplicate URLs in results

---

## 2. Integration Testing

### Test 1: MarketplaceRaidService Integration

```typescript
import { MarketplaceRaidService } from './SistemaMarketplace';

const raidService = MarketplaceRaidService.getInstance(
  process.env.VITE_APIFY_API_KEY,
  process.env.VITE_OPENAI_API_KEY
);

const raid = await raidService.startRaid('Test Raid', {
  keyword: 'flutter',
  platforms: ['Upwork'],
  maxResults: 50,
  skills: ['Flutter', 'Dart']
});

console.log('Raid ID:', raid.id);
console.log('Status:', raid.status); // Should be: "Phase 1: Scraping"

const populated = await raidService.executeScraping(raid.id, {
  keyword: 'flutter',
  platforms: ['Upwork'],
  maxResults: 50,
  skills: ['Flutter', 'Dart']
});

console.log('Scraped:', populated.stats.totalScraped); // Should be > 0
console.log('First candidate:', populated.scrapedCandidates[0]);
```

**Expected Output:**
```
Raid ID: 550e8400-e29b-41d4-a716-446655440000
Status: Phase 1: Scraping
Scraped: 50
First candidate: {
  name: "Carlos Flutter Dev",
  platform: "Upwork",
  talentScore: 85,
  ...
}
```

### Test 2: Direct SearchService Usage

```typescript
import { MarketplaceSearchService } from './SistemaMarketplace';

const searchService = new MarketplaceSearchService(apiKey);

// Test Upwork
const upworkResults = await searchService.scrapeUpwork({
  keyword: 'flutter',
  maxResults: 50,
  skills: ['Flutter']
});

console.log('Upwork Results:', upworkResults.length);
upworkResults.forEach(c => {
  console.log(`${c.name} (${c.platform}): ${c.talentScore}/100`);
});

// Expected:
// Flutter Results: 50
// Carlos Flutter (Upwork): 85/100
// Maria Dart Dev (Upwork): 72/100
// ...
```

### Test 3: Deduplication Integration

```typescript
import { MarketplaceSearchService,dedupService } from './SistemaMarketplace';

// Clear previous data
dedupService.clear();

// First search
const results1 = await searchService.scrapeUpwork({keyword: 'flutter', maxResults: 20});
console.log('First search:', results1.length); // 20

// Second search (should find duplicates)
const results2 = await searchService.scrapeUpwork({keyword: 'flutter expert', maxResults: 20});
console.log('Second search:', results2.length); // < 20 (some duplicates)

// Combined list shouldn't have duplicates
const combined = [...results1, ...results2];
const deduped = dedupService.deduplicateArray(combined);
console.log('Combined:', combined.length, 'Deduped:', deduped.length);
// Expected: Combined > Deduped
```

---

## 3. Error Scenarios & Recovery

### Scenario 1: Actor Timeout

**Code:**
```typescript
const results = await searchService.scrapeUpwork(filter);
// If actor times out after 5 minutes, should catch and return []
console.log(results); // []
```

**Expected Behavior:**
- ✅ No crash
- ✅ Returns empty array
- ✅ Error logged to console
- ✅ Continues to next platform if in batch

### Scenario 2: API Key Invalid

**Code:**
```typescript
const searchService = new MarketplaceSearchService('invalid-key');
const results = await searchService.scrapeUpwork(filter);
console.log(results); // []
```

**Expected Behavior:**
- ✅ HTTP 401/403 error caught
- ✅ Returns empty array
- ✅ Error message: "No Apify API key"

### Scenario 3: No Results on Platform

**Code:**
```typescript
const results = await searchService.scrapeUpwork({
  keyword: 'qwerty-zxcv-asdf', // Unlikely to return results
  maxResults: 50
});
console.log(results); // []
```

**Expected Behavior:**
- ✅ 5 attempts with different query variations
- ✅ Each attempt returns 0-5 results
- ✅ Final result: [] (after all attempts exhaust)
- ✅ No crash

---

## 4. Performance Metrics

### Expected Timing

| Operation | Time | Notes |
|-----------|------|-------|
| One actor execution | 15-30s | Depends on Upwork/Fiverr speed |
| Full Upwork search (5 attempts) | 75-150s | 5 actors * 15-30s each |
| Full batch (Upwork + Fiverr + LinkedIn) | 225-450s | 15 actor runs total |
| Score calculation (per candidate) | <1ms | Integrated, negligible |
| Deduplication (50 candidates) | <5ms | Hash/Set lookups |

**Validation:**
```typescript
const start = performance.now();
const results = await searchService.scrapeUpwork(filter);
const elapsed = (performance.now() - start) / 1000;
console.log(`Completed in ${elapsed.toFixed(1)}s`);
// Expected: 75-150s for 5 attempts
```

---

## 5. Quality Checks

### Candidate Data Quality

```typescript
const results = await searchService.scrapeUpwork(filter);

let qualityScore = 0;

results.forEach(c => {
  const checks = [
    c.name && c.name.length > 2,          // ✅ Name present
    c.profileUrl && c.profileUrl.includes('upwork.com'), // ✅ URL valid
    c.talentScore >= 0 && c.talentScore <= 100, // ✅ Score in range
    c.platform === 'Upwork',               // ✅ Platform correct
  ];
  
  const passed = checks.filter(Boolean).length;
  qualityScore += (passed / checks.length);
});

const avgQuality = (qualityScore / results.length) * 100;
console.log(`Average quality: ${avgQuality.toFixed(1)}%`);
// Expected: 95%+
```

### Expected Data Shape

```typescript
// Minimum valid candidate:
{
  id: string,           // ✅ Always present
  name: string,         // ✅ Always > 2 chars
  platform: 'Upwork',   // ✅ One of: Upwork, Fiverr, LinkedIn
  platformUsername: string, // ✅ From URL parsing
  profileUrl: string,   // ✅ Full URL
  talentScore: number,  // ✅ 0-100
  scrapedAt: string,    // ✅ ISO date
}

// Optional but often present:
{
  title: string,
  hourlyRate: number,
  jobSuccessRate: number,
  skills: string[],
  country: string,
}
```

---

## 6. Browser DevTools Testing

### Console Commands for Manual Testing

```javascript
// Access the services directly in console:
const { MarketplaceSearchService } = await import('./SistemaMarketplace/services/marketplaceSearchService.ts');
const searchService = new MarketplaceSearchService('your-api-key');

// Run search:
const results = await searchService.scrapeUpwork({
  keyword: 'flutter',
  maxResults: 10
});

// Inspect results:
console.table(results);
console.log('Total:', results.length);
console.log('Avg Score:', (results.reduce((a, c) => a + c.talentScore, 0) / results.length).toFixed(1));
console.log('Max Score:', Math.max(...results.map(c => c.talentScore)));
console.log('Min Score:', Math.min(...results.map(c => c.talentScore)));
```

### Dedup Service Testing

```javascript
const { dedupService } = await import('./SistemaMarketplace/services/marketplaceDeduplicationService.ts');

// Check stats:
console.log('Dedup Stats:', dedupService.getStats());

// Manual check:
const candidate = results[0];
console.log('Is duplicate?', dedupService.isDuplicate(candidate));

// Register and check again:
dedupService.registerCandidate(candidate);
console.log('Is duplicate now?', dedupService.isDuplicate(candidate));
```

---

## 7. Before/After Comparison

### Test Case: "flutter" search, Upwork

#### BEFORE (Error 🚫)
```
🔍 Upwork: Iniciando búsqueda...
📊 Upwork: Búsqueda con buffer - Target: 50 candidatos en 5 intentos

[Intento 1/5] 🔍 Buscando "flutter"...
🚀 Ejecutando actor: apify/web-scraper
📊 Dataset: 1 items           ← Only 1 item returned
✅ Upwork: 1 resultados raw   ← But...
✅ 0 resultados raw obtenidos ← ...turned into 0 candidates

[Intento 2/5] 🔍 Buscando ""flutter" Top Rated"...
🚀 Ejecutando actor: apify/web-scraper
📊 Dataset: 1 items
✅ Upwork: 1 resultados raw
✅ 0 resultados raw obtenidos

... (repeats 5 times)

✅ Búsqueda completada: 0 candidatos únicos encontrados
   → Upwork: 0 candidatos
```

**Result: ❌ FAILURE - 0 candidates, error repeated**

---

#### AFTER (Working ✅)
```
🔍 Upwork: Starting buffer search... target=50
[Attempt 1/5] Searching: "flutter"
🚀 Ejecutando actor: apify/web-scraper
⏳ Actor iniciado, run ID: IoXdnK0FXfCAnhcet
📊 Raw dataset items: 14
📊 Flattened results: 12
✅ 12 candidates retrieved
   ✅ 11 candidates after dedup
   📦 Buffer: 11/50

[Attempt 2/5] Searching: ""flutter" top rated"
🚀 Ejecutando actor: apify/web-scraper
📊 Raw dataset items: 18
📊 Flattened results: 16
✅ 16 candidates retrieved
   ✅ 15 candidates after dedup
   📦 Buffer: 26/50

[Attempt 3/5] Searching: "flutter "level 1" OR "rising talent""
📊 Raw dataset items: 22
📊 Flattened results: 20
✅ 20 candidates retrieved
   ✅ 19 candidates after dedup
   📦 Buffer: 45/50

[Attempt 4/5] Searching: "flutter freelance remote"
📊 Raw dataset items: 8
📊 Flattened results: 7
✅ 7 candidates retrieved
   ✅ 5 candidates after dedup
   📦 Buffer: 50/50   ✅ Meta alcanzada

✅ Upwork search complete: 50 unique candidates
   → Upwork: 50 candidatos
```

**Result: ✅ SUCCESS - 50 candidates with scores**

---

## 8. Sign-Off Checklist

- [ ] Console output shows 50+ candidates (not 0)
- [ ] Each candidate has a `talentScore` (0-100)
- [ ] Candidates are sorted by score (highest first)
- [ ] No "0 resultados raw obtenidos" error
- [ ] Multiple platforms work (Upwork, Fiverr, LinkedIn)
- [ ] Deduplication works across runs
- [ ] No crashes or unhandled errors
- [ ] Performance is acceptable (< 5 min for all platforms)
- [ ] Data quality is high (95%+ valid candidates)
- [ ] Integration with MarketplaceRaidService works

---

**Last Updated:** 2026-02-21
**Status:** Ready for Testing
