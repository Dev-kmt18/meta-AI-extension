import { LlmSettings, Scene } from '../types';

export interface RawParsedScene {
  sceneNumber?: number;
  scriptExcerpt?: string;
  prompt?: string;
}

export const LlmService = {
  async analyzeScript(scriptText: string, settings: LlmSettings): Promise<Scene[]> {
    if (!settings.apiKey && settings.provider !== 'custom') {
      console.log('[LlmService] No API key set, using local scene generator fallback.');
      return this.generateFallbackScenesFromScript(scriptText);
    }

    const systemPrompt = settings.systemPrompt || `You are an expert film director and AI image prompt engineer.
Analyze the video script and split it into distinct visual scenes.
For each scene, output a detailed, cinematic English image prompt suitable for AI generation (e.g. Meta AI, Midjourney).
Output MUST be a valid JSON array of objects, with keys: "sceneNumber", "scriptExcerpt", and "prompt". Do NOT include markdown text formatting or codeblock ticks around the JSON.`;

    const userPrompt = `Script:\n${scriptText}`;

    let jsonText = '';

    try {
      switch (settings.provider) {
        case 'gemini':
          jsonText = await this.callGemini(scriptText, settings, systemPrompt);
          break;
        case 'openai':
        case 'groq':
        case 'openrouter':
          jsonText = await this.callOpenAICompatible(userPrompt, settings, systemPrompt);
          break;
        case 'claude':
          jsonText = await this.callClaude(userPrompt, settings, systemPrompt);
          break;
        case 'custom':
          jsonText = await this.callCustom(userPrompt, settings, systemPrompt);
          break;
        default:
          jsonText = await this.callGemini(scriptText, settings, systemPrompt);
          break;
      }

      return this.parseScenesFromJson(jsonText, scriptText);
    } catch (err: any) {
      console.warn('API call failed, generating fallback scenes from script:', err);
      // Fallback local scene generator if API fails
      return this.generateFallbackScenesFromScript(scriptText);
    }
  },

  async callGemini(scriptText: string, settings: LlmSettings, systemPrompt: string): Promise<string> {
    // Model fallback sequence
    const modelCandidate = (settings.model && settings.model !== 'gemini-2.5-flash') ? settings.model : 'gemini-1.5-flash';
    const modelsToTry = [modelCandidate, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${systemPrompt}\n\nVideo Script:\n${scriptText}` }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            return candidateText;
          }
        } else {
          const errText = await response.text();
          lastError = new Error(`Gemini API Error (${response.status}): ${errText}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini models failed to generate content.');
  },

  async callOpenAICompatible(userPrompt: string, settings: LlmSettings, systemPrompt: string): Promise<string> {
    let baseUrl = 'https://api.openai.com/v1/chat/completions';
    if (settings.provider === 'groq') {
      baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    } else if (settings.provider === 'openrouter') {
      baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    } else if (settings.customEndpoint) {
      baseUrl = settings.customEndpoint;
    }

    const model = settings.model || (settings.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    };

    if (settings.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://meta.ai';
      headers['X-Title'] = 'Meta AI Scene Generator';
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  },

  async callClaude(userPrompt: string, settings: LlmSettings, systemPrompt: string): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages';
    const model = settings.model || 'claude-3-5-haiku-20241022';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  },

  async callCustom(userPrompt: string, settings: LlmSettings, systemPrompt: string): Promise<string> {
    if (!settings.customEndpoint) {
      throw new Error('Custom endpoint URL is required for custom provider.');
    }

    const response = await fetch(settings.customEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: settings.model,
        systemPrompt,
        prompt: userPrompt
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Custom API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    if (data.response) return data.response;
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    return JSON.stringify(data);
  },

  parseScenesFromJson(rawJsonString: string, originalScript: string): Scene[] {
    let cleanJson = rawJsonString.trim();
    
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    try {
      let parsed = JSON.parse(cleanJson);

      if (!Array.isArray(parsed) && typeof parsed === 'object') {
        const keys = Object.keys(parsed);
        for (const k of keys) {
          if (Array.isArray(parsed[k])) {
            parsed = parsed[k];
            break;
          }
        }
      }

      if (!Array.isArray(parsed)) {
        throw new Error('Parsed result is not an array of scenes.');
      }

      return parsed.map((item: RawParsedScene, index: number) => ({
        id: `scene-${Date.now()}-${index}`,
        sceneNumber: item.sceneNumber || index + 1,
        scriptExcerpt: item.scriptExcerpt || `Scene ${index + 1}`,
        prompt: item.prompt || item.scriptExcerpt || `Cinematic visual scene ${index + 1}`,
        status: 'pending',
        selected: true
      }));

    } catch (e: any) {
      return this.generateFallbackScenesFromScript(originalScript);
    }
  },

  generateFallbackScenesFromScript(scriptText: string): Scene[] {
    // Split script by sentences or paragraphs into scenes
    const lines = scriptText
      .split(/\n+|\. /)
      .map((l) => l.trim())
      .filter((l) => l.length > 5);

    if (lines.length === 0) {
      return [
        {
          id: `scene-${Date.now()}-0`,
          sceneNumber: 1,
          scriptExcerpt: scriptText.slice(0, 100),
          prompt: `Cinematic photorealistic 8k highly detailed visual representation of: ${scriptText.slice(0, 200)}`,
          status: 'pending',
          selected: true
        }
      ];
    }

    return lines.map((line, index) => ({
      id: `scene-${Date.now()}-${index}`,
      sceneNumber: index + 1,
      scriptExcerpt: line,
      prompt: `Cinematic photorealistic 8k highly detailed visual scene showing: ${line}`,
      status: 'pending',
      selected: true
    }));
  }
};
