import { ScrapedCandidate, EnrichedCandidate } from '../types/marketplace';
import { ContactResearchService } from './contactResearchService';

export class AIEnrichmentService {
  private openaiApiKey: string;
  private apifyApiKey: string;
  private modelId: string = 'gpt-4o-mini'; // Usa mini para mejor precio
  private contactResearch: ContactResearchService;

  constructor(openaiApiKey: string, apifyApiKey: string = import.meta.env.VITE_APIFY_API_KEY) {
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.openaiApiKey = openaiApiKey;
    this.apifyApiKey = apifyApiKey;
    this.contactResearch = new ContactResearchService(apifyApiKey, openaiApiKey);
  }

  async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models/gpt-4o-mini', {
        headers: { Authorization: `Bearer ${this.openaiApiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async enrichCandidate(candidate: ScrapedCandidate): Promise<EnrichedCandidate> {
    try {
      console.log(`\n🤖 Starting AI enrichment for ${candidate.name}...`);

      // Step 1: Research REAL LinkedIn & email addresses
      const [linkedInResult, emailResult, portfoliosResult] = await Promise.all([
        this.contactResearch.findLinkedInProfile(candidate),
        this.contactResearch.findEmailAddresses(candidate, null),
        this.contactResearch.findPortfolios(candidate),
      ]);

      console.log(`   ✅ Research complete: LinkedIn=${linkedInResult.linkedInUrl ? '✓' : '✗'}, Emails=${emailResult.emails.length}, Portfolios=${portfoliosResult.websites.length}`);

      // Step 2: AI analysis of profile with deep insights
      const enrichmentPrompt = this.generateEnrichmentPrompt(candidate, portfoliosResult);
      const enrichedData = await this.callOpenAI(enrichmentPrompt);
      const parsed = this.parseEnrichmentResponse(enrichedData, candidate);

      // Combine real research with AI analysis
      // Emails: Priority to real found emails, fallback to AI inferred
      const allEmails = [
        ...emailResult.emails, // Real emails first
        ...(parsed.emails || []).filter(e => !emailResult.emails.includes(e)), // AI emails if not already found
      ].filter((e, i, arr) => arr.indexOf(e) === i); // Deduplicate

      const enrichedResponse: EnrichedCandidate = {
        ...candidate,
        linkedInUrl: linkedInResult.linkedInUrl || parsed.linkedInUrl,
        emails: allEmails.slice(0, 5), // Limit to 5 emails
        photoValidated: parsed.photoValidated,
        identityConfidenceScore: Math.max(linkedInResult.confidence, parsed.confidenceScore),
        skills: parsed.skills || candidate.skills || [],
        yearsExperience: typeof parsed.experience === 'number'
          ? parsed.experience
          : (candidate.yearsExperience || 0),
        psychologicalProfile: parsed.psychologicalProfile,
        businessMoment: parsed.businessMoment,
        salesAngle: parsed.salesAngle,
        bottleneck: parsed.bottleneck,
      };

      console.log(`   ✅ Enrichment complete: emails=${enrichedResponse.emails.length}, confidence=${enrichedResponse.identityConfidenceScore.toFixed(2)}`);
      
      return enrichedResponse;
    } catch (error) {
      console.error('Enrichment error:', error);
      // Return candidate with minimal enrichment on error
      return {
        ...candidate,
        emails: [], // Do not hallucinate emails
        photoValidated: false,
        identityConfidenceScore: 0.4,
      };
    }
  }

  private generateEnrichmentPrompt(candidate: ScrapedCandidate, portfolios: { websites: string[]; portfolioContent: string }): string {
    return `Analyze this freelancer profile DEEPLY and extract ONLY VERIFIED information. Do NOT hallucinate data.

=== PERFIL DEL FREELANCER ===
Name: ${candidate.name}
Platform: ${candidate.platform}
Username: ${candidate.platformUsername}
Profile URL: ${candidate.profileUrl}
Title: ${candidate.title}
Job Success Rate: ${candidate.jobSuccessRate}%
Bio: ${candidate.bio}
Hourly Rate: $${candidate.hourlyRate}
Country: ${candidate.country}
Certifications: ${candidate.certifications?.join(', ') || 'None'}

=== PORTFOLIO RESEARCH (from real web search) ===
${portfolios.websites.length > 0 ? `Found portfolios: ${portfolios.websites.join(', ')}` : 'No portfolios found'}
Portfolio content analysis: ${portfolios.portfolioContent}

=== INSTRUCTIONS ===
CRITICAL: You are analyzing a REAL freelancer profile. Your task:
1. Extract ONLY what you can confirm from the bio, title, and certifications
2. DO NOT generate fictional emails (e.g., name@upwork.com)
3. DO NOT invent LinkedIn URLs if you cannot infer them from the name/profile
4. Be conservative with confidence scores - only mark HIGH when data is explicit
5. ALL RESPONSES MUST BE IN 100% SPANISH. No English except JSON field names.

Provide structured analysis in this JSON format ONLY:

{
  "linkedInUrl": "null or inferred LinkedIn URL if possible from name",
  "linkedInId": "null or LinkedIn username/id if inferrable",
  "businessEmails": ["ONLY if explicitly mentioned in bio or portfolio - otherwise empty array"],
  "personalEmails": ["ONLY if verifiable - otherwise empty array"],
  "companyOrPortfolio": "Company name or portfolio URL mentioned in bio or inferred from context",
  "photoValidated": true/false (based on profile completeness and consistency),
  "confidenceScore": 0.0-1.0 (CONSERVATIVE - 0.9+ only if name/title highly specific, <0.5 if generic),
  "skills": ["extracted from title and certifications ONLY - in Spanish"],
  "experience": "number of years inferred from job success rate and profile maturity, null if unknown",
  "psychologicalProfile": "2-3 sentence analysis in Spanish of work style based on bio content",
  "businessMoment": "Current career stage in Spanish (ej: 'Consolidando carrera como developer especializado')",
  "salesAngle": "How to approach them in Spanish - what would motivate them based on profile",
  "bottleneck": "Main challenge limiting their growth based on rate, feedback, or bio hints"
}

Respond ONLY with valid JSON, no markdown or explanation.`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [
          {
            role: 'system',
            content: 'You are a data enrichment specialist. Extract and infer professional information from freelancer profiles. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Low temperature for consistency
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private parseEnrichmentResponse(
    response: string,
    fallback: ScrapedCandidate
  ): {
    linkedInUrl?: string;
    emails: string[];
    companyOrPortfolio?: string;
    photoValidated: boolean;
    confidenceScore: number;
    skills?: string[];
    experience?: string;
    psychologicalProfile?: string;
    businessMoment?: string;
    salesAngle?: string;
    bottleneck?: string;
  } {
    try {
      // Clean up response if wrapped in markdown code blocks
      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);

      return {
        linkedInUrl: parsed.linkedInUrl,
        emails: [
          ...(parsed.businessEmails || []),
          ...(parsed.personalEmails || []),
        ].filter((e: string) => e && this.isValidEmail(e) && !e.includes('upwork.com') && !e.includes('fiverr.com')), // No dummy emails
        companyOrPortfolio: parsed.companyOrPortfolio,
        photoValidated: parsed.photoValidated || false,
        confidenceScore: Math.max(0, Math.min(1, parsed.confidenceScore || 0.5)),
        skills: parsed.skills || [],
        experience: parsed.experience,
        psychologicalProfile: parsed.psychologicalProfile || "Perfil profesional enfocado en ejecución de proyectos en su área técnica.",
        businessMoment: parsed.businessMoment || "Consolidando presencia como talento independiente.",
        salesAngle: parsed.salesAngle || "Destacar la oportunidad de trabajar en proyectos de mayor impacto y rentabilidad.",
        bottleneck: parsed.bottleneck || "Escalabilidad limitada de sus ingresos por la cantidad de horas disponibles.",
      };
    } catch (error) {
      console.warn('Failed to parse OpenAI response:', error);
      return {
        emails: [],
        photoValidated: false,
        confidenceScore: 0.5,
      };
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && !email.includes('undefined');
  }

  async enrichBatch(candidates: ScrapedCandidate[]): Promise<EnrichedCandidate[]> {
    // Process in parallel with OpenAI (rate limiting handled by service)
    const enriched = await Promise.allSettled(
      candidates.map((c) => this.enrichCandidate(c))
    );

    return enriched
      .map((result) => (result.status === 'fulfilled' ? result.value : null))
      .filter((c) => c !== null) as EnrichedCandidate[];
  }
}
