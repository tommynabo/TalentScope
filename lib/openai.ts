
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
