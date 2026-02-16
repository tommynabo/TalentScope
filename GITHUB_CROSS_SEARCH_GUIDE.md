# 🔗 GitHub ↔ LinkedIn Cross-Search Implementation

## Overview
The cross-search service automatically matches GitHub developer profiles with LinkedIn profiles using multiple signal matching algorithms. This enables data enrichment and creates a unified view of each developer across both platforms.

## Architecture

### Components
1. **ApifyCrossSearchService** (`lib/apifyCrossSearchService.ts`)
   - Core service for GitHub → LinkedIn matching
   - Uses Apify actors to search LinkedIn
   - Implements confidence scoring algorithm

2. **GitHubCampaignDashboard** (`components/GitHubCampaignDashboard.tsx`)
   - Campaign-specific dashboard showing results
   - Displays cross-linking metrics and enrichment progress
   - Tabs: Overview, Candidates, LinkedIn Cross-Link

3. **GitHubScanManager** (`components/GitHubScanManager.tsx`)
   - Manager component organizing campaigns
   - Campaign history and navigation
   - Integration with GitHubCodeScan

4. **SearchEngine Integration**
   - New source: `'github-linkedin'`
   - Chains GitHub search + cross-search in sequence

## How It Works

### Step 1: Build Search Signals
For each GitHub developer, extract multiple search signals in priority order:

```
PRIMARY (Highest Confidence - 95%):
- Email addresses from commit history
  - Example: user@company.com

SECONDARY (Medium Confidence - 70-75%):
- Full name from GitHub profile
- GitHub username
  - Example: @john_doe

TERTIARY (Lower Confidence - 40-50%):
- First name only
- Programming languages/skills
```

### Step 2: Search LinkedIn via Apify
For each signal (starting with highest priority):
1. Call Apify LinkedIn actor with search query
2. Get potential matches from LinkedIn
3. Return first valid result or continue with next signal
4. If no match found, try secondary signals, then tertiary

### Step 3: Calculate Match Confidence

The confidence score (0-100) is calculated by comparing:

| Signal | Match | Confidence Boost |
|--------|-------|------------------|
| Email exact match | user@company.com == user@company.com | +100 |
| Full name exact | John Doe == John Doe | +95 |
| Full name fuzzy | John Doe == J. Doe | +70 |
| Username match | john_doe found in name | +60 |
| Skills overlap | Python, TypeScript match | +15 each |
| Location match | Seattle == Seattle | +40 |

Final score: Average of all matched signals (min 70 for "linked" status)

### Step 4: Store Results

Results stored in `CrossLinkedCandidate` format:
```typescript
{
  github_id: "123456",
  github_username: "@john_doe",
  github_url: "https://github.com/john_doe",
  github_score: 85,
  
  linkedin_id: "ln-987654",
  linkedin_profile: { name, headline, url, skills... },
  
  link_status: "linked",      // linked | pending | failed | no_match
  link_confidence: 92,        // 0-100
  enriched_at: "2024-01-15T10:30:00Z"
}
```

## API Configuration

### Required Environment Variables

```env
# Apify API Token (for LinkedIn searches)
VITE_APIFY_API_KEY=your_apify_token

# LinkedIn Search Actor ID
VITE_APIFY_LINKEDIN_ACTOR_ID=nFJndFXA5zjCTuudP

# GitHub Token (existing)
VITE_GITHUB_TOKEN=ghp_...
```

### Setting up Apify

1. Create account at https://apify.com
2. Get API token from Settings → Integrations
3. Use existing LinkedIn scraper actor or create custom one
4. Store actor ID in environment variables

## Usage Examples

### Example 1: Simple GitHub Search
```typescript
const searchEngine = new SearchEngine();

searchEngine.startSearch(
  "python developer",
  "github",
  50,
  {
    language: "English",
    maxAge: 365,
    githubFilters: {
      minStars: 100,
      minFollowers: 50,
      languages: ["Python"],
      requireAppStore: false
    }
  },
  (log) => console.log(log),
  (results) => console.log("Found:", results)
);
```

### Example 2: Cross-Search GitHub + LinkedIn
```typescript
const searchEngine = new SearchEngine();

searchEngine.startSearch(
  "python developer",
  "github-linkedin",  // ← Cross-search mode
  50,
  {
    language: "English",
    maxAge: 365,
    githubFilters: {
      minStars: 100,
      minFollowers: 50,
      languages: ["Python"]
    }
  },
  (log) => console.log(log),
  (results) => {
    // Results are CrossLinkedCandidate[]
    results.forEach(candidate => {
      console.log(`${candidate.github_username} linked to ${candidate.linkedin_profile?.name}`);
    });
  }
);
```

### Example 3: Batch Cross-Search
```typescript
import { ApifyCrossSearchService } from './apifyCrossSearchService';

const crossSearchService = new ApifyCrossSearchService();

const githubDevelopers = [ /* GitHubMetrics[] */ ];

const linkedResults = await crossSearchService.batchSearchLinkedInProfiles(
  githubDevelopers,
  {
    search_email: true,           // Try email first
    search_username: true,        // Then username
    search_name_fuzzy: true,      // Then fuzzy name match
    min_confidence: 70,           // Only accept 70%+ matches
    timeout_ms: 60000
  }
);

// Process results
linkedResults
  .filter(r => r.link_status === 'linked')
  .forEach(r => {
    console.log(`✓ ${r.github_username} → ${r.linkedin_profile?.name}`);
  });
```

## Dashboard Features

### Overview Tab
- Total candidates found
- Excellent matches (≥80 score)
- App publishers count
- Average GitHub score
- LinkedIn enrichment progress
- Cross-link completion percentage
- Live metrics refresh

### Candidates Tab
- Sortable table of GitHub profiles
- Name, followers, stars metrics
- GitHub score visualization
- App published badges
- Quick "Link LinkedIn" buttons
- Filter by score ranges

### Enrichment Tab
- Cross-link progress charts
- GitHub → LinkedIn and LinkedIn → GitHub flows
- Live enrichment status (matched/pending/failed)
- Match confidence scores
- Data sample table showing successful links

## Performance & Rate Limits

### GitHub API (Octokit)
- With token: 5,000 requests/hour
- Without token: 60 requests/hour
- Rate limit check: Built into githubService

### Apify Actor
- Depends on actor configuration
- Typically: 5-20 per hour free tier
- Batch size: 10 searches per batch with 2s delay
- Timeout per search: 30-60 seconds

### Recommendation
- Search GitHub first (cached, rate-limited but predictable)
- Then cross-search LinkedIn (batch in groups of 10)
- Cache LinkedIn results to avoid repeated searches

## Error Handling

### Graceful Degradation

1. **LinkedIn Search Fails**: Mark as "pending" instead of "failed"
2. **Timeout on Actor**: Skip signal and try next one
3. **No Match Found**: Mark as "no_match" (not an error)
4. **API Rate Limit**: Queue search in batch, retry after cooldown
5. **Invalid Email**: Skip email signal, try others

### Retry Strategy
- Primary signals: 1 retry on timeout
- Secondary signals: 2 retries on timeout
- Tertiary signals: 1 retry (last resort)
- Individual batch items: Non-blocking failures

## Data Storage

### Database Schema (Supabase)

```sql
-- Extending github_candidates table
ALTER TABLE github_candidates ADD COLUMN (
  linkedin_id VARCHAR(100),
  linkedin_url VARCHAR(500),
  linkedin_profile JSONB,                 -- Full profile data
  cross_link_status VARCHAR(20),          -- linked|pending|failed|no_match
  cross_link_confidence INTEGER,          -- 0-100
  cross_link_signals TEXT[],              -- Array of matched signals
  enriched_at TIMESTAMP WITH TIME ZONE
);

-- Index for efficient queries
CREATE INDEX idx_github_candidates_linkedin_linked 
ON github_candidates (campaign_id)
WHERE cross_link_status = 'linked';
```

### Query Examples

```sql
-- Find enriched candidates
SELECT github_username, linkedin_url, cross_link_confidence
FROM github_candidates
WHERE campaign_id = $1 AND cross_link_status = 'linked'
ORDER BY cross_link_confidence DESC;

-- Cross-link completion percentage
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE cross_link_status = 'linked') as linked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cross_link_status = 'linked') 
    / COUNT(*)) as completion_percentage
FROM github_candidates
WHERE campaign_id = $1;

-- Highest confidence matches
SELECT 
  github_username, 
  linkedin_profile->>'name' as linkedin_name,
  cross_link_confidence
FROM github_candidates
WHERE campaign_id = $1 AND cross_link_confidence >= 90
ORDER BY cross_link_confidence DESC
LIMIT 20;
```

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic GitHub → LinkedIn matching
- ✅ Confidence scoring algorithm
- ✅ Batch processing with rate limiting
- ✅ Dashboard visualization

### Phase 2 (Planned)
- LinkedIn → GitHub reverse search
- Additional signals: Company domain, GitHub links in LinkedIn profile
- Machine learning for confidence scoring improvements
- Email verification service integration

### Phase 3 (Future)
- Reddit, Twitter, ProductHunt profile linking
- GitHub repository recommendation based on LinkedIn interests
- Multi-platform candidate score aggregation
- Profile completeness scoring

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "VITE_APIFY_API_KEY not configured" | Set env var in .env.local or Vercel |
| "No matches found" | Check with lower confidence threshold (50 instead of 70) |
| "Actor timeout" | Increase timeout_ms or reduce batch size |
| "Rate limit exceeded" | Wait 1 hour or use cached results from previous search |
| "LinkedIn returns 0 results" | Try different signals (email → name → username) |

## Testing

```typescript
import { ApifyCrossSearchService } from './apifyCrossSearchService';

// Mock test
const mockGitHub = {
  github_id: "123",
  github_username: "john_doe",
  full_name: "John Doe",
  email: "john.doe@company.com",
  github_score: 85,
  // ... other fields
};

const service = new ApifyCrossSearchService();
const result = await service.searchLinkedInProfile(mockGitHub);

console.assert(result.link_status !== 'failed', 'Search should not fail');
console.log(`Match confidence: ${result.link_confidence}%`);
```

## Support

For issues or questions:
1. Check error logs (browser console or server logs)
2. Verify environment variables are set correctly
3. Check Apify dashboard for actor run status
4. Review GitHub & LinkedIn API rate limits
5. Contact support with campaign ID and timestamp
