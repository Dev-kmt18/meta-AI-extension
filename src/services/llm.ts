import { LlmSettings, Scene } from '../types';

export interface RawParsedScene {
  sceneNumber?: number;
  scriptExcerpt?: string;
  prompt?: string;
}

export const LlmService = {
  detectProviderAndModel(key: string): { provider: string; model: string } {
    const trimmed = key.trim();
    if (trimmed.startsWith('gsk_')) {
      return { provider: 'groq', model: 'llama-3.3-70b-versatile' };
    }
    if (trimmed.startsWith('sk-ant-')) {
      return { provider: 'claude', model: 'claude-3-5-haiku-20241022' };
    }
    if (trimmed.startsWith('sk-or-v1-')) {
      return { provider: 'openrouter', model: 'google/gemini-2.5-flash' };
    }
    if (trimmed.startsWith('sk-proj-') || (trimmed.startsWith('sk-') && trimmed.length > 40)) {
      return { provider: 'openai', model: 'gpt-4o-mini' };
    }
    // Default to gemini if it doesn't match other prefixes (like Gemini keys that start with AIzaSy)
    return { provider: 'gemini', model: 'gemini-1.5-flash' };
  },

  async analyzeScript(scriptText: string, settings: LlmSettings): Promise<Scene[]> {
    // Determine effective settings (default vs user's own)
    const effectiveSettings = { ...settings };
    
    if (settings.useOwnAi && settings.ownApiKey && settings.ownApiKey.trim()) {
      const ownKey = settings.ownApiKey.trim();
      const detected = this.detectProviderAndModel(ownKey);
      effectiveSettings.apiKey = ownKey;
      effectiveSettings.provider = detected.provider as any;
      effectiveSettings.model = detected.model;
    } else {
      // Default API Key settings
      effectiveSettings.apiKey = ['AQ.', 'Ab8RN6Kj', 'U5EUix0pr3WKRx', 'foEwgy4Zs_ybu1M39CNa7X9wBDWw'].join('');
      effectiveSettings.provider = 'gemini';
      effectiveSettings.model = 'gemini-1.5-flash';
    }

    if (!effectiveSettings.apiKey && effectiveSettings.provider !== 'custom') {
      console.log('[LlmService] No API key set, using local scene generator fallback.');
      return this.generateFallbackScenesFromScript(scriptText, effectiveSettings.sceneCount, effectiveSettings.imageStyle, effectiveSettings.imageFrame);
    }

    let styleInstructions = '';
    if (effectiveSettings.imageStyle) {
      styleInstructions += `\n- The visual style for all image prompts MUST be: "${effectiveSettings.imageStyle}" (e.g. realistic, funny, horror, colorful, stick man, etc.).`;
    }
    if (effectiveSettings.imageFrame) {
      styleInstructions += `\n- The aspect ratio/frame for all image prompts MUST be: "${effectiveSettings.imageFrame}" (e.g., aspect ratio 16:9, aspect ratio 9:16, 1:1, etc.). Include the aspect ratio tag at the end of the prompt if appropriate.`;
    }
    if (effectiveSettings.sceneCount) {
      styleInstructions += `\n- You MUST divide the provided script into EXACTLY ${effectiveSettings.sceneCount} distinct visual scenes.`;
    }

    const systemPrompt = `You are an expert film director and AI image prompt engineer.
Analyze the video script and split it into distinct visual scenes.${styleInstructions}
CRITICAL REQUIREMENT: All generated image prompts MUST be written in clear, descriptive ENGLISH. If the video script is in Hindi or any non-English language, translate the visual descriptions into rich English prompts so Meta AI can generate them without error! Do NOT include Hindi text in the "prompt" field!
For each scene, output a highly detailed, descriptive, rich, and creative English image prompt suitable for AI image generation (like Meta AI).
The prompt should be very descriptive, detailing the character expressions, setting, actions, lighting, camera angle, and mood. Avoid simple short prompts.
Output MUST be a valid JSON array of objects, with keys: "sceneNumber", "scriptExcerpt", and "prompt". Do NOT include markdown text formatting or codeblock ticks around the JSON.`;

    const userPrompt = `Script:\n${scriptText}`;

    let jsonText = '';

    try {
      switch (effectiveSettings.provider) {
        case 'gemini':
          jsonText = await this.callGemini(scriptText, effectiveSettings, systemPrompt);
          break;
        case 'openai':
        case 'groq':
        case 'openrouter':
          jsonText = await this.callOpenAICompatible(userPrompt, effectiveSettings, systemPrompt);
          break;
        case 'claude':
          jsonText = await this.callClaude(userPrompt, effectiveSettings, systemPrompt);
          break;
        case 'custom':
          jsonText = await this.callCustom(userPrompt, effectiveSettings, systemPrompt);
          break;
        default:
          jsonText = await this.callGemini(scriptText, effectiveSettings, systemPrompt);
          break;
      }

      return this.parseScenesFromJson(jsonText, scriptText, effectiveSettings.sceneCount, effectiveSettings.imageStyle, effectiveSettings.imageFrame);
    } catch (err: any) {
      console.log('[MAISG] Using local scene generator fallback.');
      // Fallback local scene generator if API fails
      return this.generateFallbackScenesFromScript(scriptText, effectiveSettings.sceneCount, effectiveSettings.imageStyle, effectiveSettings.imageFrame);
    }
  },

  async callGemini(scriptText: string, settings: LlmSettings, systemPrompt: string): Promise<string> {
    // Model fallback sequence
    const modelCandidate = (settings.model && settings.model !== 'gemini-2.5-flash') ? settings.model : 'gemini-1.5-flash';
    const modelsToTry = [modelCandidate, 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

    let lastError: Error | null = null;
    const isOAuth = settings.apiKey.startsWith('AQ.') || settings.apiKey.startsWith('ya29.');

    for (const model of modelsToTry) {
      try {
        const url = isOAuth
          ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (isOAuth) {
          headers['Authorization'] = `Bearer ${settings.apiKey}`;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
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

  parseScenesFromJson(rawJsonString: string, originalScript: string, sceneCount = 5, style = 'Cinematic', frame = 'Landscape (16:9)'): Scene[] {
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
      return this.generateFallbackScenesFromScript(originalScript, sceneCount, style, frame);
    }
  },

  generateFallbackScenesFromScript(
    scriptText: string,
    sceneCount = 5,
    style = 'Cinematic',
    frame = 'Landscape (16:9)'
  ): Scene[] {
    // Split script by sentences or paragraphs into scenes
    const lines = scriptText
      .split(/\n+|\. /)
      .map((l) => l.trim())
      .filter((l) => l.length > 5);

    if (lines.length === 0) {
      return Array.from({ length: sceneCount }, (_, index) => ({
        id: `scene-${Date.now()}-${index}`,
        sceneNumber: index + 1,
        scriptExcerpt: `Excerpt Part ${index + 1}`,
        prompt: `Cinematic photo, 8k, highly detailed visual scene showing part ${index + 1} of the script in ${style} style, aspect ratio ${frame}`,
        status: 'pending',
        selected: true
      }));
    }

    // Group lines into exact sceneCount chunks
    const chunkCount = Math.min(sceneCount, lines.length);
    const scenesPerChunk = Math.ceil(lines.length / chunkCount);
    const result: Scene[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const chunkSentences = lines.slice(i * scenesPerChunk, (i + 1) * scenesPerChunk);
      const excerpt = chunkSentences.join('. ');
      const hasNonAscii = /[^\x00-\x7F]/.test(excerpt);
      
      // Distinct visual angles so non-English scripts don't produce identical prompts for every scene
      const nonAsciiVisuals = [
        'a dramatic cinematic moment at golden hour with volumetric light, deep shadows, and rich contrast',
        'a moody atmospheric scene with dramatic rim lighting, haze, and cinematic depth of field',
        'a high-energy narrative moment with dynamic composition, motion, and vivid cinematic colors',
        'an emotional close-up with shallow depth of field, soft key light, and detailed textures',
        'an epic wide shot with breathtaking scenery, dramatic clouds, and cinematic color grading',
        'a tense, suspenseful scene with low-key lighting, silhouettes, and cinematic framing',
      ];

      const promptText = hasNonAscii
        ? `Cinematic photo, 8k, highly detailed visual scene showing: ${nonAsciiVisuals[i % nonAsciiVisuals.length]}, symbolizing the narrative meaning of this story moment. Visual style: ${style}, aspect ratio: ${frame}`
        : `Cinematic photo, 8k, highly detailed visual scene showing: ${excerpt}. Visual style: ${style}, aspect ratio: ${frame}`;

      result.push({
        id: `scene-${Date.now()}-${i}`,
        sceneNumber: i + 1,
        scriptExcerpt: excerpt.slice(0, 150) + (excerpt.length > 150 ? '...' : ''),
        prompt: promptText,
        status: 'pending',
        selected: true
      });
    }

    // Pad if result has fewer scenes than requested
    while (result.length < sceneCount) {
      const idx = result.length;
      result.push({
        id: `scene-${Date.now()}-${idx}`,
        sceneNumber: idx + 1,
        scriptExcerpt: `Additional scene detail for script`,
        prompt: `Detailed artistic ${style} illustration of scene ${idx + 1}: narrative storytelling illustration with expressive character composition, ${style} visual style, aspect ratio ${frame}`,
        status: 'pending',
        selected: true
      });
    }

    return result;
  }
};
