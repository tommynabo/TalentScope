import { ScrapedCandidate, EnrichedCandidate } from '../types/marketplace';

export class AIEnrichmentService {
  private openaiApiKey: string;
  private apifyApiKey: string;
  private modelId: string = 'gpt-4o-mini'; // Usa mini para mejor precio

  constructor(openaiApiKey: string, apifyApiKey: string = import.meta.env.VITE_APIFY_API_KEY) {
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.openaiApiKey = openaiApiKey;
    this.apifyApiKey = apifyApiKey;
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

      const enrichedResponse: EnrichedCandidate = {
        ...candidate,
        linkedInUrl: parsed.linkedInUrl,
        emails: parsed.emails,
        photoValidated: parsed.photoValidated,
        identityConfidenceScore: parsed.confidenceScore,
        skills: parsed.skills || candidate.skills || [],
        yearsExperience: typeof parsed.experience === 'number'
          ? parsed.experience
          : (candidate.yearsExperience || 0),
        psychologicalProfile: parsed.psychologicalProfile,
        businessMoment: parsed.businessMoment,
        salesAngle: parsed.salesAngle,
        bottleneck: parsed.bottleneck,
      };

      // Intentar buscar email y LinkedIn reales con Apify si tenemos algo útil del perfil (opcional)
      const realEmail = await this.findRealEmail(enrichedResponse, parsed.companyOrPortfolio);
      if (realEmail) {
        enrichedResponse.emails.push(realEmail);
      }

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

  private generateEnrichmentPrompt(candidate: ScrapedCandidate): string {
    return `Analyze this freelancer profile data and extract structured information.
CRÍTICO: TU LENGUAJE DOMINANTE DEBE SER 100% ESPAÑOL. TODAS TUS RESPUESTAS, ANÁLISIS Y TEXTOS DEBEN ESTAR EN ESPAÑOL Y SOLO ESPAÑOL.

Profile Name: ${candidate.name}
Platform: ${candidate.platform}
Username: ${candidate.platformUsername}
Title: ${candidate.title}
Job Success Rate: ${candidate.jobSuccessRate}%
Bio: ${candidate.bio}
Hourly Rate: $${candidate.hourlyRate}
Country: ${candidate.country}
Certifications: ${candidate.certifications?.join(', ') || 'None'}

Please provide:
1. Probable LinkedIn profile URL or ID (infer from name and profile)
2. Plausible business/professional emails (format: firstname.lastname@domain or firstname@company)
3. Assessment of profile legitimacy (true/false)
4. Confidence score (0-1) of identity verification
5. Core skills and specializations based on title and certifications (En Español)
6. Estimated years of experience based on success rate
7. Perfil Psicológico: Breve análisis de su personalidad y mentalidad laboral basado en cómo se presenta en su bio y título. (En Español)
8. Momento Empresarial: En qué etapa de su carrera/negocio se encuentra (ej: empezando, escalando, experto consolidado). (En Español)
9. Ángulo de Venta: Cuál es el mejor enfoque persuasivo para venderle una oportunidad o colaboración. (En Español)
10. Cuello de Botella: Su principal desafío actual según su perfil (ej: falta de tiempo por exceso de trabajo, tarifas bajas, falta de posicionamiento). (En Español)
11. Empresa Actual o Portfolio: Extrae el nombre de la empresa donde trabaja, su marca personal o la URL de su portfolio si lo menciona. (Si no hay, pon null).

Respond ONLY as valid JSON, no markdown:
{
  "linkedInUrl": "string or null",
  "linkedInId": "string or null",
  "businessEmails": ["email1@domain.com", "email2@domain.com"],
  "personalEmails": ["personal@email.com"],
  "companyOrPortfolio": "string or null",
  "photoValidated": boolean,
  "confidenceScore": number,
  "skills": ["skill1", "skill2", "skill3"],
  "experience": "X años or null",
  "psychologicalProfile": "string",
  "businessMoment": "string",
  "salesAngle": "string",
  "bottleneck": "string"
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

  private async findRealEmail(candidate: ScrapedCandidate, companyOrPortfolio: string | null | undefined): Promise<string | null> {
    if (!this.apifyApiKey) return null;

    try {
      let searchQuery = `"${candidate.name}" email OR contacto`;
      if (companyOrPortfolio && companyOrPortfolio !== 'null') {
        searchQuery = `"${candidate.name}" "${companyOrPortfolio}" email OR contacto`;
      } else if (candidate.platform === 'Upwork' || candidate.platform === 'Fiverr') {
        // For platforms like Upwork/Fiverr, try to find their personal site or company
        searchQuery = `"${candidate.name}" freelance portfolio email OR contacto`;
      }

      const input = {
        queries: searchQuery,
        resultsPerPage: 10,
        maxPagesPerQuery: 1,
        languageCode: "es", // Enforce Spanish language for Better Local Results
        mobileResults: false,
        includeUnfilteredResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false
      };

      const response = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${this.apifyApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!response.ok) return null;
      const runData = await response.json();
      const runId = runData.data.id;

      // Poll for completion
      let isRunning = true;
      while (isRunning) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${this.apifyApiKey}`);
        const statusData = await statusRes.json();
        if (statusData.data.status !== 'RUNNING' && statusData.data.status !== 'READY') {
          isRunning = false;
        }
      }

      // Fetch dataset
      const resultRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${this.apifyApiKey}`);
      const dataset = await resultRes.json();

      if (!dataset || !dataset.length) return null;

      for (const result of dataset) {
        if (!result.organicResults) continue;

        for (const item of result.organicResults) {
          if (item.url && item.url.includes('linkedin.com')) continue; // usually private without auth

          if (item.description) {
            const emailMatch = item.description.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
            if (emailMatch && emailMatch.length > 0) {
              const validEmails = emailMatch.filter((e: string) => this.isValidEmail(e) && !e.includes('upwork.com') && !e.includes('fiverr.com'));
              if (validEmails.length > 0) return validEmails[0];
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding real email with Apify:', error);
      return null;
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
