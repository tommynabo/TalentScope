import { Candidate, SearchFilterCriteria, ScoreBreakdown } from '../types/database';

/**
 * FLUTTER DEVELOPER SCORING SYSTEM
 * 
 * Max Score: 15 points
 * Threshold: 8 points (normalized to 70/100)
 * 
 * Criteria breakdown:
 * - Age (18-30): 1pt
 * - Engineering Degree: 1pt
 * - Published Apps: 2pts (XX)
 * - Flutter/Dart Experience: 2pts (XX)
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
    flutter_dart: 0,
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

  // 4. Flutter/Dart Experience (0-2pts)
  if (criteria.has_flutter_dart_exp && hasFlutterDartExperience(candidate)) {
    breakdown.flutter_dart = 2;
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
    breakdown.flutter_dart + 
    breakdown.portfolio + 
    breakdown.open_source + 
    breakdown.startup + 
    breakdown.founder + 
    breakdown.backend + 
    breakdown.ui_ux + 
    breakdown.ai;

  // Normalize to 100 (max 15 points)
  breakdown.normalized = Math.round((breakdown.total / 15) * 100);
  
  // Threshold: minimum 8 points = 53.3%, rounded to 70% on the display scale
  breakdown.passes_threshold = breakdown.total >= 8;

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

function hasFlutterDartExperience(candidate: Candidate): boolean {
  if (!candidate.skills || candidate.skills.length === 0) return false;
  
  const flutterKeywords = ['flutter', 'dart'];
  return candidate.skills.some(skill => 
    flutterKeywords.some(kw => skill.toLowerCase().includes(kw))
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
    
    has_flutter_dart_exp: true,
    flutter_dart_match: 'required',
    
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
