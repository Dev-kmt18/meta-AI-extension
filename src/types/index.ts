export type LlmProvider = 'gemini' | 'openai' | 'claude' | 'groq' | 'openrouter' | 'custom';

export interface LlmSettings {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  systemPrompt?: string;
  fileNamePattern?: 'number_only' | 'scene_num' | 'padded_num'; // e.g. '1.png', 'scene-01.png', '01.png'
  useOwnAi?: boolean;
  ownApiKey?: string;
}

export type SceneStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface Scene {
  id: string;
  sceneNumber: number;
  scriptExcerpt: string;
  prompt: string;
  imageUrl?: string;
  status: SceneStatus;
  selected: boolean;
  error?: string;
}

export type AppGenerationState = 'idle' | 'analyzing' | 'generating' | 'paused' | 'completed' | 'error';

export interface ExtensionState {
  scriptText: string;
  scenes: Scene[];
  generationState: AppGenerationState;
  currentIndex: number;
  settings: LlmSettings;
  activeMetaTabId?: number;
}

export interface ChromeMessage {
  type: 
    | 'PING'
    | 'PONG'
    | 'SEND_PROMPT_TO_META'
    | 'PROMPT_RESULT'
    | 'GET_TAB_STATUS'
    | 'TAB_STATUS_RESPONSE'
    | 'SCAN_PAGE_IMAGES'
    | 'OPEN_SIDEPANEL';
  payload?: any;
}
