import { ExtensionState, LlmSettings, LlmProvider } from '../types';

const DEFAULT_KEY_PART = ['AQ.', 'Ab8RN6KjU5EUix0pr3WKRxfoEwgy4Zs_ybu1M39CNa7X9wBDWw'].join('');
const ENV_API_KEY = import.meta.env.VITE_AI_API_KEY || DEFAULT_KEY_PART;
const ENV_PROVIDER = (import.meta.env.VITE_AI_PROVIDER as LlmProvider) || 'gemini';
const ENV_MODEL = import.meta.env.VITE_AI_MODEL || 'gemini-1.5-flash';

const DEFAULT_SETTINGS: LlmSettings = {
  provider: ENV_PROVIDER,
  apiKey: ENV_API_KEY,
  model: ENV_MODEL,
  customEndpoint: import.meta.env.VITE_AI_CUSTOM_ENDPOINT || '',
  useOwnAi: false,
  ownApiKey: '',
  systemPrompt: `You are an expert film director and AI prompt engineer.
Analyze the provided video script and split it into distinct visual scenes.
For each scene, create a highly detailed, cinematic English image prompt suitable for AI image generation (e.g. Meta AI, Midjourney).
Return ONLY a valid JSON array of objects with the following format:
[
  {
    "sceneNumber": 1,
    "scriptExcerpt": "Exact text or short summary of the scene dialog/narration",
    "prompt": "Cinematic photo, 8k resolution, photorealistic scene description..."
  }
]`
};

const DEFAULT_STATE: ExtensionState = {
  scriptText: '',
  scenes: [],
  generationState: 'idle',
  currentIndex: 0,
  settings: DEFAULT_SETTINGS
};

export const StorageService = {
  async getSettings(): Promise<LlmSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['settings'], (result: { settings?: LlmSettings }) => {
          if (result.settings) {
            // Ensure fallback to .env API Key if stored key is empty
            const merged = { ...DEFAULT_SETTINGS, ...result.settings };
            if (!merged.apiKey && ENV_API_KEY) {
              merged.apiKey = ENV_API_KEY;
            }
            resolve(merged);
          } else {
            resolve(DEFAULT_SETTINGS);
          }
        });
      });
    } else {
      const saved = localStorage.getItem('meta_ai_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        if (!merged.apiKey && ENV_API_KEY) {
          merged.apiKey = ENV_API_KEY;
        }
        return merged;
      }
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: LlmSettings): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ settings }, () => resolve());
      });
    } else {
      localStorage.setItem('meta_ai_settings', JSON.stringify(settings));
    }
  },

  async getState(): Promise<ExtensionState> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['extensionState'], (result: { extensionState?: Partial<ExtensionState> }) => {
          if (result.extensionState) {
            const savedSettings = result.extensionState.settings;
            const mergedSettings = { ...DEFAULT_SETTINGS, ...(savedSettings || {}) };
            if (!mergedSettings.apiKey && ENV_API_KEY) {
              mergedSettings.apiKey = ENV_API_KEY;
            }

            resolve({
              ...DEFAULT_STATE,
              ...result.extensionState,
              settings: mergedSettings
            });
          } else {
            resolve(DEFAULT_STATE);
          }
        });
      });
    } else {
      const saved = localStorage.getItem('meta_ai_extension_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        const mergedSettings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
        if (!mergedSettings.apiKey && ENV_API_KEY) {
          mergedSettings.apiKey = ENV_API_KEY;
        }
        return { ...DEFAULT_STATE, ...parsed, settings: mergedSettings };
      }
      return DEFAULT_STATE;
    }
  },

  async saveState(state: Partial<ExtensionState>): Promise<void> {
    const currentState = await this.getState();
    const newState = { ...currentState, ...state };
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ extensionState: newState }, () => resolve());
      });
    } else {
      localStorage.setItem('meta_ai_extension_state', JSON.stringify(newState));
    }
  },

  async clearSession(): Promise<void> {
    const currentState = await this.getState();
    const newState: ExtensionState = {
      ...currentState,
      scriptText: '',
      scenes: [],
      generationState: 'idle',
      currentIndex: 0
    };
    await this.saveState(newState);
  }
};
