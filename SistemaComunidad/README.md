# SistemaComunidad — Community Infiltrator

Fourth recruitment system for TalentScope. Searches for A-Players in their natural ecosystems: Discord servers, Skool communities, Reddit communities, and GitHub Discussions.

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
│   └── communityPresets.ts            # Preset search configurations
├── components/
│   ├── CommunityCampaignList.tsx       # Campaign list view
│   ├── CommunityCreateCampaignModal.tsx # Create campaign modal
│   ├── CommunityCampaignDashboard.tsx  # Dashboard with tabs
│   ├── CommunityCandidatesPipeline.tsx # Pipeline/Kanban view
│   ├── CommunityScan.tsx              # Main scan interface
│   └── CommunityFilterConfig.tsx      # Advanced filter panel
└── README.md
```

## Key Design Decisions

- **Independent code**: No dependencies on SistemaLinkedin/GitHub/Marketplace code
- **Shared utilities only**: Uses `lib/supabase.ts`, `lib/UnbreakableExecution.ts` from root
- **Learned fixes**: Applies all fixes from other systems (null location handling, dedup, timeout handling, language filter improvements)
