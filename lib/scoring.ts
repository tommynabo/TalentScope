import { Candidate, SearchFilterCriteria, ScoreBreakdown } from '../types/database';

/**
 * PRODUCT ENGINEER SCORING SYSTEM
 * 
 * Max Score: 15 points
 * Threshold: 12 points (normalized to 80/100) — Quality-first standard
 * 
 * Criteria breakdown:
 * - Age (18-30): 1pt
 * - Engineering Degree: 1pt
 * - Published Apps: 2pts (XX)
 * - Core Stack (React/Next.js, Node.js, TypeScript): 2pts (XX)
 * - Online Portfolio: 2pts (XX)
 * - Open Source: 2pts (XX)
 * - Startup Early Stage: 2pts (XX)
 * - Founded Business: 1pt
 * - Backend Knowledge: 1pt
 * - UX/UI Awareness: 1pt
 * - AI Experience: 1pt
 */

export function calculateFlutterDeveloperScore(
  candidate: Candidate,
  criteria: SearchFilterCriteria
): { score: number; breakdown: ScoreBreakdown; passes_threshold: boolean } {
  
  const breakdown: ScoreBreakdown = {
    age: 0,
    education: 0,
    published_apps: 0,
    core_stack: 0,
    portfolio: 0,
    open_source: 0,
    startup: 0,
    founder: 0,
    backend: 0,
    ui_ux: 0,
    ai: 0,
    total: 0,
    normalized: 0,
    passes_threshold: false
  };

  // 1. Age (0-1pt)
  const candidateAge = extractAge(candidate);
  if (candidateAge && candidateAge >= criteria.min_age && candidateAge <= criteria.max_age) {
    breakdown.age = 1;
  }

  // 2. Engineering Degree (0-1pt)
  if (criteria.has_engineering_degree && hasEngineeringDegree(candidate)) {
    breakdown.education = 1;
  }

  // 3. Published Apps on App Store/Play Store (0-2pts)
  if (criteria.has_published_apps && hasPublishedApps(candidate)) {
    breakdown.published_apps = 2;
  }

  // 4. Core Stack Experience: React/Next.js, Node.js, TypeScript (0-2pts)
  if (criteria.has_core_stack_exp && hasCoreStackExperience(candidate)) {
    breakdown.core_stack = 2;
  }

  // 5. Online Portfolio (0-2pts)
  if (criteria.has_portfolio_online && hasPortfolio(candidate)) {
    breakdown.portfolio = 2;
  }

  // 6. Open Source Contributions (0-2pts)
  if (criteria.open_source_contributor && hasOpenSourceActivity(candidate)) {
    breakdown.open_source = 2;
  }

  // 7. Early-Stage Startup Experience (0-2pts)
  if (criteria.startup_early_stage_exp && hasStartupExperience(candidate)) {
    breakdown.startup = 2;
  }

  // 8. Founded Business/SaaS/App (0-1pt)
  if (criteria.founded_business && hasFoundedBusiness(candidate)) {
    breakdown.founder = 1;
  }

  // 9. Backend Knowledge (0-1pt)
  if (criteria.backend_knowledge !== 'none' && hasBackendKnowledge(candidate, criteria.backend_knowledge)) {
    breakdown.backend = 1;
  }

  // 10. UX/UI Design Awareness (0-1pt)
  if (criteria.ui_ux_awareness && hasUIUXAwareness(candidate)) {
    breakdown.ui_ux = 1;
  }

  // 11. AI Experience (0-1pt)
  if (criteria.ai_experience && hasAIExperience(candidate)) {
    breakdown.ai = 1;
  }

  // Calculate total
  breakdown.total = 
    breakdown.age + 
    breakdown.education + 
    breakdown.published_apps + 
    breakdown.core_stack + 
    breakdown.portfolio + 
    breakdown.open_source + 
    breakdown.startup + 
    breakdown.founder + 
    breakdown.backend + 
    breakdown.ui_ux + 
    breakdown.ai;

  // Normalize to 100 (max 15 points)
  breakdown.normalized = Math.round((breakdown.total / 15) * 100);
  
  // Threshold: minimum 12 points = 80% of max 15 (Quality-first standard)
  breakdown.passes_threshold = breakdown.total >= 12;

  return {
    score: breakdown.total,
    breakdown,
    passes_threshold: breakdown.passes_threshold
  };
}

// ============= DETECTION HELPER FUNCTIONS =============

function extractAge(candidate: Candidate): number | null {
  // Try to extract age from experience_years as fallback
  // In real scenario, would parse LinkedIn profile birth date
  // For now, return null if not available
  return null;
}

function hasEngineeringDegree(candidate: Candidate): boolean {
  if (!candidate.education) return false;
  
  const engineeringKeywords = [
    'engineering',
    'computer science',
    'informática',
    'software',
    'ingeniería',
    'sistemas',
    'tecnología',
    'cs',
    'computer',
    'programming',
    'computación'
  ];
  
  const educationLower = candidate.education.toLowerCase();
  return engineeringKeywords.some(kw => educationLower.includes(kw));
}

function hasPublishedApps(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  
  // Look for iOS App Store or Google Play mentions
  const storeKeywords = [
    'app store',
    'google play',
    'play store',
    'published app',
    'shipped product',
    'production app',
    'released on',
    'available on',
    'download'
  ];
  
  const analysisLower = candidate.ai_analysis.toLowerCase();
  return storeKeywords.some(kw => analysisLower.includes(kw));
}

function hasCoreStackExperience(candidate: Candidate): boolean {
  if (!candidate.skills || candidate.skills.length === 0) return false;
  
  const coreStackKeywords = ['react', 'next.js', 'nextjs', 'node', 'nodejs', 'typescript', 'javascript', 'express', 'rest api'];
  return candidate.skills.some(skill => 
    coreStackKeywords.some(kw => skill.toLowerCase().includes(kw))
  );
}

function hasPortfolio(candidate: Candidate): boolean {
  if (!candidate.github_url && !candidate.ai_analysis) return false;
  
  // Check GitHub or portfolio website mentions
  if (candidate.github_url && candidate.github_url.includes('github.com')) {
    return true;
  }
  
  const analysisLower = candidate.ai_analysis?.toLowerCase() || '';
  const portfolioKeywords = [
    'portfolio',
    'website',
    'personal site',
    'web.dev',
    '.com',
    'github',
    'dev.to',
    'blogging',
    'blog'
  ];
  
  return portfolioKeywords.some(kw => analysisLower.includes(kw));
}

function hasOpenSourceActivity(candidate: Candidate): boolean {
  if (!candidate.github_url) return false;
  
  // GitHub URL presence indicates potential open source contribution
  // In production, would check actual repository activity
  return candidate.github_url.toLowerCase().includes('github.com');
}

function hasStartupExperience(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  
  const startupKeywords = [
    'startup',
    'early stage',
    'seed',
    'series a',
    'series b',
    'series c',
    'venture',
    'scaleup',
    'pre-seed'
  ];
  
  const analysisLower = candidate.ai_analysis.toLowerCase();
  return startupKeywords.some(kw => analysisLower.includes(kw));
}

function hasFoundedBusiness(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  
  const founderKeywords = [
    'founded',
    'founder',
    'cofounded',
    'co-founder',
    'own company',
    'saas',
    'agency',
    'entrepreneur'
  ];
  
  const analysisLower = candidate.ai_analysis.toLowerCase();
  return founderKeywords.some(kw => analysisLower.includes(kw));
}

function hasBackendKnowledge(candidate: Candidate, expectedBackend: string): boolean {
  if (!candidate.skills || candidate.skills.length === 0) return false;
  
  const backendMap: { [key: string]: string[] } = {
    'firebase': ['firebase', 'firestore', 'realtime database'],
    'supabase': ['supabase', 'postgresql', 'postgres', 'sql'],
    'custom': ['node', 'nodejs', 'django', 'python', 'express', 'fastapi', 'java', 'go', 'rust']
  };
  
  const keywords = backendMap[expectedBackend] || [];
  return keywords.some(kw => 
    candidate.skills?.some(s => s.toLowerCase().includes(kw))
  );
}

function hasUIUXAwareness(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  
  const designKeywords = [
    'design',
    'figma',
    'ui/ux',
    'ux',
    'ui',
    'user experience',
    'user interface',
    'design thinking',
    'prototyping',
    'wireframe'
  ];
  
  const analysisLower = candidate.ai_analysis.toLowerCase();
  return designKeywords.some(kw => analysisLower.includes(kw));
}

function hasAIExperience(candidate: Candidate): boolean {
  if (!candidate.ai_analysis) return false;
  
  const aiKeywords = [
    'ai',
    'artificial intelligence',
    'machine learning',
    'llm',
    'gpt',
    'embeddings',
    'neural',
    'ml model',
    'deep learning',
    'nlp',
    'computer vision',
    'langchain',
    'openai',
    'anthropic'
  ];
  
  const analysisLower = candidate.ai_analysis.toLowerCase();
  return aiKeywords.some(kw => analysisLower.includes(kw));
}

// ============= UTILITY FUNCTIONS =============

export function getScoreColor(normalizedScore: number): string {
  if (normalizedScore >= 80) return 'text-green-400';  // Excellent (A-Player)
  if (normalizedScore >= 70) return 'text-yellow-400'; // Good Match
  return 'text-red-400'; // Below threshold
}

export function getScoreBgColor(normalizedScore: number): string {
  if (normalizedScore >= 80) return 'bg-green-950/30 border-green-500/20';
  if (normalizedScore >= 70) return 'bg-yellow-950/30 border-yellow-500/20';
  return 'bg-red-950/30 border-red-500/20';
}

export function getScoreLabel(normalizedScore: number): string {
  if (normalizedScore >= 90) return 'A-Player 🌟';
  if (normalizedScore >= 80) return 'Strong Match ✅';
  if (normalizedScore >= 70) return 'Good Candidate ⚠️';
  return 'Below Threshold ❌';
}

// ============= UI/UX DESIGNER SCORING =============
//
// Mirrors the Product Engineer scoring structure exactly.
//
// Max Score: 15 points
// Threshold: 12 points (normalized to 80/100) — Quality-first standard
//
// Criteria breakdown:
// - Age (18-35): 1pt
// - Design Background (degree or equivalent): 1pt
// - Shipped Mobile App (App Store / Play Store): 2pts (XX)
// - Figma Mastery (advanced Figma skills): 2pts (XX)
// - Mobile Portfolio with Case Studies: 2pts (XX)
// - Design System / Public Design Contribution: 2pts (XX)
// - Startup Early Stage: 2pts (XX)
// - Founded Business: 1pt
// - Engineering Collaboration / Handoff: 1pt
// - AI in Design Workflow: 1pt

export function calculateUIUXDesignerScore(
  candidate: Candidate,
  criteria: SearchFilterCriteria
): { score: number; breakdown: ScoreBreakdown; passes_threshold: boolean } {

  // Guard: if this is clearly an engineer/developer profile, score 0 immediately.
  // Developers who "also do design" are not what we're looking for.
  if (isEngineerProfile(candidate)) {
    const empty: ScoreBreakdown = {
      age: 0, education: 0, published_apps: 0, core_stack: 0, portfolio: 0,
      open_source: 0, startup: 0, founder: 0, backend: 0, ui_ux: 0, ai: 0,
      total: 0, normalized: 0, passes_threshold: false
    };
    return { score: 0, breakdown: empty, passes_threshold: false };
  }

  const breakdown: ScoreBreakdown = {
    age: 0,
    education: 0,
    published_apps: 0,
    core_stack: 0,     // repurposed: Figma Mastery
    portfolio: 0,
    open_source: 0,    // repurposed: Design System / public design portfolio
    startup: 0,
    founder: 0,
    backend: 0,        // repurposed: Engineering Collaboration / Handoff
    ui_ux: 0,          // repurposed: AI in Design Workflow
    ai: 0,             // not used separately — folded into ui_ux slot
    total: 0,
    normalized: 0,
    passes_threshold: false
  };

  // 1. Age (0-1pt) — 18-35 (wider than PE, designers often take longer to build portfolio)
  const candidateAge = extractAge(candidate);
  if (candidateAge && candidateAge >= criteria.min_age && candidateAge <= criteria.max_age) {
    breakdown.age = 1;
  }

  // 2. Design / Related Background (0-1pt)
  if (hasDesignBackground(candidate)) {
    breakdown.education = 1;
  }

  // 3. Shipped Mobile Apps — TIERED (0 / 1 / 2pts)
  //    0pts: no mobile evidence
  //    1pt : single app shipped (needs strong signals elsewhere to pass threshold)
  //    2pts: multiple apps shipped — the quality bar we are targeting
  if (criteria.has_published_apps) {
    breakdown.published_apps = countMobileAppsShipped(candidate);
  }

  // 4. Figma Mastery — advanced Figma / professional design tooling (0-2pts)
  if (criteria.has_core_stack_exp && hasFigmaMastery(candidate)) {
    breakdown.core_stack = 2;
  }

  // 5. Mobile Portfolio with Case Studies (0-2pts)
  if (criteria.has_portfolio_online && hasMobilePortfolio(candidate)) {
    breakdown.portfolio = 2;
  }

  // 6. Design System / Public Design Contribution (0-2pts)
  if (criteria.open_source_contributor && hasDesignSystemWork(candidate)) {
    breakdown.open_source = 2;
  }

  // 7. Early-Stage Startup Experience (0-2pts)
  if (criteria.startup_early_stage_exp && hasStartupExperience(candidate)) {
    breakdown.startup = 2;
  }

  // 8. Founded Business / Product / Design Agency (0-1pt)
  if (criteria.founded_business && hasFoundedBusiness(candidate)) {
    breakdown.founder = 1;
  }

  // 9. Engineering Collaboration / Handoff (0-1pt)
  if (hasEngineeringCollab(candidate)) {
    breakdown.backend = 1;
  }

  // 10. AI in Design Workflow (0-1pt)
  if (criteria.ai_experience && hasAIInDesign(candidate)) {
    breakdown.ui_ux = 1;
  }

  // 11. (slot kept for parity — unused, always 0)
  breakdown.ai = 0;

  breakdown.total =
    breakdown.age +
    breakdown.education +
    breakdown.published_apps +
    breakdown.core_stack +
    breakdown.portfolio +
    breakdown.open_source +
    breakdown.startup +
    breakdown.founder +
    breakdown.backend +
    breakdown.ui_ux +
    breakdown.ai;

  breakdown.normalized = Math.round((breakdown.total / 15) * 100);
  breakdown.passes_threshold = breakdown.total >= 12;

  return {
    score: breakdown.total,
    breakdown,
    passes_threshold: breakdown.passes_threshold
  };
}

// ── UI/UX Designer helpers ──────────────────────────────────────────────────

function hasDesignBackground(candidate: Candidate): boolean {
  if (!candidate.education) return false;
  const designKeywords = [
    'design', 'diseño', 'multimedia', 'communication', 'comunicación',
    'arts', 'arte', 'visual', 'hci', 'human-computer', 'interaction',
    'ux', 'ui', 'advertising', 'publicidad', 'architecture', 'arquitectura',
    // also accept engineering/CS — designers with tech backgrounds are a bonus
    'engineering', 'computer science', 'informática', 'software', 'ingeniería'
  ];
  const lower = candidate.education.toLowerCase();
  return designKeywords.some(kw => lower.includes(kw));
}

/**
 * Detects if a candidate is primarily an engineer/developer (not a designer).
 * Engineers who "also did UI" are excluded from the Product Designer pipeline.
 */
function isEngineerProfile(candidate: Candidate): boolean {
  const title = (candidate.job_title ?? '').toLowerCase();
  const skills = (candidate.skills ?? []).join(' ').toLowerCase();
  const analysis = (candidate.ai_analysis ?? '').toLowerCase();

  // Hard engineer title signals — these people are developers, not designers
  const engineerTitleKeywords = [
    'ios developer', 'android developer', 'mobile developer',
    'flutter developer', 'react native developer', 'software engineer',
    'software developer', 'frontend developer', 'front-end developer',
    'backend developer', 'back-end developer', 'full stack developer',
    'fullstack developer', 'full-stack developer', 'mobile engineer',
    'ios engineer', 'android engineer', 'app developer'
  ];
  if (engineerTitleKeywords.some(t => title.includes(t))) return true;

  // Heavy developer language in skills without any design tool to compensate
  const devLanguages = ['swift', 'kotlin', 'objective-c', 'dart', 'flutter'];
  const designTools  = ['figma', 'sketch', 'adobe xd', 'framer', 'principle'];
  const hasDevLanguage  = devLanguages.some(l => skills.includes(l) || analysis.includes(l));
  const hasDesignTool   = designTools.some(t => skills.includes(t) || analysis.includes(t));
  if (hasDevLanguage && !hasDesignTool) return true;

  return false;
}

/**
 * Returns 0, 1, or 2 based on DESIGN-context mobile shipping evidence.
 * Only awards points when the signal clearly belongs to a designer, not a developer.
 *   2 — strong design-context evidence of multiple shipped mobile products
 *   1 — design-context evidence of one shipped mobile product
 *   0 — no credible designer mobile evidence (or evidence is developer-only)
 */
function countMobileAppsShipped(candidate: Candidate): 0 | 1 | 2 {
  const text = [candidate.ai_analysis, candidate.job_title]
    .filter(Boolean).join(' ').toLowerCase();

  if (!text) return 0;

  // Design-specific mobile shipping signals — these belong to designers, not developers
  const designMobileSignals = [
    'designed the app',
    'designed mobile app',
    'ux for the app',
    'product design for',
    'designed onboarding',
    'designed paywall',
    'designed the mobile',
    'mobile design portfolio',
    'mobile app design',
    'ui design for',
    'ux design for',
    'case study',
    'case studies',
    'behance',
    'dribbble',
  ];

  const designHits = designMobileSignals.filter(kw => text.includes(kw)).length;
  if (designHits >= 3) return 2; // multiple strong design signals → track record
  if (designHits >= 1) return 1; // at least one clear design-context signal

  // Weaker mobile signals — still contextual, but need design tool context too
  const weakMobileWithDesignContext =
    (text.includes('mobile') || text.includes('ios') || text.includes('android')) &&
    (text.includes('figma') || text.includes('prototype') || text.includes('design system'));
  if (weakMobileWithDesignContext) return 1;

  return 0;
}

function hasFigmaMastery(candidate: Candidate): boolean {
  const skillsText = (candidate.skills ?? []).join(' ').toLowerCase();
  const analysisLower = candidate.ai_analysis?.toLowerCase() ?? '';

  const figmaKeywords = [
    'figma', 'sketch', 'adobe xd', 'framer',
    'design system', 'auto-layout', 'autolayout',
    'prototype', 'prototyping', 'wireframe',
    'component library', 'design token'
  ];
  return figmaKeywords.some(kw => skillsText.includes(kw) || analysisLower.includes(kw));
}

function hasMobilePortfolio(candidate: Candidate): boolean {
  const analysisLower = candidate.ai_analysis?.toLowerCase() ?? '';
  const portfolioKeywords = [
    'portfolio', 'behance', 'dribbble', 'case study', 'case studies',
    'notion', 'personal site', 'website', '.com',
    'ui kit', 'design work', 'mobile screens', 'app design',
    'ux flow', 'user flow', 'onboarding flow', 'paywall'
  ];
  return portfolioKeywords.some(kw => analysisLower.includes(kw));
}

function hasDesignSystemWork(candidate: Candidate): boolean {
  const text = [candidate.ai_analysis, ...(candidate.skills ?? [])].join(' ').toLowerCase();
  const dsKeywords = [
    'design system', 'component library', 'ui kit', 'design tokens',
    'style guide', 'pattern library', 'figma library',
    'storybook', 'behance', 'dribbble', 'open-source design'
  ];
  return dsKeywords.some(kw => text.includes(kw));
}

function hasEngineeringCollab(candidate: Candidate): boolean {
  const text = [candidate.ai_analysis, ...(candidate.skills ?? [])].join(' ').toLowerCase();
  const handoffKeywords = [
    'zeplin', 'lottie', 'rive', 'after effects', 'handoff', 'hand-off',
    'design specs', 'developer handoff', 'qa review', 'design qa',
    'collaborate with engineer', 'collaborate with dev',
    'worked with dev', 'worked alongside eng'
  ];
  return handoffKeywords.some(kw => text.includes(kw));
}

function hasAIInDesign(candidate: Candidate): boolean {
  const text = [candidate.ai_analysis, ...(candidate.skills ?? [])].join(' ').toLowerCase();
  const aiDesignKeywords = [
    'midjourney', 'dall-e', 'stable diffusion', 'galileo',
    'framer ai', 'ai design', 'generative ui', 'copilot design',
    'ai tools', 'chatgpt', 'claude', 'llm', 'ai workflow',
    'artificial intelligence', 'machine learning'
  ];
  return aiDesignKeywords.some(kw => text.includes(kw));
}

// ── End UI/UX Designer helpers ──────────────────────────────────────────────

export function getDefaultUIUXDesignerFilters(): SearchFilterCriteria {
  return {
    // Demographics
    min_age: 18,
    max_age: 35,
    has_engineering_degree: false,   // not required — design background is enough
    engineering_match: 'nice_to_have',

    // Technical XX (2pts each)
    // has_published_apps → shipped real mobile app (App Store / Play Store)
    has_published_apps: true,
    published_apps_match: 'required',

    // has_core_stack_exp → Figma mastery (advanced Figma + professional tooling)
    has_core_stack_exp: true,
    core_stack_match: 'required',

    // Mobile portfolio with case studies — non-negotiable
    has_portfolio_online: true,
    portfolio_match: 'required',

    // Design System / public design portfolio — preferred but not hard-required
    open_source_contributor: true,
    open_source_match: 'preferred',

    // Entrepreneurship XX
    startup_early_stage_exp: true,
    startup_match: 'preferred',

    founded_business: false,
    founded_match: 'nice_to_have',

    // Complementary X (1pt each)
    backend_knowledge: 'none',       // handoff is scored via hasEngineeringCollab()
    backend_match: 'nice_to_have',

    // ui_ux_awareness slot reused for AI-in-design
    ui_ux_awareness: true,
    ui_ux_match: 'preferred',

    // ICP: active AI usage in daily design workflow
    ai_experience: true,
    ai_match: 'preferred',
  };
}

export function getDefaultFlutterFilters(): SearchFilterCriteria {
  return {
    // Demographics
    min_age: 18,
    max_age: 30,
    has_engineering_degree: true,
    engineering_match: 'preferred',
    
    // Technical (XX = 2pts each)
    has_published_apps: true,
    published_apps_match: 'required',
    
    has_core_stack_exp: true,
    core_stack_match: 'required',
    
    has_portfolio_online: true,
    portfolio_match: 'preferred',
    
    open_source_contributor: true,
    open_source_match: 'preferred',
    
    // Entrepreneurship
    startup_early_stage_exp: true,
    startup_match: 'preferred',
    
    founded_business: false,
    founded_match: 'nice_to_have',
    
    // Complementary (X = 1pt each)
    backend_knowledge: 'supabase',
    backend_match: 'nice_to_have',
    
    ui_ux_awareness: true,
    ui_ux_match: 'nice_to_have',
    
    ai_experience: false,
    ai_match: 'nice_to_have'
  };
}

// ============= BACKEND PRODUCT ENGINEER SCORING =============
//
// Reuses the same 15-point ScoreBreakdown slots with new semantics:
//
// - Age (18-30): 1pt
// - Engineering Degree: 1pt
// - published_apps → Backend/APIs in production: 2pts (XX)
// - core_stack → Node.js + TypeScript + PostgreSQL/Supabase: 2pts (XX)
// - portfolio → GitHub with active backend repos: 2pts (XX)
// - open_source → Open source backend contributions: 2pts (XX)
// - startup → Early-Stage Startup Experience: 2pts (XX)
// - founder → Founded Business: 1pt
// - backend → Mobile SDK integrations (RevenueCat, Superwall, Segment): 1pt
// - ui_ux → Product mindset / feature ownership: 1pt
// - ai → AI / data pipeline experience: 1pt

export function calculateBackendEngineerScore(
  candidate: Candidate,
  criteria: SearchFilterCriteria
): { score: number; breakdown: ScoreBreakdown; passes_threshold: boolean } {

  const breakdown: ScoreBreakdown = {
    age: 0,
    education: 0,
    published_apps: 0,
    core_stack: 0,
    portfolio: 0,
    open_source: 0,
    startup: 0,
    founder: 0,
    backend: 0,
    ui_ux: 0,
    ai: 0,
    total: 0,
    normalized: 0,
    passes_threshold: false
  };

  // 1. Age (0-1pt)
  const candidateAge = extractAge(candidate);
  if (candidateAge && candidateAge >= criteria.min_age && candidateAge <= criteria.max_age) {
    breakdown.age = 1;
  }

  // 2. Engineering Degree (0-1pt)
  if (criteria.has_engineering_degree && hasEngineeringDegree(candidate)) {
    breakdown.education = 1;
  }

  // 3. Backend / APIs in production (0-2pts)
  if (criteria.has_published_apps && hasBackendProductionExperience(candidate)) {
    breakdown.published_apps = 2;
  }

  // 4. Core backend stack: Node.js, TypeScript, PostgreSQL/Supabase (0-2pts)
  if (criteria.has_core_stack_exp && hasBackendCoreStack(candidate)) {
    breakdown.core_stack = 2;
  }

  // 5. GitHub portfolio with active backend repos (0-2pts)
  if (criteria.has_portfolio_online && hasPortfolio(candidate)) {
    breakdown.portfolio = 2;
  }

  // 6. Open source backend contributions (0-2pts)
  if (criteria.open_source_contributor && hasOpenSourceActivity(candidate)) {
    breakdown.open_source = 2;
  }

  // 7. Early-Stage Startup Experience (0-2pts)
  if (criteria.startup_early_stage_exp && hasStartupExperience(candidate)) {
    breakdown.startup = 2;
  }

  // 8. Founded Business/SaaS/App (0-1pt)
  if (criteria.founded_business && hasFoundedBusiness(candidate)) {
    breakdown.founder = 1;
  }

  // 9. Mobile SDK integrations: RevenueCat, Superwall, Segment, etc. (0-1pt)
  if (criteria.backend_knowledge !== 'none' && hasMobileSDKIntegrationExp(candidate)) {
    breakdown.backend = 1;
  }

  // 10. Product mindset / feature ownership (0-1pt)
  if (criteria.ui_ux_awareness && hasProductMindset(candidate)) {
    breakdown.ui_ux = 1;
  }

  // 11. AI / data pipeline experience (0-1pt)
  if (criteria.ai_experience && hasAIExperience(candidate)) {
    breakdown.ai = 1;
  }

  breakdown.total =
    breakdown.age +
    breakdown.education +
    breakdown.published_apps +
    breakdown.core_stack +
    breakdown.portfolio +
    breakdown.open_source +
    breakdown.startup +
    breakdown.founder +
    breakdown.backend +
    breakdown.ui_ux +
    breakdown.ai;

  breakdown.normalized = Math.round((breakdown.total / 15) * 100);
  breakdown.passes_threshold = breakdown.total >= 12;

  return {
    score: breakdown.total,
    breakdown,
    passes_threshold: breakdown.passes_threshold
  };
}

// ── Backend Engineer helpers ────────────────────────────────────────────────

function hasBackendProductionExperience(candidate: Candidate): boolean {
  const text = [candidate.ai_analysis, candidate.job_title, ...(candidate.skills ?? [])]
    .filter(Boolean).join(' ').toLowerCase();

  const keywords = [
    'production api', 'api en producción', 'deployed service', 'backend para',
    'server-side', 'shipped backend', 'consumer app backend', 'rest api',
    'revenuecat', 'superwall', 'segment', 'backend engineer', 'backend developer',
    'product engineer', 'api design', 'microservices', 'backend service',
    'backend en producción', 'servicio en producción'
  ];
  return keywords.some(kw => text.includes(kw));
}

function hasBackendCoreStack(candidate: Candidate): boolean {
  if (!candidate.skills || candidate.skills.length === 0) return false;

  const coreKeywords = [
    'node', 'nodejs', 'node.js', 'typescript', 'express', 'fastapi',
    'python', 'go', 'golang', 'rust', 'postgresql', 'postgres',
    'supabase', 'firebase', 'rest api', 'graphql', 'microservices',
    'nestjs', 'prisma', 'drizzle', 'trpc'
  ];
  return candidate.skills.some(skill =>
    coreKeywords.some(kw => skill.toLowerCase().includes(kw))
  );
}

function hasMobileSDKIntegrationExp(candidate: Candidate): boolean {
  const text = [candidate.ai_analysis, ...(candidate.skills ?? [])]
    .filter(Boolean).join(' ').toLowerCase();

  const keywords = [
    'revenuecat', 'superwall', 'segment', 'amplitude', 'mixpanel',
    'firebase analytics', 'in-app purchase', 'subscription', 'analytics sdk',
    'revenue cat', 'in app purchase', 'appstore connect', 'stripe',
    'payment gateway', 'billing', 'suscripción', 'analytics integration'
  ];
  return keywords.some(kw => text.includes(kw));
}

function hasProductMindset(candidate: Candidate): boolean {
  const text = (candidate.ai_analysis ?? '').toLowerCase();
  // Strong signals only — generic backend verbs ('launched', 'deploy') removed
  // to avoid false positives on infrastructure/enterprise engineers.
  // Added Spanish equivalents since AI analyses are generated in Spanish.
  const keywords = [
    // English — explicit product ownership language
    'feature owner', 'shipped feature', 'end-to-end', 'product thinking',
    'product engineer', 'product mindset', 'technical ownership',
    'owns the feature', 'owned the feature', 'full ownership',
    // Spanish — product ownership signals
    'dueño del feature', 'dueño de la feature', 'ownership del producto',
    'ingeniero de producto', 'enfoque de producto', 'mentalidad de producto',
    'impacto en el producto', 'impacto en el negocio', 'autonomía técnica',
    'responsabilidad end-to-end', 'entregó la feature', 'lanzó el feature',
    'proyecto propio', 'producto propio', 'app propia', 'side project',
    'emprendimiento propio', 'producto real', 'usuarios reales',
    // Role title signals (title contains "product engineer")
    'product engineer', 'backend product'
  ];
  return keywords.some(kw => text.includes(kw));
}

// ── End Backend Engineer helpers ────────────────────────────────────────────

export function getDefaultBackendEngineerFilters(): SearchFilterCriteria {
  return {
    // Demographics
    min_age: 18,
    max_age: 30,
    has_engineering_degree: true,
    engineering_match: 'preferred',

    // Technical XX (2pts each)
    // has_published_apps → Backend/APIs in production
    has_published_apps: true,
    published_apps_match: 'required',

    // has_core_stack_exp → Node.js + TypeScript + PostgreSQL/Supabase
    has_core_stack_exp: true,
    core_stack_match: 'required',

    // GitHub portfolio with active backend repos
    has_portfolio_online: true,
    portfolio_match: 'preferred',

    // Open source backend contributions
    open_source_contributor: true,
    open_source_match: 'preferred',

    // Entrepreneurship XX
    startup_early_stage_exp: true,
    startup_match: 'preferred',

    founded_business: false,
    founded_match: 'nice_to_have',

    // Complementary X (1pt each)
    // backend_knowledge → Mobile SDK integrations (RevenueCat, Superwall, Segment)
    backend_knowledge: 'custom',
    backend_match: 'nice_to_have',

    // ui_ux_awareness → product mindset / feature ownership
    ui_ux_awareness: true,
    ui_ux_match: 'nice_to_have',

    ai_experience: false,
    ai_match: 'nice_to_have'
  };
}
