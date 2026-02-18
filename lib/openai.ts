
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
      Analyze the following candidate profile text and assign a "Symmetry Score" from 0 to 100 based on fit for a high-value "A-Player" role (Top Developer/Founder).

      Criteria:
      - Startup Experience (+20 pts)
      - Founder / Co-founder Role (+30 pts)
      - Published Apps / Side Projects (+25 pts)
      - Flutter / Dart Stack Expertise (+25 pts)

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
            
            Return PRECISELY this JSON structure:
            {
                "analysis_psychological": "1-2 complete sentences on work style/cognition.",
                "analysis_business": "1 complete sentence on career momentum.",
                "analysis_sales_angle": "1 complete sentence hook.",
                "analysis_bottleneck": "1 complete sentence on potential rejection reason.",
                "outreach_icebreaker": "A hyper-personalized 1-sentence opening message referencing specific repos.",
                "outreach_pitch": "A 1-sentence value proposition.",
                "ai_summary": ["Bullet 1 (Strength)", "Bullet 2 (Achievement)", "Bullet 3 (Risk/Oddity)"]
            }
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a recruitment intelligence engine. Be concise, sharp, and insightful. Avoid corporate jargon." },
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
