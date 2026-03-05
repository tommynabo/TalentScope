# SistemaComunidad — Community Infiltrator

Fourth recruitment system for TalentScope. Searches for A-Players in their natural ecosystems: Discord servers, Skool communities, Reddit communities, and GitHub Discussions.

## ✨ NEW: Email & LinkedIn Extraction (5 Marzo 2026)

**Newly complete:** Automatic extraction of emails and LinkedIn profiles for community candidates, with direct syndication to Gmail outreach campaigns. 

### Quick Start:
```bash
# 1. Execute in Supabase SQL Editor
supabase/update_global_email_view.sql

# 2. Execute setup validations
supabase/community_setup_final.sql

# 3. In UI: Click "Extraer Email/LinkedIn" on any candidate
# → Automatically syncs to Gmail > Buzones > Candidatos ✨
```

### New Components:
- `lib/communityCandidateSyncService.ts` - Sync engine
- Updated `CommunityCandidatesPipeline.tsx` - UI buttons
- Updated `gmailCandidatesService.ts` - Fallback support
- `update_global_email_view.sql` - Unified email candidates view

[Full Guide: IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)

---

## Architecture

```
SistemaComunidad/
├── types/
│   └── community.ts          # All TypeScript interfaces/enums
├── lib/
│   ├── CommunitySearchEngine.ts       # UnbreakableExecutor-based search
│   ├── communityScoringService.ts     # Multi-factor scoring (0-100)
│   ├── communityDeduplicationService.ts # URL/username/email/fuzzy dedup
│   ├── communityCandidatePersistence.ts # 3-level Supabase persistence
│   ├── communityLanguageFilter.ts     # Spanish/Hispanic detection
│   ├── communityPresets.ts            # Preset search configurations
│   ├── communityEnrichmentService.ts  # ✨ NEW: Email/LinkedIn extraction
│   └── communityCandidateSyncService.ts # ✨ NEW: Gmail sync engine
├── components/
│   ├── CommunityCampaignList.tsx       # Campaign list view
│   ├── CommunityCreateCampaignModal.tsx # Create campaign modal
│   ├── CommunityCampaignDashboard.tsx  # Dashboard with tabs
│   ├── CommunityCandidatesPipeline.tsx # ✨ UPDATED: Pipeline/Kanban view
│   ├── CommunityScan.tsx              # Main scan interface
│   └── CommunityFilterConfig.tsx      # Advanced filter panel
└── README.md
```

## Key Design Decisions

- **Independent code**: No dependencies on SistemaLinkedin/GitHub/Marketplace code
- **Shared utilities only**: Uses `lib/supabase.ts`, `lib/UnbreakableExecution.ts` from root
- **Learned fixes**: Applies all fixes from other systems (null location handling, dedup, timeout handling, language filter improvements)
- **✨ NEW**: Seamless integration with Gmail outreach via unified `global_email_candidates` view
