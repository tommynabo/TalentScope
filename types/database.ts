
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