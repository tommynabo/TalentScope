import { GitHubMetrics } from '../types/database';

export interface LinkedInCandidateProfile {
  id: string;
  name: string;
  linkedin_url: string;
  headline: string;
  followers?: number;
  connections?: number;
  skills?: string[];
  email?: string;
  phone?: string;
  avatar_url?: string;
  company?: string;
  location?: string;
  match_score: number; // 0-100
  match_signals: string[];
}

export interface CrossLinkedCandidate {
  github_id: string;
  github_username: string;
  github_url: string;
  github_score: number;
  github_metrics: GitHubMetrics;
  
  linkedin_id?: string;
  linkedin_profile?: LinkedInCandidateProfile;
  
  link_status: 'linked' | 'pending' | 'failed' | 'no_match';
  link_confidence: number; // 0-100
  enriched_at?: string;
  enrichment_error?: string;
}

export interface CrossSearchOptions {
  github_metrics: GitHubMetrics[];
  search_email: boolean;
  search_username: boolean;
  search_name_fuzzy: boolean;
  min_confidence: number; // 0-100
  apify_actor_id?: string;
  timeout_ms: number;
}

export class ApifyCrossSearchService {
  private apifyApiKey: string;
  private apifyActorId: string;
  private baseUrl = 'https://api.apify.com/v2';

  constructor(apifyApiKey?: string, apifyActorId?: string) {
    this.apifyApiKey = apifyApiKey || import.meta.env.VITE_APIFY_API_KEY || '';
    this.apifyActorId = apifyActorId || import.meta.env.VITE_APIFY_LINKEDIN_ACTOR_ID || '';
    
    if (!this.apifyApiKey) {
      throw new Error('VITE_APIFY_API_KEY not configured');
    }
  }

  /**
   * Search LinkedIn profile for a GitHub developer using multiple signals
   */
  async searchLinkedInProfile(
    githubMetrics: GitHubMetrics,
    options: Partial<CrossSearchOptions> = {}
  ): Promise<CrossLinkedCandidate> {
    const searchSignals = this.buildSearchSignals(githubMetrics, options);
    
    try {
      const linkedInProfile = await this.performLinkedInSearch(searchSignals);
      
      if (linkedInProfile) {
        const linkConfidence = this.calculateMatchConfidence(githubMetrics, linkedInProfile);
        
        return {
          github_id: githubMetrics.github_id,
          github_username: githubMetrics.github_username,
          github_url: githubMetrics.github_url,
          github_score: githubMetrics.github_score,
          github_metrics: githubMetrics,
          
          linkedin_id: linkedInProfile.id,
          linkedin_profile: linkedInProfile,
          
          link_status: linkConfidence >= (options.min_confidence || 70) ? 'linked' : 'pending',
          link_confidence: linkConfidence,
          enriched_at: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error(`Error linking ${githubMetrics.github_username} to LinkedIn:`, error);
      
      return {
        github_id: githubMetrics.github_id,
        github_username: githubMetrics.github_username,
        github_url: githubMetrics.github_url,
        github_score: githubMetrics.github_score,
        github_metrics: githubMetrics,
        
        link_status: 'failed',
        link_confidence: 0,
        enrichment_error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return {
      github_id: githubMetrics.github_id,
      github_username: githubMetrics.github_username,
      github_url: githubMetrics.github_url,
      github_score: githubMetrics.github_score,
      github_metrics: githubMetrics,
      
      link_status: 'no_match',
      link_confidence: 0
    };
  }

  /**
   * Batch search for multiple GitHub developers (optimized for Apify actor calls)
   */
  async batchSearchLinkedInProfiles(
    githubMetrics: GitHubMetrics[],
    options: Partial<CrossSearchOptions> = {}
  ): Promise<CrossLinkedCandidate[]> {
    // Limit batch size to avoid rate limits
    const BATCH_SIZE = 10;
    const results: CrossLinkedCandidate[] = [];

    for (let i = 0; i < githubMetrics.length; i += BATCH_SIZE) {
      const batch = githubMetrics.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(metrics => this.searchLinkedInProfile(metrics, options))
      );
      
      results.push(...batchResults);
      
      // Avoid rate limiting
      if (i + BATCH_SIZE < githubMetrics.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  /**
   * Build comprehensive search signals from GitHub metrics
   */
  private buildSearchSignals(
    githubMetrics: GitHubMetrics,
    options: Partial<CrossSearchOptions>
  ): SearchSignals {
    const signals: SearchSignals = {
      primary: [],
      secondary: [],
      tertiary: []
    };

    // PRIMARY SIGNALS (highest confidence)
    if (options.search_email && githubMetrics.email) {
      signals.primary.push({
        type: 'email',
        value: githubMetrics.email,
        confidence: 95
      });
    }

    // SECONDARY SIGNALS (medium confidence)
    if (options.search_username) {
      signals.secondary.push({
        type: 'username',
        value: githubMetrics.github_username,
        confidence: 75
      });
    }

    if (githubMetrics.full_name) {
      signals.secondary.push({
        type: 'full_name',
        value: githubMetrics.full_name,
        confidence: 70
      });
    }

    // TERTIARY SIGNALS (lower confidence)
    if (options.search_name_fuzzy && githubMetrics.full_name) {
      const firstName = githubMetrics.full_name.split(' ')[0];
      if (firstName && firstName.length > 2) {
        signals.tertiary.push({
          type: 'first_name',
          value: firstName,
          confidence: 50
        });
      }
    }

    if (githubMetrics.top_languages && githubMetrics.top_languages.length > 0) {
      signals.tertiary.push({
        type: 'skills',
        value: githubMetrics.top_languages.join(', '),
        confidence: 40
      });
    }

    return signals;
  }

  /**
   * Call Apify actor to search LinkedIn
   */
  private async performLinkedInSearch(signals: SearchSignals): Promise<LinkedInCandidateProfile | null> {
    // Try signals in priority order
    const allSignals = [...signals.primary, ...signals.secondary, ...signals.tertiary];

    for (const signal of allSignals) {
      try {
        const profile = await this.callApifyLinkedInActor(signal);
        if (profile) {
          return profile;
        }
      } catch (error) {
        console.warn(`LinkedIn search failed for ${signal.type}:`, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Call Apify actor API for LinkedIn search
   */
  private async callApifyLinkedInActor(signal: SearchSignal): Promise<LinkedInCandidateProfile | null> {
    try {
      // Start Apify actor run
      const runResponse = await fetch(
        `${this.baseUrl}/actors/${this.apifyActorId}/calls?token=${this.apifyApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Apify actor input depends on which actor is being used
            // Typically: searchQuery, searchType, maxResults, etc.
            searchQuery: this.buildSearchQuery(signal),
            searchType: signal.type,
            maxResults: 5,
            timeout: 30000
          })
        }
      );

      if (!runResponse.ok) {
        throw new Error(`Apify API error: ${runResponse.statusText}`);
      }

      const run = await runResponse.json();
      
      // Wait for actor to complete
      const resultProfile = await this.waitForActorCompletion(run.id);
      return resultProfile;
    } catch (error) {
      console.error('Apify actor call failed:', error);
      return null;
    }
  }

  /**
   * Wait for Apify actor to complete and retrieve results
   */
  private async waitForActorCompletion(runId: string, timeout = 60000): Promise<LinkedInCandidateProfile | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const statusResponse = await fetch(
          `${this.baseUrl}/actor-runs/${runId}?token=${this.apifyApiKey}`
        );

        if (!statusResponse.ok) {
          throw new Error('Failed to get actor run status');
        }

        const runStatus = await statusResponse.json();

        if (runStatus.status === 'SUCCEEDED') {
          // Get actor results from dataset
          const resultsResponse = await fetch(
            `${this.baseUrl}/actor-runs/${runId}/dataset/items?token=${this.apifyApiKey}`
          );

          if (!resultsResponse.ok) {
            throw new Error('Failed to get actor results');
          }

          const results = await resultsResponse.json();
          return this.parseApifyResults(results);
        }

        if (runStatus.status === 'FAILED') {
          throw new Error(`Actor failed: ${runStatus.exitCode}`);
        }

        // Still running, wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error waiting for actor:', error);
        return null;
      }
    }

    throw new Error('Actor execution timeout');
  }

  /**
   * Parse Apify actor results into our format
   */
  private parseApifyResults(results: any[]): LinkedInCandidateProfile | null {
    if (!results || !results[0]) {
      return null;
    }

    const firstResult = results[0];

    return {
      id: firstResult.id || firstResult.profileId || '',
      name: firstResult.name || firstResult.fullName || '',
      linkedin_url: firstResult.linkedinUrl || firstResult.profileUrl || '',
      headline: firstResult.headline || firstResult.title || '',
      followers: firstResult.followers || firstResult.connections,
      connections: firstResult.connections,
      skills: firstResult.skills || [],
      email: firstResult.email,
      phone: firstResult.phone,
      avatar_url: firstResult.photoUrl || firstResult.avatarUrl,
      company: firstResult.company || firstResult.currentCompany,
      location: firstResult.location || firstResult.locationName,
      match_score: 100,
      match_signals: ['found_on_linkedin']
    };
  }

  /**
   * Calculate confidence score for GitHub-LinkedIn match
   */
  private calculateMatchConfidence(
    githubMetrics: GitHubMetrics,
    linkedInProfile: LinkedInCandidateProfile
  ): number {
    let score = 0;
    let signals = 0;

    // Email match (highest confidence)
    if (githubMetrics.email && linkedInProfile.email) {
      if (githubMetrics.email.toLowerCase() === linkedInProfile.email.toLowerCase()) {
        score += 100;
        signals += 1;
      }
    }

    // Name match
    if (githubMetrics.full_name && linkedInProfile.name) {
      const gitName = githubMetrics.full_name.toLowerCase();
      const linkedInName = linkedInProfile.name.toLowerCase();
      
      if (gitName === linkedInName) {
        score += 95;
        signals += 1;
      } else if (this.fuzzyNameMatch(gitName, linkedInName)) {
        score += 70;
        signals += 1;
      }
    }

    // Username match
    if (githubMetrics.github_username && linkedInProfile.name) {
      const username = githubMetrics.github_username.toLowerCase();
      const fullName = linkedInProfile.name.toLowerCase();
      
      if (fullName.includes(username) || username.includes(fullName.split(' ')[0])) {
        score += 60;
        signals += 1;
      }
    }

    // Skills overlap
    if (githubMetrics.top_languages && linkedInProfile.skills) {
      const commonSkills = githubMetrics.top_languages.filter(lang =>
        linkedInProfile.skills?.some(skill => 
          skill.toLowerCase().includes(lang.toLowerCase()) ||
          lang.toLowerCase().includes(skill.toLowerCase())
        )
      );
      
      if (commonSkills.length > 0) {
        score += Math.min(commonSkills.length * 15, 50);
        signals += 1;
      }
    }

    // Location consistency (if available)
    if (githubMetrics.location && linkedInProfile.location) {
      if (githubMetrics.location.toLowerCase() === linkedInProfile.location.toLowerCase()) {
        score += 40;
        signals += 1;
      }
    }

    // Average confidence across signals
    return signals > 0 ? Math.min(Math.round(score / signals), 100) : 0;
  }

  /**
   * Fuzzy name matching
   */
  private fuzzyNameMatch(name1: string, name2: string): boolean {
    const parts1 = name1.split(' ').filter(p => p.length > 0);
    const parts2 = name2.split(' ').filter(p => p.length > 0);

    // Check if all parts of shorter name are in longer name
    const shorter = parts1.length <= parts2.length ? parts1 : parts2;
    const longer = parts1.length <= parts2.length ? parts2 : parts1;

    return shorter.every(part => longer.some(lp => lp.startsWith(part) || part.startsWith(lp)));
  }

  /**
   * Build search query from signal
   */
  private buildSearchQuery(signal: SearchSignal): string {
    switch (signal.type) {
      case 'email':
        return signal.value;
      case 'full_name':
        return signal.value;
      case 'username':
        return `"${signal.value}"`;
      case 'first_name':
        return signal.value;
      case 'skills':
        return `skills: ${signal.value}`;
      default:
        return signal.value;
    }
  }
}

interface SearchSignal {
  type: 'email' | 'full_name' | 'username' | 'first_name' | 'skills';
  value: string;
  confidence: number;
}

interface SearchSignals {
  primary: SearchSignal[];
  secondary: SearchSignal[];
  tertiary: SearchSignal[];
}

/**
 * Extend SearchEngine integration point
 */
export async function performCrossSearch(
  githubResults: GitHubMetrics[],
  onProgress?: (completed: number, total: number) => void
): Promise<CrossLinkedCandidate[]> {
  const crossSearchService = new ApifyCrossSearchService();
  
  const results = await crossSearchService.batchSearchLinkedInProfiles(githubResults, {
    search_email: true,
    search_username: true,
    search_name_fuzzy: true,
    min_confidence: 70,
    timeout_ms: 60000
  });

  return results;
}
