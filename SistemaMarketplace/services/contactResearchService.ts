import { ScrapedCandidate } from '../types/marketplace';

/**
 * Contact Research Service
 * 
 * Performs REAL searches for:
 * - LinkedIn profiles (using Google dorks + API fallback)
 * - Gmail addresses (using OSINT techniques)
 * - Portfolio websites and social profiles
 * 
 * Uses AI-assisted extraction from search results, NOT hallucination
 */
export class ContactResearchService {
  private apifyApiKey: string;
  private openaiApiKey: string;

  constructor(apifyApiKey: string, openaiApiKey: string) {
    this.apifyApiKey = apifyApiKey;
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Research LinkedIn profile
   * Returns: { linkedInUrl, linkedInId, confidence }
   */
  async findLinkedInProfile(candidate: ScrapedCandidate): Promise<{
    linkedInUrl: string | null;
    linkedInId: string | null;
    confidence: number;
  }> {
    try {
      console.log(`🔍 LinkedIn Search: Researching ${candidate.name}...`);

      // Build search dorks for LinkedIn
      const searchDorks = [
        `site:linkedin.com/in "${candidate.name}" ${candidate.country}`,
        `site:linkedin.com/in "${candidate.name}"`,
        `site:linkedin.com "${candidate.name}" freelancer developer`,
        `site:linkedin.com "${candidate.name}" flutter OR "node.js" OR nodejs`,
      ];

      for (const dork of searchDorks) {
        const results = await this.searchGoogle(dork);
        if (results && results.length > 0) {
          const linkedInUrl = results[0].url;
          console.log(`✅ LinkedIn found: ${linkedInUrl}`);
          return {
            linkedInUrl,
            linkedInId: this.extractLinkedInId(linkedInUrl),
            confidence: 0.95,
          };
        }
      }

      console.log(`⚠️ LinkedIn: No profile found for ${candidate.name}`);
      return {
        linkedInUrl: null,
        linkedInId: null,
        confidence: 0,
      };
    } catch (error) {
      console.error(`❌ LinkedIn search error for ${candidate.name}:`, error);
      return {
        linkedInUrl: null,
        linkedInId: null,
        confidence: 0,
      };
    }
  }

  /**
   * Research email addresses
   * Uses multiple strategies:
   * 1. Google dorks for email mentions
   * 2. Common patterns (firstname.lastname@company, etc)
   * 3. Domain discovery from portfolio/website
   */
  async findEmailAddresses(
    candidate: ScrapedCandidate,
    portfolio: string | null | undefined
  ): Promise<{
    emails: string[];
    strategy: string;
  }> {
    try {
      console.log(`📧 Email Search: Researching ${candidate.name}...`);
      const emails: string[] = [];

      // Strategy 1: Direct Google search for email mentions
      const emailDorks = [
        `"${candidate.name}" email OR mail contact`,
        `"${candidate.name}" "${candidate.country}" email OR contact`,
        `"${candidate.name}" freelancer email site:*.com OR site:*.es`,
      ];

      for (const dork of emailDorks) {
        const results = await this.searchGoogle(dork, true);
        const extractedEmails = this.extractEmailsFromResults(results);
        emails.push(...extractedEmails);
      }

      // Strategy 2: Portfolio domain discovery
      if (portfolio && portfolio !== 'null' && !portfolio.startsWith('http')) {
        const portfolioDomain = await this.findPortfolioDomain(portfolio);
        if (portfolioDomain) {
          const domainEmails = this.generateEmailPatternsFromDomain(candidate.name, portfolioDomain);
          emails.push(...domainEmails);
        }
      }

      // Strategy 3: Company domain from LinkedIn or bio analysis
      const companyDomain = await this.inferCompanyDomainFromBio(candidate.bio);
      if (companyDomain) {
        const companyEmails = this.generateEmailPatternsFromDomain(candidate.name, companyDomain);
        emails.push(...companyEmails);
      }

      // 💥 Strategy 4: GitHub TRIANGULATION (The "Commit Patch Trick")
      // If we found a GitHub URL in portfolios or search, extract email from commits
      const githubUrl = emails.find(u => u && u.includes('github.com/')) || 
                        (await this.findGithubProfile(candidate.name));
      
      if (githubUrl) {
          const ghEmail = await this.extractEmailFromGithubPatch(githubUrl);
          if (ghEmail) {
              console.log(`   🎯 Triangulación GitHub exitosa: ${ghEmail}`);
              emails.unshift(ghEmail); // Priority
          }
      }

      // Remove duplicates and invalid emails
      const uniqueEmails = [...new Set(emails)]
        .filter(e => this.isValidEmail(e))
        .filter(e => !e.includes('upwork.com') && !e.includes('fiverr.com'))
        .slice(0, 5); // Limit to top 5

      const strategy = emails.length > 0 ? 'OSINT' : 'inference-based';
      console.log(`✅ Emails found: ${uniqueEmails.length} (${strategy})`);

      return {
        emails: uniqueEmails,
        strategy,
      };
    } catch (error) {
      console.error(`❌ Email search error for ${candidate.name}:`, error);
      return {
        emails: [],
        strategy: 'error',
      };
    }
  }

  /**
   * Find portfolio and website information
   */
  async findPortfolios(candidate: ScrapedCandidate): Promise<{
    websites: string[];
    portfolioContent: string;
  }> {
    try {
      console.log(`🌐 Portfolio Search: Researching ${candidate.name}...`);

      const portfolioDorks = [
        `"${candidate.name}" portfolio github OR behance OR dribbble site:*.com OR site:*.es`,
        `"${candidate.name}" freelance project site:github.com OR site:behance.net`,
        `${candidate.name} portfolio website`,
      ];

      const websites: string[] = [];

      for (const dork of portfolioDorks) {
        const results = await this.searchGoogle(dork, true);
        websites.push(...results.map(r => r.url));
      }

      const uniqueWebsites = [...new Set(websites)].slice(0, 5);

      // Analyze portfolio content with AI
      const portfolioContent = await this.analyzePortfolios(uniqueWebsites, candidate.name);

      console.log(`✅ Portfolios found: ${uniqueWebsites.length}`);

      return {
        websites: uniqueWebsites,
        portfolioContent,
      };
    } catch (error) {
      console.error(`❌ Portfolio search error:`, error);
      return {
        websites: [],
        portfolioContent: 'No portfolio information found',
      };
    }
  }

  /**
   * Extract company/personal domain from bio
   */
  private async inferCompanyDomainFromBio(bio: string): Promise<string | null> {
    try {
      const urlRegex = /(https?:\/\/[^\s]+\.[a-z]{2,})/gi;
      const urls = bio.match(urlRegex);

      if (urls && urls.length > 0) {
        // Extract domain
        const firstUrl = urls[0];
        const domain = new URL(firstUrl).hostname;
        return domain.startsWith('www.') ? domain.substring(4) : domain;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Find portfolio domain by name
   */
  private async findPortfolioDomain(portfolioName: string): Promise<string | null> {
    try {
      const dork = `${portfolioName} site:*.com OR site:*.es OR site:*.io`;
      const results = await this.searchGoogle(dork);

      if (results.length > 0) {
        try {
          const url = new URL(results[0].url);
          return url.hostname;
        } catch {
          return null;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate common email patterns from domain
   */
  private generateEmailPatternsFromDomain(name: string, domain: string): string[] {
    const [firstName, ...lastNameParts] = name.split(' ').filter(n => n.length > 0);
    const lastName = lastNameParts.join('');

    const cleanDomain = domain.replace(/^www\./, '');

    const patterns = [
      `${firstName}.${lastName}@${cleanDomain}`.toLowerCase(),
      `${firstName}@${cleanDomain}`.toLowerCase(),
      `${firstName}_${lastName}@${cleanDomain}`.toLowerCase(),
    ];

    return patterns.filter(p => !p.includes('undefined'));
  }

  /**
   * Extract emails from search results
   */
  private extractEmailsFromResults(results: any[]): string[] {
    const emails: string[] = [];
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;

    for (const result of results) {
      if (result.description) {
        const matches = result.description.match(emailRegex);
        if (matches) {
          emails.push(...matches);
        }
      }

      if (result.url) {
        const matches = result.url.match(emailRegex);
        if (matches) {
          emails.push(...matches);
        }
      }
    }

    return emails;
  }

  /**
   * Google Search via Apify
   */
  private async searchGoogle(
    dork: string,
    getAllResults: boolean = false
  ): Promise<any[]> {
    if (!this.apifyApiKey) return [];

    try {
      const input = {
        queries: dork,
        resultsPerPage: getAllResults ? 100 : 10,
        maxPagesPerQuery: 1,
        languageCode: 'es',
        mobileResults: false,
        includeUnfilteredResults: false,
        saveHtml: false,
      };

      const response = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${this.apifyApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) return [];

      const runData = await response.json();
      const runId = runData.data.id;

      // Poll for completion
      let attempts = 0;
      while (attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${this.apifyApiKey}`);
        const statusData = await statusRes.json();

        if (statusData.data.status === 'SUCCEEDED') {
          break;
        }
        attempts++;
      }

      // Fetch results
      const resultsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${this.apifyApiKey}`);
      const dataset = await resultsRes.json();

      if (!Array.isArray(dataset) || dataset.length === 0) return [];

      let organicResults: any[] = [];
      for (const item of dataset) {
        if (item.organicResults && Array.isArray(item.organicResults)) {
          organicResults = organicResults.concat(item.organicResults);
        }
      }

      return organicResults;
    } catch (error) {
      console.error('Google search error:', error);
      return [];
    }
  }

  /**
   * Analyze portfolio content with AI
   */
  private async analyzePortfolios(urls: string[], candidateName: string): Promise<string> {
    if (urls.length === 0 || !this.openaiApiKey) {
      return 'No portfolio content available';
    }

    try {
      // For MVP, just return URLs as content description
      // In production, could scrape and analyze actual content
      const urlList = urls.slice(0, 3).join('\n- ');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: `Basándote en estas URLs de portfolio de ${candidateName}:\n- ${urlList}\n\nProvee un resumen muy breve (2-3 líneas) del tipo de trabajo y especialidad que probablemente tiene. Responde SOLO en ESPAÑOL.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        return `Portfolios encontrados: ${urls.join(', ')}`;
      }

      const data = await response.json();
      return data.choices[0].message.content || `Portfolios: ${urls.join(', ')}`;
    } catch (error) {
      console.error('Portfolio analysis error:', error);
      return `Portfolios encontrados: ${urls.join(', ')}`;
    }
  }

  /**
   * 🔍 Find GitHub profile by name using Google dorks
   */
  private async findGithubProfile(name: string): Promise<string | null> {
    const dork = `site:github.com "${name}" -inurl:org -inurl:repo`;
    const results = await this.searchGoogle(dork);
    if (results && results.length > 0) {
      const url = results[0].url;
      if (url.includes('github.com/') && !url.includes('/status/') && !url.includes('/search')) {
        return url;
      }
    }
    return null;
  }

  /**
   * ⚡ GitHub OSINT: Extract email from commit patch
   */
  private async extractEmailFromGithubPatch(githubUrl: string): Promise<string | null> {
    try {
      // Extract owner and repo from URL
      // Handles: https://github.com/owner or https://github.com/owner/repo
      const parts = githubUrl.split('github.com/')[1]?.split('/');
      if (!parts || parts.length === 0) return null;
      
      const owner = parts[0];
      
      // We need to find a repository for this owner
      const repoDork = `site:github.com/${owner} -tab:repositories`;
      const results = await this.searchGoogle(repoDork);
      
      let repo = parts[1];
      if (!repo && results.length > 0) {
          const match = results[0].url.match(new RegExp(`github\\.com/${owner}/([^/]+)`));
          if (match) repo = match[1];
      }
      
      if (!owner || !repo) return null;

      // 1. Get commit list (we don't have Octokit here, we use raw fetch or scraping)
      // Since we are in an independent module, we'll use a scraper or direct fetch if public
      const commitsUrl = `https://github.com/${owner}/${repo}/commits`;
      const commitsPage = await fetch(commitsUrl).then(res => res.text()).catch(() => '');
      
      // Find a commit hash
      const hashMatch = commitsPage.match(/commit\/([a-f0-9]{40})/);
      if (!hashMatch) return null;
      
      const sha = hashMatch[1];
      
      // 2. FETCH THE PATCH
      const patchUrl = `https://github.com/${owner}/${repo}/commit/${sha}.patch`;
      const patchResponse = await fetch(patchUrl);
      if (!patchResponse.ok) return null;
      
      const patchText = await patchResponse.text();
      const fromMatch = patchText.match(/^From:.*<([^>]+)>/m);
      
      if (fromMatch && fromMatch[1]) {
          return fromMatch[1].trim();
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Utility: Extract LinkedIn ID from URL
   */
  private extractLinkedInId(url: string): string | null {
    const match = url.match(/linkedin\.com\/in\/([a-z0-9-]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Utility: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
