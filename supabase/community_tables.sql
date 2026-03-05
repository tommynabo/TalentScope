-- ═══════════════════════════════════════════════════════════════════════════════
-- SistemaComunidad — Database Schema
-- Community Infiltrator tables for storing campaign and candidate data
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Community Campaigns table
CREATE TABLE IF NOT EXISTS community_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  platforms TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  search_criteria JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Community Candidates table
CREATE TABLE IF NOT EXISTS community_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES community_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  avatar_url TEXT,

  -- Bio & Activity
  bio TEXT,
  join_date TIMESTAMPTZ,
  last_active_date TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  helpfulness_score NUMERIC DEFAULT 0,
  questions_answered INTEGER DEFAULT 0,
  shared_code_snippets INTEGER DEFAULT 0,

  -- Content Signals
  project_links TEXT[] DEFAULT '{}',
  repo_links TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  community_roles TEXT[] DEFAULT '{}',
  reputation_score NUMERIC DEFAULT 0,

  -- Scoring
  talent_score NUMERIC DEFAULT 0,
  score_breakdown JSONB,

  -- Language
  detected_language TEXT DEFAULT 'unknown',

  -- Cross-linking
  email TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  github_username TEXT,
  personal_website TEXT,

  -- Community source
  community_name TEXT,
  community_id TEXT,

  -- AI Analysis
  ai_summary JSONB,
  analysis_projects TEXT,
  analysis_psychological TEXT,
  analysis_business_moment TEXT,
  analysis_sales_angle TEXT,

  -- Outreach
  outreach_icebreaker TEXT,
  outreach_pitch TEXT,
  outreach_followup TEXT,

  -- Metadata
  scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Composite unique constraint: one candidate per campaign per platform+username
  UNIQUE(campaign_id, username, platform)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_candidates_campaign
  ON community_candidates(campaign_id);

CREATE INDEX IF NOT EXISTS idx_community_candidates_user
  ON community_candidates(user_id);

CREATE INDEX IF NOT EXISTS idx_community_candidates_score
  ON community_candidates(talent_score DESC);

CREATE INDEX IF NOT EXISTS idx_community_candidates_platform
  ON community_candidates(platform);

CREATE INDEX IF NOT EXISTS idx_community_campaigns_user
  ON community_campaigns(user_id);

-- 4. RPC function for reliable upsert
CREATE OR REPLACE FUNCTION upsert_community_candidate(p_data JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO community_candidates (
    campaign_id, user_id, platform, username, display_name, profile_url, avatar_url,
    bio, join_date, last_active_date, message_count, helpfulness_score,
    questions_answered, shared_code_snippets, project_links, repo_links,
    skills, community_roles, reputation_score, talent_score, score_breakdown,
    detected_language, email, linkedin_url, github_url, github_username,
    personal_website, community_name, community_id, ai_summary,
    analysis_projects, analysis_psychological, analysis_business_moment,
    analysis_sales_angle, outreach_icebreaker, outreach_pitch, outreach_followup,
    scraped_at
  ) VALUES (
    (p_data->>'campaign_id')::UUID,
    (p_data->>'user_id')::UUID,
    p_data->>'platform',
    p_data->>'username',
    p_data->>'display_name',
    p_data->>'profile_url',
    p_data->>'avatar_url',
    p_data->>'bio',
    (p_data->>'join_date')::TIMESTAMPTZ,
    (p_data->>'last_active_date')::TIMESTAMPTZ,
    COALESCE((p_data->>'message_count')::INTEGER, 0),
    COALESCE((p_data->>'helpfulness_score')::NUMERIC, 0),
    COALESCE((p_data->>'questions_answered')::INTEGER, 0),
    COALESCE((p_data->>'shared_code_snippets')::INTEGER, 0),
    COALESCE((SELECT array_agg(x)::TEXT[] FROM jsonb_array_elements_text(p_data->'project_links') AS x), '{}'),
    COALESCE((SELECT array_agg(x)::TEXT[] FROM jsonb_array_elements_text(p_data->'repo_links') AS x), '{}'),
    COALESCE((SELECT array_agg(x)::TEXT[] FROM jsonb_array_elements_text(p_data->'skills') AS x), '{}'),
    COALESCE((SELECT array_agg(x)::TEXT[] FROM jsonb_array_elements_text(p_data->'community_roles') AS x), '{}'),
    COALESCE((p_data->>'reputation_score')::NUMERIC, 0),
    COALESCE((p_data->>'talent_score')::NUMERIC, 0),
    p_data->'score_breakdown',
    COALESCE(p_data->>'detected_language', 'unknown'),
    p_data->>'email',
    p_data->>'linkedin_url',
    p_data->>'github_url',
    p_data->>'github_username',
    p_data->>'personal_website',
    p_data->>'community_name',
    p_data->>'community_id',
    p_data->'ai_summary',
    p_data->>'analysis_projects',
    p_data->>'analysis_psychological',
    p_data->>'analysis_business_moment',
    p_data->>'analysis_sales_angle',
    p_data->>'outreach_icebreaker',
    p_data->>'outreach_pitch',
    p_data->>'outreach_followup',
    COALESCE((p_data->>'scraped_at')::TIMESTAMPTZ, now())
  )
  ON CONFLICT (campaign_id, username, platform)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    profile_url = EXCLUDED.profile_url,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    last_active_date = EXCLUDED.last_active_date,
    message_count = EXCLUDED.message_count,
    helpfulness_score = EXCLUDED.helpfulness_score,
    questions_answered = EXCLUDED.questions_answered,
    shared_code_snippets = EXCLUDED.shared_code_snippets,
    project_links = EXCLUDED.project_links,
    repo_links = EXCLUDED.repo_links,
    skills = EXCLUDED.skills,
    community_roles = EXCLUDED.community_roles,
    reputation_score = EXCLUDED.reputation_score,
    talent_score = EXCLUDED.talent_score,
    score_breakdown = EXCLUDED.score_breakdown,
    detected_language = EXCLUDED.detected_language,
    email = EXCLUDED.email,
    linkedin_url = EXCLUDED.linkedin_url,
    github_url = EXCLUDED.github_url,
    github_username = EXCLUDED.github_username,
    personal_website = EXCLUDED.personal_website,
    ai_summary = EXCLUDED.ai_summary,
    analysis_projects = EXCLUDED.analysis_projects,
    analysis_psychological = EXCLUDED.analysis_psychological,
    analysis_business_moment = EXCLUDED.analysis_business_moment,
    analysis_sales_angle = EXCLUDED.analysis_sales_angle,
    outreach_icebreaker = EXCLUDED.outreach_icebreaker,
    outreach_pitch = EXCLUDED.outreach_pitch,
    outreach_followup = EXCLUDED.outreach_followup,
    updated_at = now();
END;
$$;

-- 5. Row Level Security
ALTER TABLE community_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_candidates ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
DROP POLICY IF EXISTS "Users can manage own community campaigns" ON community_campaigns;
CREATE POLICY "Users can manage own community campaigns"
  ON community_campaigns
  FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own community candidates" ON community_candidates;
CREATE POLICY "Users can manage own community candidates"
  ON community_candidates
  FOR ALL
  USING (auth.uid() = user_id);
