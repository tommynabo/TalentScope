
import OpenAI from 'openai';

const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!openaiApiKey) {
    console.warn('Missing OpenAI API Key. Symmetry Score will verify as 0.');
}

const openai = new OpenAI({
    apiKey: openaiApiKey,
    dangerouslyAllowBrowser: true // Client-side execution for now
});

export const calculateSymmetryScore = async (profileText: string): Promise<{ score: number; analysis: string }> => {
    if (!openaiApiKey) return { score: 0, analysis: 'No API Key' };

    try {
        const prompt = `
      You are an ELITE Tech Recruiter for Symmetry. Your mission is QUALITY OVER VOLUME.
      Assign a "Symmetry Score" from 0 to 100. Only scores >= 80 are considered qualified.

      === SYMMETRY PRODUCT ENGINEER PROFILE ===
      Target: 3–8 years of real production experience. Full-stack Product Engineers who
      understand product, users AND business — not merely code executors.

      ✅ GREEN FLAGS (add points — ideal signals):
      - Ownership over features/products and mentioning metrics or business impact (+25 pts)
      - Core stack: React/Next.js, Node.js, TypeScript, REST APIs (+25 pts)
      - Built COMPLETE end-to-end applications (frontend + backend + deploy) (+20 pts)
      - Startup, early-stage, or freelance/agile environment experience (+15 pts)
      - Uses AI tools (ChatGPT, Claude, Cursor, Copilot) to amplify work (+10 pts)
      - Mobile (React Native or Flutter) or cloud infra (AWS/GCP/CI-CD) as bonus (+5 pts)

      🚫 RED FLAGS — AUTO-FAIL (score MUST be < 40 if any apply):
      - Only bootcamp/online course certifications with ZERO real production projects
      - Experience limited to very narrow tasks with no global product context
      - No evidence of understanding business impact or user metrics
      - Passive attitude: only executes tasks, no initiative, no ownership
      - No shipped products, no applications used by real users

      Profile Text:
      "${profileText}"

      Return ONLY a JSON object with:
      {
        "score": number,
        "analysis": "Brief explanation of the score"
      }
    `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "You are an expert tech recruiter." }, { role: "user", content: prompt }],
            model: "gpt-4-turbo",
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');
        return {
            score: result.score || 0,
            analysis: result.analysis || 'Analysis failed'
        };

    } catch (error) {
        console.error('OpenAI Error:', error);
        return { score: 0, analysis: 'Error calculating score' };
    }
};

export const generateCandidateAnalysis = async (profileData: any): Promise<any> => {
    if (!openaiApiKey) return null;

    try {
        const prompt = `
            You are an elite technical recruiter and psychologist. Analyze this GitHub candidate:

            Name: ${profileData.name || profileData.username}
            Bio: ${profileData.bio || 'N/A'}
            Top Languages: ${profileData.languages?.join(', ') || 'N/A'}
            Repos: ${profileData.topRepos?.map((r: any) => r.name + ': ' + r.description).join('; ') || 'N/A'}
            
            Generate a deep psychometric and technical analysis for a "Ver" modal dashboard.
            
            IMPORTANT:
            - All output must be in SPANISH (Español).
            - Ensure ALL sentences are grammatically COMPLETE. Do not cut off sentences.
            - Be professional, sharp, and insightful.
            - Outreach messages must be PERSONALIZED and SHORT (max 1-2 sentences each).
            
            Return PRECISELY this JSON structure:
            {
                "analysis_psychological": "1-2 complete sentences on work style/cognition.",
                "analysis_business": "1 complete sentence on career momentum.",
                "analysis_sales_angle": "1 complete sentence hook.",
                "analysis_bottleneck": "1 complete sentence on potential rejection reason.",
                "outreach_icebreaker": "A hyper-personalized opening message referencing specific projects or skills. Start with 'Hola [name],' or similar. Max 2 sentences.",
                "outreach_pitch": "A value proposition pitch explaining why this opportunity fits THEM. EXACTLY use this template: 'Gracias por aceptar [Nombre]. Estamos escalando Symmetry, una app de salud y bienestar con mucha tracción (+400k descargas/mes) y equipo de producto pequeño. Buscamos product engineers en [stack específico del perfil, ej: React/Node.js o Next.js/TypeScript]. ¿Te interesa que te pase el brief técnico?'",
                "outreach_followup": "A soft follow-up message saying you wanted to touch base about opportunity. Max 1 sentence.",
                "ai_summary": ["Bullet 1 (Strength)", "Bullet 2 (Achievement)", "Bullet 3 (Risk/Oddity)"]
            }
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are an ELITE recruitment intelligence engine for Symmetry — a health & wellness app (400k+ monthly downloads). We hire Product Engineers (3–8 yrs exp) who build end-to-end: React/Next.js, Node.js, TypeScript, REST APIs. They must understand product impact and business metrics, not just write code. Penalize heavily: only certifications, no production projects, narrow specialists with no business context. Be concise, sharp, and insightful." },
                { role: "user", content: prompt }
            ],
            model: "gpt-4-turbo",
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
        console.error('OpenAI Analysis Error:', error);
        return null;
    }
};
