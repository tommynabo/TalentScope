
export type PlatformType = 'LinkedIn' | 'GitHub' | 'Freelance' | 'Communities' | 'Other';
export type CampaignStatus = 'Draft' | 'Running' | 'Paused' | 'Completed';
export type CandidateStatus = 'Pool' | 'Contacted' | 'Responded' | 'Scheduled' | 'Offer Sent' | 'Hired' | 'Rejected';
export type CriterionImportance = 'X' | 'XX';
export type CriterionMatch = 'required' | 'preferred' | 'nice_to_have';

export interface Profile {
    id: string; // UUID from auth.users
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface Campaign {
    id: string; // UUID
    user_id: string; // UUID references Profile
    platform: PlatformType;
    title: string;
    target_role: string | null;
    status: CampaignStatus;
    description: string | null;
    settings: Record<string, any>; // JSONB
    created_at: string;
    updated_at: string;
}

export interface Candidate {
    id: string; // UUID
    full_name: string;
    email: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    avatar_url: string | null;
    job_title: string | null; // RENOMBRADO de 'current_role'
    current_company: string | null;
    location: string | null;
    experience_years: number | null;
    education: string | null;
    skills: string[] | null;
    ai_analysis: string | null;
    symmetry_score: number;
    score_breakdown?: ScoreBreakdown; // NEW - Optional scoring details
    walead_messages?: {
        icebreaker?: string;
        followup_message?: string;
        second_followup?: string;
        edited_at?: string;
    };
    created_at: string;
    updated_at: string;
}

export interface CampaignCandidate {
    id: string; // UUID
    campaign_id: string; // UUID references Campaign
    candidate_id: string; // UUID references Candidate
    status: CandidateStatus;
    notes: string | null;
    interaction_history: Record<string, any>[]; // JSONB array
    added_at: string;
    updated_at: string;
}

export interface SavedSearch {
    id: string; // UUID
    user_id: string; // UUID references Profile
    name: string;
    criteria: Record<string, any>; // JSONB
    created_at: string;
}

export interface AnalyticsDaily {
    id: string; // UUID
    campaign_id: string | null; // UUID references Campaign
    date: string;
    emails_sent: number;
    replies_received: number;
    interviews_booked: number;
    leads_generated: number;
}
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

// GitHub Scraper Criteria
export interface GitHubFilterCriteria {
    // Repository Metrics
    min_stars: number;
    max_stars: number;
    min_forks: number;
    languages: string[];

    // Developer Signals
    min_public_repos: number;
    min_followers: number;
    min_contributions_per_month: number;

    // Code Quality Filters
    min_originality_ratio: number; // % of repos that are not forks
    exclude_generic_repos: boolean; // "todo", "calculator", "weather", "clone"
    require_recent_activity: boolean;
    max_months_since_last_commit: number;

    // Store Presence (Critical Signal)
    require_app_store_link: boolean; // Play Store or App Store

    // Location & Demographics
    locations: string[];
    available_for_hire: boolean;

    // Language Requirements - Spanish filter
    require_spanish_speaker?: boolean; // Require Spanish language proficiency
    min_spanish_language_confidence?: number; // 0-100 confidence threshold
    
    score_threshold?: number; // 0-100
}

export interface GitHubMetrics {
    github_username: string;
    github_url: string;
    github_id: number | null;
    public_repos: number;
    followers: number;
    following: number;
    created_at: string;
    updated_at: string;

    // Profile Info
    name?: string;
    bio?: string;
    avatar_url?: string;

    // Code Metrics
    total_commits: number;
    contribution_streak: number; // days
    last_commit_date: string | null;
    most_used_language: string | null;
    total_contributions?: number;

    // Repository Analysis
    total_stars_received: number;
    average_repo_stars: number;
    original_repos_count: number;
    fork_repos_count: number;
    originality_ratio: number; // 0-100

    // Signal Detection
    has_app_store_link: boolean;
    app_store_url: string | null;
    pinned_repos_count: number;
    open_source_contributions: number;

    // Enrichment
    mentioned_email: string | null;
    personal_website: string | null;
    linkedin_url: string | null;

    // Scoring
    github_score: number; // 0-100
    score_breakdown: GitHubScoreBreakdown;
    search_quality?: 'excellent' | 'good' | 'fair' | 'poor';
    languages?: string[];

    // AI Research Data
    ai_summary?: string[]; // Bullet points analysis

    // Deep Research 4-Card Analysis
    analysis_psychological?: string;
    analysis_business?: string;
    analysis_sales_angle?: string;
    analysis_bottleneck?: string;

    outreach_icebreaker?: string;
    outreach_pitch?: string;
    outreach_followup?: string;
}

export interface GitHubScoreBreakdown {
    repository_quality: number;
    code_activity: number;
    community_presence: number;
    app_shipping: number;
    originality: number;
    total: number;
    normalized: number;
}

export interface GitHubCandidate extends Candidate {
    github_metrics?: GitHubMetrics;
}

// ═════════════════════════════════════════════════════════════════════════════
// GitHub System - NEW CORRECTED SCHEMA (matching LinkedIn structure)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Base GitHub candidate profile (like Candidate table)
 * Stores unique GitHub developers independent of campaigns
 */
export interface GitHubCandidateProfile {
    id: string; // UUID

    // GitHub User Info
    github_id: number | null;
    github_username: string; // UNIQUE
    github_url: string;

    // Contact Information
    email: string | null;
    linkedin_url: string | null;
    personal_website: string | null;

    // Scoring
    score: number; // 0-100

    // Full metrics stored as JSONB
    github_metrics: GitHubMetrics;

    // AI Analysis
    analysis_psychological: string | null;
    analysis_business: string | null;
    analysis_sales_angle: string | null;
    analysis_bottleneck: string | null;

    // Outreach Messages (AI-generated, user can edit)
    outreach_icebreaker: string | null;
    outreach_pitch: string | null;
    outreach_followup: string | null;

    // Timestamps
    created_at: string; // When discovered globally
    updated_at: string;
}

/**
 * Junction table: links campaigns to GitHub candidates (like CampaignCandidate)
 * Tracks WHEN a candidate was added to a campaign
 * Key difference from github_search_results: separates candidate from campaign relationship
 */
export interface CampaignGitHubCandidate {
    id: string; // UUID

    // Relationships
    campaign_id: string; // UUID
    user_id: string; // UUID (campaign owner)
    github_candidate_id: string; // UUID (references GitHubCandidateProfile)

    // ✅ KEY FIELD: When was added to THIS campaign
    added_at: string; // date-time of when discovered in this campaign

    // Status tracking
    status: CandidateStatus; // 'Discovered', 'Contacted', 'Responded', etc.
    notes: string | null;

    // Metadata
    created_at: string;
    updated_at: string;
}