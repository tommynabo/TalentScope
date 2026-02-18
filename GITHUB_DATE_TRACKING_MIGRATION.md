# GitHub Date Tracking Migration Guide

## 🎯 Problem

LinkedIn's system uses a **junction table** (`CampaignCandidate`) to track **when** each candidate was added to a campaign:

```
Candidate (base data) → CampaignCandidate (when added + status) → Campaign
```

GitHub was storing everything in a single table (`github_search_results`), making it impossible to:
- Group candidates by search date
- Track same developer across multiple campaigns with different dates
- See which candidates came from which search batch

## ✅ Solution

Create the same structure for GitHub as LinkedIn uses:

### Before (WRONG - All-in-one table)
```
github_search_results
├── campaign_id
├── github_username
├── created_at (server timestamp - NOT search date!)
├── analysis fields...
```

**Problem:** No way to know "This developer was found on Feb 18" vs "This developer was found on Feb 19"

### After (CORRECT - Separated structure)
```
github_candidates (base candidate profiles)
├── github_username (UNIQUE)
├── github_id
├── email
├── score
├── analysis fields...

campaign_github_candidates (N:N relationship - KEY TABLE!)
├── campaign_id
├── github_candidate_id
├── added_at ✅ (When discovered in THIS campaign)
├── status ('Discovered', 'Contacted', etc.)
```

## 🔧 Database Schema

### 1. GitHub Candidates Base Table
```sql
CREATE TABLE public.github_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_username VARCHAR(255) UNIQUE NOT NULL,
    github_id BIGINT UNIQUE,
    email VARCHAR(255),
    linkedin_url TEXT,
    score DECIMAL(5,2),
    github_metrics JSONB,
    analysis_psychological TEXT,
    analysis_business TEXT,
    analysis_sales_angle TEXT,
    analysis_bottleneck TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Campaign-GitHub Candidate Junction Table (CRITICAL!)
```sql
CREATE TABLE public.campaign_github_candidates (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    user_id UUID NOT NULL REFERENCES profiles(id),
    github_candidate_id UUID NOT NULL REFERENCES github_candidates(id),
    
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- ✅ Search date!
    status VARCHAR(50) DEFAULT 'Discovered',
    
    UNIQUE(campaign_id, github_candidate_id)  -- Same dev only once per campaign
);
```

## 📝 How It Works

### Example: Search on Feb 18
```
User runs GitHub search on 2026-02-18
→ Finds: @alice, @bob, @charlie

Inserted:
campaign_github_candidates:
  └─ campaign_id: "xyz", github_candidate_id: alice_id, added_at: 2026-02-18T10:30:00
  └─ campaign_id: "xyz", github_candidate_id: bob_id, added_at: 2026-02-18T10:30:00
  └─ campaign_id: "xyz", github_candidate_id: charlie_id, added_at: 2026-02-18T10:30:00
```

### Example: Same Search on Feb 19
```
User runs same search again on 2026-02-19
→ Finds: @alice (again), @david, @eve

Inserted:
campaign_github_candidates:
  └─ @alice entry unchanged (unique constraint on campaign_id + github_candidate_id)
  └─ campaign_id: "xyz", github_candidate_id: david_id, added_at: 2026-02-19T14:15:00
  └─ campaign_id: "xyz", github_candidate_id: eve_id, added_at: 2026-02-19T14:15:00
```

### Query: "Show me candidates found on Feb 18"
```sql
SELECT gc.github_username, gc.score, gc.analysis_psychological
FROM campaign_github_candidates cgc
JOIN github_candidates gc ON gc.id = cgc.github_candidate_id
WHERE cgc.campaign_id = 'xyz' 
  AND DATE(cgc.added_at) = '2026-02-18'
ORDER BY cgc.added_at DESC;
```

## 🔄 Migration Steps

### Step 1: Run Schema Creation
Execute [github_schema_with_dates.sql](./supabase/github_schema_with_dates.sql) in Supabase console.

This creates:
- ✅ `github_candidates` table
- ✅ `campaign_github_candidates` junction table
- ✅ RLS policies
- ✅ Triggers for `updated_at`

### Step 2: Migrate Existing Data (if you have data in old `github_search_results`)

Uncomment and run the migration SQL in [github_schema_with_dates.sql](./supabase/github_schema_with_dates.sql):

```sql
-- Migrate candidates
INSERT INTO public.github_candidates (...)
SELECT ... FROM public.github_search_results
ON CONFLICT (github_username) DO UPDATE SET ...;

-- Migrate relationships
INSERT INTO public.campaign_github_candidates (...)
SELECT ... FROM public.github_search_results
ON CONFLICT (...) DO NOTHING;
```

### Step 3: Update Code References
Change service code from:
```typescript
// OLD
INSERT INTO github_search_results (campaign_id, github_username, score, ...)

// NEW
-- First, ensure candidate exists
INSERT INTO github_candidates (github_username, score, ...)
VALUES (...)
ON CONFLICT (github_username) DO UPDATE SET ...

-- Then link to campaign
INSERT INTO campaign_github_candidates (campaign_id, github_candidate_id, added_at)
VALUES (...)
ON CONFLICT (campaign_id, github_candidate_id) DO NOTHING;
```

### Step 4: Update UI Queries
```typescript
// OLD - Query single table
const results = await supabase
  .from('github_search_results')
  .select('*')
  .eq('campaign_id', campaignId);

// NEW - Query with junction table
const results = await supabase
  .from('campaign_github_candidates')
  .select('added_at, status, github_candidates(*)')
  .eq('campaign_id', campaignId)
  .order('added_at', { ascending: false });
```

## 📊 Impact on Features

### Date Grouping (NEW)
```typescript
// Group candidates by search date
const candidatesByDate = groupBy(
  results,
  r => format(new Date(r.added_at), 'yyyy-MM-dd')
);
```

### Deduplication (IMPROVED)
```typescript
// Same developer found in multiple searches => 1 row, multiple campaign_github_candidates records
const @alice_github_id = candidates.find(c => c.github_username === '@alice').id;
// If search again: ON CONFLICT just ignores (already linked to campaign)
```

### Status Tracking (NEW)
```typescript
// Update candidate status in a campaign
await supabase
  .from('campaign_github_candidates')
  .update({ status: 'Contacted', updated_at: new Date() })
  .match({ campaign_id: campaignId, github_candidate_id: candidateId });
```

### Analytics (NEW)
```sql
-- How many developers discovered per day?
SELECT DATE(cgc.added_at) as search_date, COUNT(*) as discovered_count
FROM campaign_github_candidates cgc
WHERE cgc.campaign_id = 'abc123'
GROUP BY DATE(cgc.added_at)
ORDER BY search_date DESC;
```

## 🚀 Code Changes Required

### In `lib/githubService.ts`
```typescript
// Instead of inserting directly into github_search_results
// Now do:

1. For each candidate found:
   - INSERT/UPDATE into github_candidates
   
2. Link to campaign:
   - INSERT into campaign_github_candidates with current timestamp
```

### In `components/GitHubCodeScan.tsx`
```typescript
// Query now uses junction table
const candidates = await supabase
  .from('campaign_github_candidates')
  .select('added_at, status, github_candidates(*)')
  .eq('campaign_id', campaignId)
  .eq('user_id', userId)
  .order('added_at', { ascending: false });
```

### In Types (`types/database.ts`)
✅ Already added:
- `GitHubCandidateProfile` - Base candidate table
- `CampaignGitHubCandidate` - Junction table with `added_at`

## ❓ FAQ

**Q: Do I have to migrate old data?**
A: No. Old `github_search_results` data stays in place. New searches use new tables. You can migrate gradually or not at all.

**Q: What about `created_at` field?**
A: 
- `github_candidates.created_at` = When candidate was first discovered (globally)
- `campaign_github_candidates.added_at` = When discovered in THIS campaign

**Q: Can same developer be in multiple campaigns?**
A: Yes! That's the whole point:
```
github_candidates: @alice (1 row)
campaign_github_candidates:
  ├─ row1: campaign_1, added_at: 2026-02-18
  ├─ row2: campaign_2, added_at: 2026-02-19
```

**Q: Why not just add `added_at` to `github_search_results`?**
A: Because if same dev is in same campaign, you'd have duplicate rows. Junction table enforces uniqueness.

## 📈 Performance

### Indexes Created
- `idx_campaign_github_candidates_campaign` - Fast campaign lookups
- `idx_campaign_github_candidates_added_at` - Fast date range queries
- `idx_github_candidates_username` - Fast deduplication checks

### Example Query Plan
```sql
-- "Find all developers added on 2026-02-18 to campaign XYZ"
-- Uses indexes on campaign_id + added_at
SELECT ... ORDER BY added_at DESC;
-- ✅ Fast scan with index
```

## 🎉 Result

Your GitHub system now matches LinkedIn's sophisticated structure:
- ✅ Date tracking per campaign
- ✅ Cross-campaign candidate deduplication
- ✅ Status tracking per campaign
- ✅ Date-grouped analytics
- ✅ Proper N:N relationship management
