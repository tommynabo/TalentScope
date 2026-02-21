import { ScrapedCandidate, ScrapingFilter } from '../types/marketplace';

/**
 * MarketplaceScoring - Calculate TalentScore for candidates
 * 
 * Factors:
 * - Job success rate (most important)
 * - Hourly rate (inverse - lower rates for juniors, but shouldn't penalize too much)
 * - Experience (total jobs, total hours, years)
 * - Skills match with filter
 * - Recency (freshness of last job)
 * - Certifications/badges
 */

export interface ScoringBreakdown {
  successRate: number;
  experience: number;
  skillsMatch: number;
  rateRelevance: number;
  relevanceBonus: number;
  recencyBonus: number;
  normalized: number;
}

export class MarketplaceScoringService {
  /**
   * Calculate TalentScore (0-100) for a candidate
   */
  static calculateTalentScore(
    candidate: ScrapedCandidate,
    filter: ScrapingFilter
  ): { score: number; breakdown: ScoringBreakdown } {
    const breakdown: ScoringBreakdown = {
      successRate: 0,
      experience: 0,
      skillsMatch: 0,
      rateRelevance: 0,
      relevanceBonus: 0,
      recencyBonus: 0,
      normalized: 0,
    };

    // 1. SUCCESS RATE (40 points max)
    // Job success rate is the single best predictor
    breakdown.successRate = Math.min(40, (candidate.jobSuccessRate || 0) * 0.4);

    // 2. EXPERIENCE (30 points max)
    // Combination of jobs completed and hours worked
    const experienceScore = this.calculateExperienceScore(candidate);
    breakdown.experience = Math.min(30, experienceScore);

    // 3. SKILLS MATCH (20 points max)
    breakdown.skillsMatch = this.calculateSkillsMatch(candidate, filter);

    // 4. RATE RELEVANCE (5 points max)
    // Having a reasonable rate shows they're professional
    // Very low rates might indicate inexperience, very high might indicate niche
    breakdown.rateRelevance = this.calculateRateRelevance(candidate, filter);

    // 5. RECENCY BONUS (3 points max)
    // Recent activity is good (within last 30 days)
    breakdown.recencyBonus = this.calculateRecencyBonus(candidate);

    // 6. RELEVANCE BONUS (2 points max)
    // Badges/certifications in relevant areas
    breakdown.relevanceBonus = this.calculateRelevanceBonus(candidate, filter);

    // TOTAL (normalized to 0-100)
    const rawScore =
      breakdown.successRate +
      breakdown.experience +
      breakdown.skillsMatch +
      breakdown.rateRelevance +
      breakdown.recencyBonus +
      breakdown.relevanceBonus;

    breakdown.normalized = Math.round(Math.min(100, Math.max(0, rawScore)));

    return {
      score: breakdown.normalized,
      breakdown,
    };
  }

  private static calculateExperienceScore(candidate: ScrapedCandidate): number {
    const totalJobs = candidate.totalJobs || 0;
    const totalHours = candidate.totalHours || 0;
    const yearsExp = candidate.yearsExperience || 0;

    // Prefer jobs and hours over years estimate
    let score = 0;

    if (totalJobs > 0) {
      // 10+ jobs = 10 points, 50+ = 20 points, 100+ = 25 points
      score += Math.min(25, (totalJobs / 4));
    }

    if (totalHours > 0) {
      // 1000+ hours = 5 points, 5000+ = 10 points
      score += Math.min(10, (totalHours / 500));
    }

    if (yearsExp > 0) {
      // 1+ years = 2 points, 5+ years = 5 points
      score += Math.min(5, yearsExp);
    }

    return score;
  }

  private static calculateSkillsMatch(
    candidate: ScrapedCandidate,
    filter: ScrapingFilter
  ): number {
    if (!filter.skills || filter.skills.length === 0) {
      // No filter skills = neutral score
      return 10;
    }

    if (!candidate.skills || candidate.skills.length === 0) {
      // Has filter but candidate has no skills listed
      return 0;
    }

    const candidateSkillsLower = candidate.skills.map(s =>
      (s.name || s).toLowerCase()
    );
    const filterSkillsLower = filter.skills.map((s: any) =>
      (s.name || s).toLowerCase()
    );

    let matches = 0;
    for (const skill of filterSkillsLower) {
      if (candidateSkillsLower.some(cs => cs.includes(skill) || skill.includes(cs))) {
        matches++;
      }
    }

    // 1 match = 5 pts, 50% matches = 12 pts, 100% = 20 pts
    const matchRatio = matches / filterSkillsLower.length;
    return Math.round(matchRatio * 20);
  }

  private static calculateRateRelevance(
    candidate: ScrapedCandidate,
    filter: ScrapingFilter
  ): number {
    const rate = candidate.hourlyRate || 0;

    // If no rate listed, neutral
    if (rate === 0) {
      return 2.5;
    }

    // Prefer rates between $25-$150/hr (reasonable for professional freelancing)
    // Very low (<$5) or very high (>$500) loses points
    if (rate >= 25 && rate <= 150) {
      return 5;
    }
    if (rate >= 15 && rate <= 200) {
      return 4;
    }
    if (rate >= 10 && rate <= 300) {
      return 2.5;
    }

    // Very low or very high rates = lower relevance score
    return 1;
  }

  private static calculateRecencyBonus(candidate: ScrapedCandidate): number {
    if (!candidate.scrapedAt) {
      return 0;
    }

    const scrapedDate = new Date(candidate.scrapedAt);
    const now = new Date();
    const daysSinceScrape = (now.getTime() - scrapedDate.getTime()) / (1000 * 60 * 60 * 24);

    // If scraped in last 7 days - bonus
    if (daysSinceScrape <= 7) {
      return 3;
    }
    if (daysSinceScrape <= 30) {
      return 2;
    }
    if (daysSinceScrape <= 90) {
      return 1;
    }

    return 0;
  }

  private static calculateRelevanceBonus(
    candidate: ScrapedCandidate,
    filter: ScrapingFilter
  ): number {
    if (!candidate.badges || candidate.badges.length === 0) {
      return 0;
    }

    const badgesLower = candidate.badges.map((b: any) =>
      (b.name || b).toLowerCase()
    );
    const relevantBadges = [
      'top rated',
      'pro',
      'preferred',
      'verified',
      'certified',
      'award',
      'rising',
    ];

    for (const badge of badgesLower) {
      if (relevantBadges.some(rb => badge.includes(rb))) {
        return 2;
      }
    }

    return 0;
  }

  /**
   * Filter candidates by minimum score threshold
   */
  static filterByScore(
    candidates: ScrapedCandidate[],
    minScore: number
  ): ScrapedCandidate[] {
    return candidates.filter(c => (c.talentScore || 0) >= minScore);
  }

  /**
   * Sort candidates by score descending
   */
  static sortByScore(candidates: ScrapedCandidate[]): ScrapedCandidate[] {
    return [...candidates].sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
  }
}
