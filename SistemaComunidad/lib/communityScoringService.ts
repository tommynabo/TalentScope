import {
    CommunityCandidate,
    CommunityFilterCriteria,
    CommunityScoreBreakdown,
} from '../types/community';

/**
 * CommunityScoringService
 * 
 * Calculates TalentScore (0-100) for community candidates.
 * 
 * Scoring factors:
 * - Activity Level (30pts): Message frequency, consistency, engagement
 * - Helpfulness (25pts): Answering questions, reactions, mentoring
 * - Project Sharing (20pts): Links to repos, live apps, demos
 * - Reputation (15pts): Community roles, badges, moderator status
 * - Skills Match (7pts): Keyword overlap with filter criteria
 * - Recency Bonus (3pts): Recent activity within last 30 days
 */
export class CommunityScoringService {

    /**
     * Calculate TalentScore (0-100) for a community candidate
     */
    static calculateTalentScore(
        candidate: CommunityCandidate,
        filter: CommunityFilterCriteria
    ): { score: number; breakdown: CommunityScoreBreakdown } {
        const breakdown: CommunityScoreBreakdown = {
            activityLevel: 0,
            helpfulness: 0,
            projectSharing: 0,
            reputation: 0,
            skillsMatch: 0,
            recencyBonus: 0,
            normalized: 0,
        };

        // 1. ACTIVITY LEVEL (30 points max)
        breakdown.activityLevel = this.calculateActivityScore(candidate);

        // 2. HELPFULNESS (25 points max)
        breakdown.helpfulness = this.calculateHelpfulnessScore(candidate);

        // 3. PROJECT SHARING (20 points max)
        breakdown.projectSharing = this.calculateProjectSharingScore(candidate);

        // 4. REPUTATION (15 points max)
        breakdown.reputation = this.calculateReputationScore(candidate);

        // 5. SKILLS MATCH (7 points max)
        breakdown.skillsMatch = this.calculateSkillsMatch(candidate, filter);

        // 6. RECENCY BONUS (3 points max)
        breakdown.recencyBonus = this.calculateRecencyBonus(candidate);

        // TOTAL (normalized to 0-100)
        const rawScore =
            breakdown.activityLevel +
            breakdown.helpfulness +
            breakdown.projectSharing +
            breakdown.reputation +
            breakdown.skillsMatch +
            breakdown.recencyBonus;

        breakdown.normalized = Math.round(Math.min(100, Math.max(0, rawScore)));

        return {
            score: breakdown.normalized,
            breakdown,
        };
    }

    // ─── Activity Level (30pts max) ──────────────────────────────────────────

    private static calculateActivityScore(candidate: CommunityCandidate): number {
        const msgCount = candidate.messageCount || 0;
        let score = 0;

        // Message count scoring (logarithmic, not linear)
        // 10 msgs = 5pts, 50 = 12pts, 100 = 16pts, 500 = 22pts, 1000+ = 28pts
        if (msgCount > 0) {
            score = Math.min(28, Math.log10(msgCount + 1) * 9.3);
        }

        // Bonus for code snippets shared
        const codeSnippets = candidate.sharedCodeSnippets || 0;
        if (codeSnippets >= 10) score += 2;
        else if (codeSnippets >= 3) score += 1;

        return Math.min(30, Math.round(score * 10) / 10);
    }

    // ─── Helpfulness (25pts max) ─────────────────────────────────────────────

    private static calculateHelpfulnessScore(candidate: CommunityCandidate): number {
        let score = 0;

        // Questions answered (strongest signal of seniority)
        const answered = candidate.questionsAnswered || 0;
        if (answered >= 50) score += 15;
        else if (answered >= 20) score += 12;
        else if (answered >= 10) score += 8;
        else if (answered >= 5) score += 5;
        else if (answered >= 1) score += 2;

        // Helpfulness score from platform metrics (reactions, upvotes, etc.)
        const helpScore = candidate.helpfulnessScore || 0;
        if (helpScore >= 80) score += 10;
        else if (helpScore >= 60) score += 7;
        else if (helpScore >= 40) score += 5;
        else if (helpScore >= 20) score += 3;
        else if (helpScore > 0) score += 1;

        return Math.min(25, score);
    }

    // ─── Project Sharing (20pts max) ─────────────────────────────────────────

    private static calculateProjectSharingScore(candidate: CommunityCandidate): number {
        let score = 0;

        // Project links (live apps, demos)
        const projectCount = candidate.projectLinks?.length || 0;
        if (projectCount >= 5) score += 12;
        else if (projectCount >= 3) score += 9;
        else if (projectCount >= 1) score += 5;

        // GitHub/GitLab repo links shared
        const repoCount = candidate.repoLinks?.length || 0;
        if (repoCount >= 5) score += 8;
        else if (repoCount >= 3) score += 6;
        else if (repoCount >= 1) score += 3;

        return Math.min(20, score);
    }

    // ─── Reputation (15pts max) ──────────────────────────────────────────────

    private static calculateReputationScore(candidate: CommunityCandidate): number {
        let score = 0;

        // Community roles
        const roles = candidate.communityRoles?.map(r => r.toLowerCase()) || [];
        if (roles.some(r => r.includes('admin') || r.includes('owner'))) {
            score += 8;
        } else if (roles.some(r => r.includes('moderator') || r.includes('mod'))) {
            score += 6;
        } else if (roles.some(r =>
            r.includes('helper') || r.includes('contributor') || r.includes('top')
        )) {
            score += 4;
        } else if (roles.length > 0) {
            score += 2;
        }

        // Platform reputation score
        const repScore = candidate.reputationScore || 0;
        if (repScore >= 80) score += 7;
        else if (repScore >= 60) score += 5;
        else if (repScore >= 40) score += 3;
        else if (repScore >= 20) score += 1;

        return Math.min(15, score);
    }

    // ─── Skills Match (7pts max) ─────────────────────────────────────────────

    private static calculateSkillsMatch(
        candidate: CommunityCandidate,
        filter: CommunityFilterCriteria
    ): number {
        const filterKeywords = filter.keywords || [];
        if (filterKeywords.length === 0) return 3.5; // neutral if no keywords

        const candidateSkills = candidate.skills?.map(s => s.toLowerCase()) || [];
        const candidateBio = (candidate.bio || '').toLowerCase();

        if (candidateSkills.length === 0 && !candidateBio) return 0;

        let matches = 0;
        for (const keyword of filterKeywords) {
            const kw = keyword.toLowerCase();
            if (
                candidateSkills.some(s => s.includes(kw) || kw.includes(s)) ||
                candidateBio.includes(kw)
            ) {
                matches++;
            }
        }

        const matchRatio = matches / filterKeywords.length;
        return Math.round(matchRatio * 7 * 10) / 10;
    }

    // ─── Recency Bonus (3pts max) ────────────────────────────────────────────

    private static calculateRecencyBonus(candidate: CommunityCandidate): number {
        const lastActive = candidate.lastActiveDate || candidate.scrapedAt;
        if (!lastActive) return 0;

        const activeDate = new Date(lastActive);
        const now = new Date();
        const daysSince = (now.getTime() - activeDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince <= 7) return 3;
        if (daysSince <= 30) return 2;
        if (daysSince <= 90) return 1;
        return 0;
    }

    // ─── Utility Methods ────────────────────────────────────────────────────

    /**
     * Filter candidates by minimum score threshold
     */
    static filterByScore(
        candidates: CommunityCandidate[],
        minScore: number
    ): CommunityCandidate[] {
        return candidates.filter(c => (c.talentScore || 0) >= minScore);
    }

    /**
     * Sort candidates by score descending
     */
    static sortByScore(candidates: CommunityCandidate[]): CommunityCandidate[] {
        return [...candidates].sort((a, b) => (b.talentScore || 0) - (a.talentScore || 0));
    }

    /**
     * Score and rank a batch of candidates
     */
    static scoreAndRank(
        candidates: CommunityCandidate[],
        filter: CommunityFilterCriteria
    ): CommunityCandidate[] {
        const scored = candidates.map(candidate => {
            const { score, breakdown } = this.calculateTalentScore(candidate, filter);
            return {
                ...candidate,
                talentScore: score,
                scoreBreakdown: breakdown,
            };
        });

        return this.sortByScore(scored);
    }
}
