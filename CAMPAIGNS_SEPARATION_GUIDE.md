# CAMPAIGN SYSTEMS SEPARATION
## GitHub vs LinkedIn Independence

### Overview
Campaigns are now **completely separated by platform** to prevent conflicts and cross-contamination.

---

## Database Structure

### 1. **campaigns** table
- **Platform**: LinkedIn only
- **Purpose**: Store LinkedIn-specific campaigns
- **Constraint**: `platform = 'LinkedIn'`
- **Service**: `CampaignService` (from `lib/services.ts`)

### 2. **campaigns_github** table
- **Platform**: GitHub only
- **Purpose**: Store GitHub code scan campaigns
- **Constraint**: No constraint needed (table is exclusive to GitHub)
- **Service**: `GitHubCampaignService` (from `lib/githubCampaignService.ts`)

---

## Service Architecture

### CampaignService (LinkedIn)
```typescript
import { CampaignService } from '../lib/services';

// Only fetches LinkedIn campaigns
const campaigns = await CampaignService.getAll();

// Always creates campaigns with platform = 'LinkedIn'
await CampaignService.create({
    title: 'My Campaign',
    platform: 'LinkedIn'
});

// Only deletes from campaigns table
await CampaignService.delete(id);
```

### GitHubCampaignService (GitHub)
```typescript
import { GitHubCampaignService } from '../lib/githubCampaignService';

// Only fetches GitHub campaigns
const campaigns = await GitHubCampaignService.getAll();

// Always creates campaigns in campaigns_github
await GitHubCampaignService.create({
    title: 'My GitHub Campaign'
});

// Only deletes from campaigns_github table
await GitHubCampaignService.delete(id);
```

---

## Component Usage

### LinkedIn Campaigns (CampaignListView)
```tsx
import { CampaignService } from '../lib/services';

// Uses CampaignService → campaigns table (LinkedIn only)
const campaigns = await CampaignService.getAll();
```

### GitHub Campaigns (GitHubCampaignList)
```tsx
import { GitHubCampaignService } from '../lib/githubCampaignService';

// Uses GitHubCampaignService → campaigns_github table (GitHub only)
const campaigns = await GitHubCampaignService.getAll();
```

---

## Key Guarantees

✅ **Creating a LinkedIn campaign does NOT appear in GitHub**
- Creates in `campaigns` table
- Platform field = 'LinkedIn'
- Invisible to GitHub system

✅ **Creating a GitHub campaign does NOT appear in LinkedIn**
- Creates in `campaigns_github` table
- Separate storage from LinkedIn
- Invisible to LinkedIn system

✅ **Deleting a LinkedIn campaign does NOT affect GitHub**
- Deletes from `campaigns` table only
- `campaigns_github` remains untouched

✅ **Deleting a GitHub campaign does NOT affect LinkedIn**
- Deletes from `campaigns_github` table only
- `campaigns` remains untouched

✅ **Each system has independent stats and settings**
- LinkedIn campaigns have their own settings in `campaigns.settings`
- GitHub campaigns have their own settings in `campaigns_github.settings`
- No data sharing between systems

---

## Migration Guide

### For Walead Messages (Future)
```typescript
// Create campaigns_walead table similar to campaigns_github
CREATE TABLE campaigns_walead (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    // ... other fields
);

// Create WaleadCampaignService
export const WaleadCampaignService = {
    async getAll(userId?: string) {
        return supabase
            .from('campaigns_walead')
            .select('*');
    }
    // ... other methods
};
```

### For LinkedIn Scraper (Future)
Already using `CampaignService` - no changes needed.

### For Community Scouting (Future)
```typescript
// Create campaigns_community table
// Create CommunityCampaignService
// Follow same pattern as GitHubCampaignService
```

---

## Database Views (Optional)

To get ALL campaigns across all systems (for analytics):

```sql
CREATE VIEW all_campaigns_with_system AS
SELECT 
    id,
    user_id,
    title,
    'LinkedIn' as system,
    created_at
FROM public.campaigns
UNION ALL
SELECT
    id,
    user_id,
    title,
    'GitHub' as system,
    created_at
FROM public.campaigns_github;
```

---

## Testing Checklist

- [ ] Create LinkedIn campaign, verify it doesn't appear in GitHub
- [ ] Create LinkedIn campaign, delete it, verify GitHub campaigns unchanged
- [ ] Create GitHub campaign, verify it doesn't appear in LinkedIn
- [ ] Create GitHub campaign, delete it, verify LinkedIn campaigns unchanged
- [ ] Check `campaigns` table only has `platform = 'LinkedIn'`
- [ ] Check `campaigns_github` table has GitHub campaigns
- [ ] Verify count of campaigns match across systems

---

## Files Modified

1. **Created**: `lib/githubCampaignService.ts` - GitHub campaign service
2. **Modified**: `lib/services.ts` - LinkedIn service, now filters only LinkedIn
3. **Modified**: `SistemaGithub/components/GitHubCampaignList.tsx` - Uses new service
4. **Created**: `supabase/campaigns_github_migration.sql` - GitHub campaigns table
5. **Created**: `supabase/campaigns_linkedin_separation.sql` - LinkedIn constraint

---

## API Endpoints Reference

### LinkedIn API
- `GET /campaigns` → `CampaignService.getAll()`
- `POST /campaigns` → `CampaignService.create()`
- `DELETE /campaigns/:id` → `CampaignService.delete()`

### GitHub API
- `GET /campaigns_github` → `GitHubCampaignService.getAll()`
- `POST /campaigns_github` → `GitHubCampaignService.create()`
- `DELETE /campaigns_github/:id` → `GitHubCampaignService.delete()`

---

## Troubleshooting

### "Campaign disappeared after switching platforms"
- **Cause**: Was using wrong service/table
- **Fix**: Verify correct service is imported and used

### "Deleting a campaign affected other system"
- **Cause**: Used wrong delete method
- **Fix**: Check that `CampaignService.delete()` vs `GitHubCampaignService.delete()` is called correctly

### "Can't find GitHub campaign in list"
- **Cause**: Using `CampaignService` instead of `GitHubCampaignService`
- **Fix**: Import and use `GitHubCampaignService` in GitHub components
