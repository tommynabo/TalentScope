/**
 * community.ts - TypeScript types for Sistema Comunidad (Community Infiltrator)
 * 
 * Targets: Discord, Skool, Reddit, GitHub Discussions
 * Objective: Find A-Players in their natural ecosystems by tracking
 * passion, builder mentality, and technical contributions.
 */

// ─── Platform & Status Enums ─────────────────────────────────────────────────

export enum CommunityPlatform {
    Discord = 'Discord',
    Skool = 'Skool',
    Reddit = 'Reddit',
    GitHubDiscussions = 'GitHubDiscussions',
}

export enum CommunityMemberStatus {
    Discovered = 'Discovered',
    Enriched = 'Enriched',
    Contacted = 'Contacted',
    Replied = 'Replied',
}

// ─── Contact Info Types ──────────────────────────────────────────────────────

export enum ContactType {
    Email = 'Email',           // Direct email found
    LinkedIn = 'LinkedIn',     // LinkedIn profile URL
    GitHub = 'GitHub',         // GitHub profile (fallback)
    None = 'None',            // No contact info found
}

export interface ContactInfo {
    type: ContactType;
    value: string;             // Email address or URL
    confidence: number;        // 0-100: How confident is this contact info
    source: 'gmail' | 'linkedin' | 'github' | 'osint' | 'extracted';  // Where it came from
    extractedAt?: string;      // When it was extracted
}

// ─── Filter Criteria ─────────────────────────────────────────────────────────

export interface CommunityFilterCriteria {
    // Target platforms (multi-select)
    platforms: CommunityPlatform[];

    // Search terms
    keywords: string[];
    targetRole?: string;

    // Community sources (platform-specific)
    discordServerIds?: string[];     // Discord server IDs or invite links
    subreddits?: string[];           // e.g. ['Flutter', 'SaaS', 'startups']
    skoolCommunityUrls?: string[];   // Skool community URLs
    githubRepos?: string[];          // GitHub repos to monitor discussions

    // Quality thresholds
    minActivityScore?: number;       // 0-100
    minReputation?: number;          // 0-100
    minMessageCount?: number;        // Minimum messages in community
    minHelpfulnessScore?: number;    // 0-100

    // Role filters
    roles?: ('helper' | 'contributor' | 'admin' | 'moderator' | 'active_member')[];

    // Content signals
    requireProjectLinks?: boolean;   // Must have shared a project/repo
    requireCodeContributions?: boolean;

    // Language & location
    languages?: string[];            // e.g. ['es', 'en']
    locations?: string[];
    requireSpanishSpeaker?: boolean;
    minSpanishConfidence?: number;   // 0-100

    // ICP / Outreach Context
    role_keyword?: string;     // Job title keyword used in outreach messages
    icp_description?: string;  // Full job description / ICP for AI context
    skills?: string[];         // Additional skill tags

    // Limits
    maxResults?: number;
    maxDaysOld?: number;             // Only members active in last N days

    // Dedup against existing
    existingUsernames?: string[];
    existingEmails?: string[];
    existingProfileUrls?: string[];
}

// ─── Score Breakdown ─────────────────────────────────────────────────────────

export interface CommunityScoreBreakdown {
    activityLevel: number;     // 0-30: Message frequency, consistency
    helpfulness: number;       // 0-25: Answering questions, reactions received
    projectSharing: number;    // 0-20: Links to repos, live apps, demos
    reputation: number;        // 0-15: Community roles, badges, mod status
    skillsMatch: number;       // 0-7:  Keyword overlap with filter criteria
    recencyBonus: number;      // 0-3:  Recent activity (last 30 days)
    normalized: number;        // 0-100: Total normalized score
}

// ─── Community Candidate ─────────────────────────────────────────────────────

export interface CommunityCandidate {
    id: string;

    // Identity
    username: string;          // Platform username (e.g. "FlutterNinja99")
    displayName: string;       // Display name if available
    platform: CommunityPlatform;
    profileUrl: string;
    avatarUrl?: string;

    // Bio & Activity
    bio?: string;
    joinDate?: string;         // When they joined the community
    lastActiveDate?: string;   // Last message/activity date
    messageCount: number;
    helpfulnessScore: number;  // 0-100 computed from engagement

    // Content Signals (the gold)
    projectLinks: string[];    // Links to personal projects shared
    repoLinks: string[];       // GitHub/GitLab repo links shared
    sharedCodeSnippets: number; // Count of code blocks shared
    questionsAnswered: number; // Number of questions they've helped answer

    // Skills & Reputation
    skills: string[];          // Detected from messages/bio
    communityRoles: string[];  // 'moderator', 'helper', 'top contributor'
    reputationScore: number;   // Platform-specific reputation metric

    // Scoring
    talentScore: number;       // 0-100 composite score
    scoreBreakdown?: CommunityScoreBreakdown;

    // Language detection
    detectedLanguage?: 'es' | 'en' | 'unknown';

    // Cross-linking (enrichment results)
    email?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    githubUsername?: string;
    personalWebsite?: string;

    // ─── SEAMLESS INTEGRATION FIELDS ────────────────────────────────────────
    // Extracted during search, not post-search
    contactInfo?: ContactInfo;     // Primary contact method (email, LinkedIn, GitHub)
    autoAddedToGmail?: boolean;    // True if auto-enrolled to Gmail > Buzones > Candidatos
    enrichmentAttempts?: number;   // Number of times enrichment was tried
    enrichmentStartedAt?: string;  // When enrichment process started
    enrichmentCompletedAt?: string;// When enrichment process finished
    enrichmentError?: string;      // Error message if enrichment failed
    // ───────────────────────────────────────────────────────────────────────────

    // Metadata
    scrapedAt: string;
    communityName?: string;    // Name of the server/subreddit/group
    communityId?: string;      // ID of the community source

    // AI Analysis (post-enrichment)
    aiSummary?: string[];
    analysisProjects?: string;      // Analysis of their shared projects
    analysisPsychological?: string;
    analysisBusinessMoment?: string;
    analysisSalesAngle?: string;

    // Outreach messages
    outreachIcebreaker?: string;
    outreachPitch?: string;
    outreachFollowup?: string;

    // Campaign mapping
    campaignId?: string;
}

// ─── Campaign Types ──────────────────────────────────────────────────────────

export interface CommunityCampaignStats {
    total: number;
    excellentMatch: number;    // score >= 80
    goodMatch: number;         // score >= 60
    withEmail: number;
    withLinkedIn: number;
    withGitHub: number;
    avgScore: number;
    maxScore: number;
    lastScannedAt?: string;
}

export interface CommunityCampaign {
    id: string;
    name: string;
    description?: string;
    platforms: CommunityPlatform[];
    status: 'active' | 'paused' | 'completed';
    createdAt: string;
    updatedAt?: string;

    // Filter configuration
    searchCriteria: CommunityFilterCriteria;

    // Candidates
    candidates: CommunityCandidateInCampaign[];
    stats: CommunityCampaignStats;
}

export interface CommunityCandidateInCampaign extends CommunityCandidate {
    // Pipeline status
    kanbanLane: 'discovered' | 'enriched' | 'contacted' | 'replied' | 'rejected' | 'hired';
    notes?: string;
    addedAt: string;
    contactedAt?: string;
    respondedAt?: string;

    // AI-generated outreach
    waleadMessages?: {
        icebreaker: string;
        followup_message: string;
        second_followup?: string;
    };
}

// ─── Enrichment Types ────────────────────────────────────────────────────────

export interface CommunityEnrichmentResult {
    username: string;
    platform: CommunityPlatform;

    // Cross-linked profiles
    githubProfile?: {
        username: string;
        url: string;
        repos: number;
        stars: number;
    };
    linkedInProfile?: {
        url: string;
        fullName: string;
        title: string;
        company: string;
    };

    // Contact info
    emails: string[];
    confidence: number; // 0-100 enrichment confidence
}

// ─── Search Progress ─────────────────────────────────────────────────────────

export interface CommunitySearchProgress {
    platform: CommunityPlatform;
    communityName: string;
    membersScanned: number;
    qualityFound: number;
    duplicatesSkipped: number;
    status: 'scanning' | 'completed' | 'error';
    error?: string;
}
