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
      console.log(`   🔍 Running deep profile analysis with AI...`);
      const enrichmentPrompt = this.generateEnrichmentPrompt(candidate, portfoliosResult);
      const enrichedData = await this.callOpenAI(enrichmentPrompt);
      const parsed = this.parseEnrichmentResponse(enrichedData, candidate);

      // Log extracted analysis
      if (parsed.psychologicalProfile) {
        console.log(`   👤 Psychological: ${parsed.psychologicalProfile.substring(0, 80)}...`);
      }
      if (parsed.businessMoment) {
        console.log(`   📈 Business Moment: ${parsed.businessMoment.substring(0, 80)}...`);
      }
      if (parsed.bottleneck) {
        console.log(`   ⚠️  Bottleneck: ${parsed.bottleneck.substring(0, 80)}...`);
      }
      if (parsed.salesAngle) {
        console.log(`   🎯 Sales Angle: ${parsed.salesAngle.substring(0, 80)}...`);
      }

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
    return `You are an expert recruiter and talent analyst. Analyze this freelancer profile DEEPLY and provide REAL, DATA-DRIVEN insights.

════════════════════════════════════════════════════════════════════════
📋 UPWORK PROFILE DATA
════════════════════════════════════════════════════════════════════════
Name: ${candidate.name}
Title: ${candidate.title}
Hourly Rate: $${candidate.hourlyRate}/h
Job Success Rate: ${candidate.jobSuccessRate}%
Country: ${candidate.country}
Profile URL: ${candidate.profileUrl}
Bio/Description: "${candidate.bio}"
Certifications: ${candidate.certifications?.join(', ') || 'None listed'}

════════════════════════════════════════════════════════════════════════
🌐 PORTFOLIO & ONLINE PRESENCE
════════════════════════════════════════════════════════════════════════
Portfolios Found: ${portfolios.websites.length > 0 ? portfolios.websites.join(', ') : 'No portfolios found'}
Portfolio Analysis: ${portfolios.portfolioContent}

════════════════════════════════════════════════════════════════════════
🔍 YOUR ANALYSIS TASK - DEEP PROFESSIONAL INSIGHTS
════════════════════════════════════════════════════════════════════════

Analyze EACH section below systematically. Extract REAL insights, not generic statements.

### 1. PROFESSIONAL PROFILE ANALYSIS
- What is their actual specialization? (From title, bio, certifications)
- What is their POSITIONING in the market? (Premium? Budget? Specialist?)
- Are they generalist or specialist? (Evidence?)
- How specialized are their skills? What makes them unique?

### 2. EXPERIENCE & CAREER STAGE
- Based on Job Success Rate (${candidate.jobSuccessRate}%): Are they established or struggling?
  * 90%+ = Well-established, consistent quality
  * 80-90% = Developing track record
  * 70-80% = Learning, variable quality
  * <70% = Early stage or quality issues
- How many years of experience? (Infer from consistency, rate positioning)
- Career trajectory: Are they growing, stable, or declining?

### 3. PSYCHOLOGICAL & WORK STYLE
- Work Mentality: Do they seem eager to learn? Confident? Defensive?
- Communication: Professional tone in bio? Clear or vague?
- Motivation: What drives them? Money? Mastery? Impact?
- Risk Profile: Do they play it safe or take on challenging projects?
- Reliability: What does Job Success Rate tell you about their consistency?

### 4. BUSINESS POSITIONING & MOMENT
- Career Stage: Are they starting, scaling, consolidating, or plateauing?
- What's their business strategy? (Low price/high volume? Premium/selective?)
- Are they "desperate for work" or "selective about clients"? (Infer from rate + success rate)
- Growth trajectory: Are they hiring more clients, less? Specializing or broadening?

### 5. REAL MOTIVATIONS & BOTTLENECKS
- What's ACTUALLY limiting their growth?
  * Too expensive for market? (Rate too high)
  * Not expensive enough? (Undervalued)
  * Limited time? (Fully booked?)
  * Skill gaps? (Struggling with certain tech?)
  * Positioning issues? (Generic title)
  * Geographic limitations? (Timezone, language?)
  * Confidence/pipeline? (Inconsistent jobs?)
- What would motivate THEM specifically?

### 6. SALES ANGLE - HOW TO APPROACH
Think about their actual situation, NOT generic advice:
- If they're desperate: Offer quick cash, flexibility
- If they're selective: Offer interesting projects, growth, impact
- If they're strategic: Offer long-term relationships, retainers
- If they're struggling: Offer mentorship, steady income
- If they're premium: Offer premium clients, exclusivity

════════════════════════════════════════════════════════════════════════
📝 RESPONSE FORMAT - JSON ONLY
════════════════════════════════════════════════════════════════════════

Respond ONLY with valid JSON (no markdown, no explanations). Every field must be:
✓ Data-driven (based on profile data)
✓ Specific (not generic)
✓ In Spanish (100%)
✓ Actionable (can be used immediately)

{
  "linkedInUrl": null,
  "linkedInId": null,
  "businessEmails": [],
  "personalEmails": [],
  "companyOrPortfolio": null,
  "photoValidated": false,
  "confidenceScore": 0.5,
  
  "skills": ["skill1", "skill2"],
  "experience": 5,
  
  "psychologicalProfile": "PERSON: Desarrollador muy [trait1] y [trait2]. STYLE: [how they work]. MOTIVATION: [what drives them]. RELIABILITY: [consistency indicator based on JSR]. COMMUNICATION: [professional tone assessment].",
  
  "businessMoment": "STAGE: [starting/scaling/consolidating/plateauing]. STRATEGY: [their market strategy]. POSITIONING: [premium/mid/budget]. TRAJECTORY: [growing/stable/struggling] because [specific reason].",
  
  "salesAngle": "APPROACH: [specific tactic based on their situation]. VALUE PROP: [what would genuinely motivate them]. POSITIONING: [how to frame opportunity]. URGENCY: [why now is good timing for them].",
  
  "bottleneck": "PRIMARY: [main limiting factor with evidence]. SECONDARY: [if applicable]. IMPACT: [how it's limiting growth]. FIXABLE: [yes/no and how]."
}

════════════════════════════════════════════════════════════════════════
⚡ CRITICAL RULES
════════════════════════════════════════════════════════════════════════
✓ Use ACTUAL numbers and data from the profile
✓ Be SPECIFIC - avoid "hard worker", use evidence instead
✓ Be REALISTIC - this person is real, not a stereotype
✓ Link claims to data - if you say they're struggling, cite JSR or rate
✓ Think like a recruiter - what's ACTUALLY useful here?
✗ NO generic profiles like "Excellent developer, hard working"
✗ NO hallucinated data
✗ NO generic motivations - be specific to THIS person
✗ NO vague analyses - every statement must be backed by profile data
✗ NO English - 100% SPANISH in all text fields

START YOUR ANALYSIS NOW:`;
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
            content: `You are an elite professional talent analyst and recruiter with 20+ years of experience.
Your task is to analyze freelancer profiles and extract DEEP, ACTIONABLE insights based on real data.

KEY PRINCIPLES:
- Be specific, not generic. Every statement must be backed by profile data.
- Think like a strategic recruiter. What would actually help land this person?
- Be realistic. This is a real person, not a stereotype.
- Analyze motivations, bottlenecks, and positioning based on ACTUAL numbers.
- Provide insights that reveal the person's true situation and needs.

CRITICAL: Respond ONLY with valid JSON. NO markdown, NO explanations, NO preamble.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7, // More creative analysis while staying grounded
        max_tokens: 1200, // More space for detailed analysis
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

      // Extract experience as number if it's a number, otherwise try to parse
      let experienceValue: string | undefined = undefined;
      if (parsed.experience !== null && parsed.experience !== undefined) {
        if (typeof parsed.experience === 'number') {
          experienceValue = parsed.experience.toString();
        } else if (typeof parsed.experience === 'string') {
          experienceValue = parsed.experience;
        }
      }

      return {
        linkedInUrl: parsed.linkedInUrl || undefined,
        emails: [
          ...(parsed.businessEmails || []),
          ...(parsed.personalEmails || []),
        ].filter((e: string) => e && this.isValidEmail(e) && !e.includes('upwork.com') && !e.includes('fiverr.com')),
        companyOrPortfolio: parsed.companyOrPortfolio || undefined,
        photoValidated: parsed.photoValidated || false,
        confidenceScore: Math.max(0, Math.min(1, parsed.confidenceScore || 0.5)),
        skills: parsed.skills && Array.isArray(parsed.skills) ? parsed.skills : [],
        experience: experienceValue,
        // Deep analysis fields - these SHOULD be detailed now, not generic
        psychologicalProfile: parsed.psychologicalProfile || undefined,
        businessMoment: parsed.businessMoment || undefined,
        salesAngle: parsed.salesAngle || undefined,
        bottleneck: parsed.bottleneck || undefined,
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
