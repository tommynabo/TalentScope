import { ScrapedCandidate, EnrichedCandidate } from '../types/marketplace';

export class AIEnrichmentService {
  private openaiApiKey: string;
  private modelId: string = 'gpt-4o-mini'; // Usa mini para mejor precio

  constructor(openaiApiKey: string) {
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.openaiApiKey = openaiApiKey;
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
      // Generate enrichment prompt
      const enrichmentPrompt = this.generateEnrichmentPrompt(candidate);

      // Call OpenAI to extract/infer information
      const enrichedData = await this.callOpenAI(enrichmentPrompt);

      // Parse OpenAI response
      const parsed = this.parseEnrichmentResponse(enrichedData, candidate);

      return {
        ...candidate,
        linkedInUrl: parsed.linkedInUrl,
        emails: parsed.emails,
        photoValidated: parsed.photoValidated,
        identityConfidenceScore: parsed.confidenceScore,
        skills: parsed.skills,
        experience: parsed.experience,
      };
    } catch (error) {
      console.error('Enrichment error:', error);
      // Return candidate with minimal enrichment on error
      return {
        ...candidate,
        emails: this.generatePlausibleEmails(candidate),
        photoValidated: false,
        identityConfidenceScore: 0.4,
      };
    }
  }

  private generateEnrichmentPrompt(candidate: ScrapedCandidate): string {
    return `Analyze this freelancer profile data and extract structured information:

Profile Name: ${candidate.name}
Platform: ${candidate.platform}
Username: ${candidate.platformUsername}
Title: ${candidate.title}
Rating: ${candidate.rating}
Reviews: ${candidate.reviewsCount}
Bio: ${candidate.bio}
Hourly Rate: ${candidate.hourlyRate}
Skills: ${candidate.skills}

Please provide:
1. Probable LinkedIn profile URL or ID
2. Plausible business emails (format: {firstname}.{lastname}@domain.com or firstname@company.com)
3. Assessment of photo validation (true/false - does the profile look legit?)
4. Confidence score (0-1) of identity verification
5. Extracted core skills and specializations
6. Years of experience if detectable

Respond ONLY as valid JSON, no markdown:
{
  "linkedInUrl": "string or null",
  "linkedInId": "string or null",
  "businessEmails": ["email1", "email2"],
  "personalEmails": ["personal_email"],
  "photoValidated": boolean,
  "confidenceScore": number,
  "skills": ["skill1", "skill2"],
  "experience": "XYZ years or null",
  "notes": "brief assessment"
}`;
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
    photoValidated: boolean;
    confidenceScore: number;
    skills?: string[];
    experience?: string;
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
        ].filter((e: string) => e && this.isValidEmail(e)),
        photoValidated: parsed.photoValidated || false,
        confidenceScore: Math.max(0, Math.min(1, parsed.confidenceScore || 0.5)),
        skills: parsed.skills || fallback.skills,
        experience: parsed.experience,
      };
    } catch (error) {
      console.warn('Failed to parse OpenAI response:', error);
      return {
        emails: this.generatePlausibleEmails(fallback),
        photoValidated: false,
        confidenceScore: 0.5,
      };
    }
  }

  private generatePlausibleEmails(candidate: ScrapedCandidate): string[] {
    // Generate plausible emails based on name/username
    const nameParts = candidate.name.toLowerCase().split(' ');
    const firstName = nameParts[0] || candidate.platformUsername;
    const lastName = nameParts[1] || '';
    const username = candidate.platformUsername.toLowerCase();

    const domains = [
      'gmail.com',
      'outlook.com',
      'yahoo.com',
      'protonmail.com',
      'work.com',
    ];

    const emails = [
      `${firstName}.${lastName}@${domains[0]}`.replace(/\.@/, '@'),
      `${username}@${domains[1]}`,
      `${firstName}@${domains[2]}`,
    ].filter((e) => this.isValidEmail(e));

    return [...new Set(emails)]; // Remove duplicates
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
