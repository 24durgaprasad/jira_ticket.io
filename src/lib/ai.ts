export interface Epic {
    summary: string;
    description?: string;
    stories?: Story[];
}

export interface Story {
    summary: string;
    description?: string;
}

export interface AIAnalysisResult {
    epics: Epic[];
}

export async function runAIAnalysis(requirementsText: string): Promise<AIAnalysisResult> {
    console.log('--- runAIAnalysis started ---');

    const apiKey = process.env.PERPLEXITY_API_KEY;
    console.log('API Key present:', !!apiKey);
    console.log('API Key first 10 chars:', apiKey?.substring(0, 10) + '...');

    if (!apiKey) {
        throw new Error("Missing PERPLEXITY_API_KEY in environment.");
    }

    const systemPrompt =
        process.env.SYSTEM_PROMPT ||
        "You are a helpful assistant that converts plain requirements into JSON epics and stories.";

    const model = process.env.PERPLEXITY_MODEL || "sonar-pro";
    console.log('Using model:', model);

    const body = {
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: `Here are the raw requirements:\n\n${requirementsText}\n\nReturn only JSON.`,
            },
        ],
    };

    console.log('Request body prepared, requirements length:', requirementsText.length);

    const endpoint = "https://api.perplexity.ai/chat/completions";
    const timeoutMs = Number(process.env.PERPLEXITY_TIMEOUT_MS || 120000); // 120s
    console.log('Timeout set to:', timeoutMs, 'ms');
    console.log('Endpoint:', endpoint);

    try {
        console.log('Making fetch request...');
        const startTime = Date.now();

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            // No timeout - let the request complete naturally
        });

        const elapsed = Date.now() - startTime;
        console.log('Response received in', elapsed, 'ms');
        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response:', errorText);
            throw new Error(
                `Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`
            );
        }

        const data = await response.json();
        console.log('Response data received');

        const text = data?.choices?.[0]?.message?.content;
        console.log('Extracted text length:', text?.length || 0);

        if (!text) {
            throw new Error("Perplexity response missing content.");
        }

        const cleanedText = text
            .replace(/^```[a-zA-Z]*\s*/, "")
            .replace(/```$/, "")
            .trim();

        console.log('Cleaned text:', cleanedText.substring(0, 200) + '...');

        const result = JSON.parse(cleanedText);
        console.log('JSON parsed successfully');

        return result;

    } catch (err: any) {
        console.error("AI Analysis Error:", err);
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);

        // Provide user-friendly error messages
        if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
            throw new Error('AI analysis timed out. The Perplexity API may be slow or unavailable. Please try again.');
        }
        if (err.message?.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection and try again.');
        }

        throw err;
    }
}
