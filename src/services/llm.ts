import { LlmSettings, Scene } from '../types';

export interface RawParsedScene {
  sceneNumber?: number;
  scriptExcerpt?: string;
  prompt?: string;
}

export const STYLE_PROMPT_MAP: Record<string, string> = {
  'Photorealistic / 8K': 'photorealistic, 8k uhd, shot on 85mm lens, natural skin texture, volumetric natural lighting, sharp focus, cinematic depth of field',
  '3D Pixar / Disney': '3D Disney Pixar animation style, cute expressive features, octane render, smooth textures, warm soft lighting',
  'Japanese Anime / Ghibli': 'Studio Ghibli style, Hayao Miyazaki aesthetic, soft anime visual, hand-painted background, cel shading, cozy atmosphere',
  'Vintage Comic Book': 'vintage 1960s comic book panel, bold ink outlines, halftone Ben-Day dots, retro pop art',
  'Cyberpunk / Sci-Fi': 'cyberpunk aesthetic, glowing purple and cyan neon lights, rainy street reflections, volumetric fog, futuristic dystopia',
  'Soft Watercolor Painting': 'soft watercolor painting, pastel color wash, bleeding ink edges, textured watercolor paper',
  'Classic Renaissance Oil Painting': '16th century Renaissance oil painting, Rembrandt chiaroscuro lighting, thick impasto brushstrokes, canvas texture',
  'Retro 16-Bit Pixel Art': '16-bit pixel art, isometric view, retro SNES game sprite, limited vibrant palette',
  'Claymation / Stop-Motion': 'handcrafted claymation, plasticine clay texture, visible thumbprints, stop-motion animation look',
  'Minimalist Vector / Flat Art': 'minimalist flat vector illustration, clean geometric lines, solid shapes, modern poster art',
  'Stickman / Doodle Art': 'minimalist stickman doodle, notebook sketch on lined paper, ballpoint pen, hand-drawn lines',
  'Dark Gothic Horror': 'dark gothic horror, eerie shadows, haunted aesthetic, dark misty forest, volumetric fog, Lovecraftian vibes',
  'Charcoal & Pencil Sketch': 'charcoal drawing, graphite pencil sketch, rough cross-hatching shading, textured sketchbook paper',
  'Synthwave / 80s Retro Neon': 'synthwave 80s retro neon, Outrun grid floor, giant magenta sun, VHS tape glitch, retrowave sunset',
  'Papercut / 3D Origami': 'papercut layered origami craft, 3D paper shadowbox depth, layered cut-out textures',
  'Steampunk Fantasy': 'steampunk fantasy, brass gears, Victorian vintage tech, copper pipes, clockwork mechanisms',
  'Pop Art / Andy Warhol': 'pop art Andy Warhol style, high contrast vibrant color blocks, screen print poster, halftone dots',
  'Low-Poly 3D Geometric': 'low-poly 3D geometric, flat shaded polygons, faceted blocky art, modern digital sculpture',

  // Backwards compatibility mappings
  'Cinematic': 'photorealistic, 8k uhd, shot on 85mm lens, natural skin texture, volumetric natural lighting, sharp focus, cinematic depth of field',
  'Horror': 'dark gothic horror, eerie shadows, haunted aesthetic, dark misty forest, volumetric fog, Lovecraftian vibes',
  'Funny': '3D Disney Pixar animation style, cute expressive features, octane render, smooth textures, warm soft lighting',
  'Colorful': 'pop art Andy Warhol style, high contrast vibrant color blocks, screen print poster, halftone dots',
  'Stick Man': 'minimalist stickman doodle, notebook sketch on lined paper, ballpoint pen, hand-drawn lines',
  'Realistic': 'photorealistic, 8k uhd, shot on 85mm lens, natural skin texture, volumetric natural lighting, sharp focus, cinematic depth of field',
  'Anime / Manga': 'Studio Ghibli style, Hayao Miyazaki aesthetic, soft anime visual, hand-painted background, cel shading, cozy atmosphere',
  'Cyberpunk': 'cyberpunk aesthetic, glowing purple and cyan neon lights, rainy street reflections, volumetric fog, futuristic dystopia'
};

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
      const promptModifier = STYLE_PROMPT_MAP[effectiveSettings.imageStyle] || effectiveSettings.imageStyle;
      styleInstructions += `\n- The visual style for all image prompts MUST strictly incorporate these style keywords: "${promptModifier}".`;
    }
    if (effectiveSettings.imageFrame) {
      styleInstructions += `\n- The aspect ratio/frame for all image prompts MUST be: "${effectiveSettings.imageFrame}". Include the aspect ratio tag at the end of the prompt if appropriate.`;
    }

    let textOptionRule = '';
    if (effectiveSettings.imageTextOption === 'with_text') {
      textOptionRule = `\n- CONVERSATION TEXT: You MAY include expressive speech bubbles, dialogue captions, or comic book text bubbles inside the image to show character conversation.`;
    } else {
      textOptionRule = `\n- ABSOLUTELY NO TEXT IN IMAGE: Do NOT render any speech bubbles, dialogue text, written words, captions, subtitles, scene numbers (like "Scene 1", "Image 18"), watermarks, or signatures inside the image. The image MUST be 100% pure visual artwork with no embedded text at all!`;
    }

    const systemPrompt = `### SYSTEM ROLE: MASTER IMAGE PROMPT GENERATOR

You are an expert AI prompt engineer specialized in text-to-image models (Meta AI, Midjourney, Stable Diffusion). 
Your task is to take any raw/simple video script or idea, analyze its mood and context, select the most complementary visual layers from the Knowledge Base below, and generate ultra-high-quality, single-line image generation prompts for each scene.

---

### PROMPT FORMULA:
[Detailed Subject & Action] + [Camera Angle & Framing] + [Environment & Weather Details] + [Lighting & Atmosphere] + [Color Grading] + [Style Keywords & Render Quality]

---

### KNOWLEDGE BASE (SELECT & INJECT AUTOMATICALLY):

1. CAMERA & FRAMING:
- Close-up: "macro close-up portrait, sharp focus on facial expression, shallow depth of field, creamy bokeh background"
- Wide/Landscape: "wide-angle cinematic landscape, epic scale, deep focal depth, rule of thirds"
- Dynamic/Hero: "low-angle dramatic hero shot, powerful perspective, dynamic pose"
- Aerial: "isometric top-down view, high-angle bird's eye perspective"

2. LIGHTING & ATMOSPHERE:
- Warm/Natural: "golden hour sunlight, soft sun flares, warm natural glow, volumetric god rays"
- Cinematic/Moody: "chiaroscuro high-contrast lighting, deep dramatic shadows, volumetric fog, rim lighting"
- Sci-Fi/Urban: "vibrant neon glow, rain-slicked surface reflections, ambient atmospheric haze"
- Studio: "softbox studio lighting, clean rim light, even subsurface scattering"

3. ENVIRONMENT & TEXTURES:
- Weather/Elements: "dense morning mist, light rain with reflective puddles, falling autumn leaves, drifting dust particles"
- Surroundings: "intricately detailed background, layered foreground elements, tactile surfaces"

4. COLOR GRADING:
- Vivid: "vibrant saturated colors, rich complementary contrast"
- Cinematic: "moody teal and orange cinematic color grading"
- Soft/Muted: "pastel color palette, desaturated earthy tones"
- Monochromatic: "stark duo-tone high contrast"

5. STYLES & RENDERING SPECS:
- Photorealistic: "photorealistic, 8k uhd, shot on 85mm lens, natural skin texture, sharp focus"
- 3D Pixar: "3D Disney Pixar animation style, cute expressive features, octane render, smooth textures, warm soft lighting"
- Anime/Ghibli: "Studio Ghibli style, Hayao Miyazaki aesthetic, soft anime visual, hand-painted background, cel shading, cozy atmosphere"
- Vintage Comic: "vintage 1960s comic book panel, bold ink outlines, halftone Ben-Day dots, retro pop art"
- Cyberpunk: "cyberpunk aesthetic, glowing purple and cyan neon lights, rainy street reflections, futuristic dystopia"
- Watercolor: "soft watercolor painting, pastel color wash, bleeding ink edges, textured watercolor paper"
- Renaissance Oil: "16th century Renaissance oil painting, Rembrandt chiaroscuro lighting, thick impasto brushstrokes, canvas texture"
- 16-Bit Pixel: "16-bit pixel art, isometric view, retro SNES game sprite, limited vibrant palette"
- Claymation: "handcrafted claymation, plasticine clay texture, visible thumbprints, stop-motion animation look"
- Minimalist Vector: "minimalist flat vector illustration, clean geometric lines, solid shapes, modern poster art"
- Stickman Doodle: "minimalist stickman doodle, notebook sketch on lined paper, ballpoint pen, hand-drawn lines"
- Gothic Horror: "dark gothic horror, eerie shadows, haunted aesthetic, dark misty forest, volumetric fog, Lovecraftian vibes"
- Pencil Sketch: "charcoal drawing, graphite pencil sketch, rough cross-hatching shading, textured sketchbook paper"
- Synthwave: "synthwave 80s retro neon, Outrun grid floor, giant magenta sun, VHS tape glitch, retrowave sunset"
- Papercut Origami: "papercut layered origami craft, 3D paper shadowbox depth, layered cut-out textures"
- Steampunk: "steampunk fantasy, brass gears, Victorian vintage tech, copper pipes, clockwork mechanisms"
- Pop Art: "pop art Andy Warhol style, high contrast vibrant color blocks, screen print poster, halftone dots"
- Low-Poly: "low-poly 3D geometric, flat shaded polygons, faceted blocky art, modern digital sculpture"

### INSTRUCTIONS & CRITICAL RULES:
1. UNIQUE & DISTINCT SCENES: Every single scene prompt MUST depict a completely different visual action, camera angle, character pose, and story moment. NEVER generate duplicate or identical prompts across scenes!
2. NO SCENE NUMBERS IN PROMPT: Do NOT include words like "Scene 1", "Scene 2", "Image 18", or script line numbers inside the prompt text itself!
3. CHARACTER & VISUAL CONSISTENCY: Ensure main characters retain identical facial features, hair style, clothing, color theme, and distinct visual attributes across ALL scene prompts so that Meta AI generates cohesive, recurring characters throughout the story!
4. ULTRA-HIGH QUALITY SPECS: Always append high-end render quality specs to every prompt (e.g., "masterpiece quality, 8k uhd resolution, pristine visual clarity, award-winning photography, hyper-detailed textures, sharp focus").${textOptionRule}
5. Divide the provided script into EXACTLY ${effectiveSettings.sceneCount || 5} distinct visual scenes.
6. CRITICAL REQUIREMENT: All generated image prompts MUST be written strictly in clear, descriptive ENGLISH. If the video script is in Hindi or any non-English language, translate the visual descriptions into rich English prompts so Meta AI can generate them without error! Do NOT include Hindi text in the "prompt" field!
7. Follow the PROMPT FORMULA and automatically enrich each scene using complementary selections from the Knowledge Base (Camera, Lighting, Environment, Color Grading, Character Consistency, and Style specs).${styleInstructions}
8. Output MUST be a valid JSON array of objects, with keys: "sceneNumber", "scriptExcerpt", and "prompt". Do NOT include markdown text formatting or codeblock ticks around the JSON.`;

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
      return this.generateFallbackScenesFromScript(scriptText, effectiveSettings.sceneCount, effectiveSettings.imageStyle, effectiveSettings.imageFrame, effectiveSettings.imageTextOption);
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
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    if (settings.provider === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    } else if (settings.provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${settings.provider.toUpperCase()} API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  },

  async callClaude(userPrompt: string, settings: LlmSettings, systemPrompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: settings.model || 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  },

  async callCustom(userPrompt: string, settings: LlmSettings, systemPrompt: string): Promise<string> {
    if (!settings.customEndpoint) {
      throw new Error('Custom endpoint URL is required.');
    }

    const response = await fetch(settings.customEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Custom API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.output || JSON.stringify(data);
  },

  parseScenesFromJson(
    jsonText: string,
    originalScript: string,
    sceneCount = 5,
    style = 'Cinematic',
    frame = 'Landscape (16:9)'
  ): Scene[] {
    try {
      // Clean json output (remove markdown codeblocks if model included them)
      let cleaned = jsonText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
      }

      // Try finding json array in response text
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
      }

      const parsed = JSON.parse(cleaned);

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
    style = 'Photorealistic / 8K',
    frame = 'Landscape (16:9)',
    textOption: 'without_text' | 'with_text' = 'without_text'
  ): Scene[] {
    // Split script by sentences or clauses into scenes
    const lines = scriptText
      .split(/\n+|\. |, |!|\?/)
      .map((l) => l.trim())
      .filter((l) => l.length > 5);

    const styleModifier = STYLE_PROMPT_MAP[style] || style;
    const qualityTag = 'masterpiece quality, 8k uhd, pristine visual clarity, sharp focus, hyper-detailed textures';
    const consistencyTag = 'consistent character design and visual features across scenes';
    const textTag = textOption === 'with_text'
      ? 'with expressive dialogue speech bubbles and character conversation text'
      : 'pure visual art, no speech bubbles, no dialogue text, no captions, no written words on image, no scene number text';

    const uniqueVisualTemplates = [
      'dramatic hero shot, golden hour sunlight, volumetric god rays, high-contrast shadows',
      'intimate macro close-up portrait, shallow depth of field, expressive facial details, soft rim lighting',
      'epic wide-angle landscape, deep perspective, dramatic sky, cinematic atmosphere',
      'low-angle dynamic action perspective, intense movement, dramatic foreground elements',
      'moody atmospheric scene with dense morning mist, cool color grading, subtle lens flare',
      'high-angle bird’s eye perspective, structured geometric composition, vivid lighting',
      'over-the-shoulder narrative angle, deep bokeh background, warm ambient lighting',
      'suspenseful chiaroscuro scene with dark silhouettes, high contrast, rim light glow',
      'vibrant environmental wide shot, rich textured background, dramatic sunbeams',
      'expressive character interaction, medium shot, soft studio key light, natural reflections',
      'cinematic tracking perspective, sweeping landscape background, rich complementary colors',
      'pensive character reflection, soft side lighting, desaturated cinematic tones',
      'triumphant focal point composition, radiant backlighting, crisp sharp focus',
      'mysterious twilight setting, deep indigo and amber hues, volumetric haze',
      'dynamic diagonal angle, action-oriented framing, energetic lighting',
      'serene pastel atmosphere, soft diffuse light, gentle foreground depth',
      'striking silhouette against a glowing backdrop, high contrast duo-tone',
      'intricate detailed environmental shot, layered foreground and background depth',
      'dramatic confrontation perspective, stark shadow patterns, vivid color accents',
      'breathless climactic wide shot, sweeping horizon, majestic lighting'
    ];

    const result: Scene[] = [];
    const totalToGenerate = Math.max(1, sceneCount);

    for (let i = 0; i < totalToGenerate; i++) {
      const excerpt = lines[i % Math.max(1, lines.length)] || `Scene ${i + 1} action narrative`;
      const visualTemplate = uniqueVisualTemplates[i % uniqueVisualTemplates.length];
      const hasNonAscii = /[^\x00-\x7F]/.test(excerpt);

      const promptText = hasNonAscii
        ? `Visual scene showing: ${visualTemplate}, ${consistencyTag}, ${styleModifier}, ${qualityTag}, ${textTag}, aspect ratio: ${frame}`
        : `Visual scene depicting: ${excerpt}. ${visualTemplate}, ${consistencyTag}, ${styleModifier}, ${qualityTag}, ${textTag}, aspect ratio: ${frame}`;

      result.push({
        id: `scene-${Date.now()}-${i}`,
        sceneNumber: i + 1,
        scriptExcerpt: excerpt.slice(0, 150) + (excerpt.length > 150 ? '...' : ''),
        prompt: promptText,
        status: 'pending',
        selected: true
      });
    }

    return result;
  }
};
