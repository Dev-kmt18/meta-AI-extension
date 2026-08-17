import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Header } from '../components/Header';
import { SettingsModal } from '../components/SettingsModal';
import { ScriptInput } from '../components/ScriptInput';
import { PromptList } from '../components/PromptList';
import { GenerationProgress } from '../components/GenerationProgress';
import { ImageGallery } from '../components/ImageGallery';
import { QuickDownloader } from '../components/QuickDownloader';
import { StorageService } from '../services/storage';
import { LlmService } from '../services/llm';
import { FileSaverService } from '../services/fileSaver';
import { ExtensionState, LlmSettings, Scene, AppGenerationState } from '../types';

export const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'downloader' | 'prompter'>('downloader');
  const [scriptText, setScriptText] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [generationState, setGenerationState] = useState<AppGenerationState>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [settings, setSettings] = useState<LlmSettings>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-1.5-flash'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMetaConnected, setIsMetaConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [activeMetaTabId, setActiveMetaTabId] = useState<number | undefined>();
  const [failedDownloadIds, setFailedDownloadIds] = useState<string[]>([]);

  // Refs for async loop access to latest state
  const pauseRef = useRef(false);
  const scenesRef = useRef<Scene[]>([]);
  const tabIdRef = useRef<number | undefined>();
  const lastTabUrlRef = useRef<string>('');

  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => { tabIdRef.current = activeMetaTabId; }, [activeMetaTabId]);

  // Load initial persisted state
  useEffect(() => {
    (async () => {
      const saved = await StorageService.getState();
      setScriptText(saved.scriptText || '');
      setScenes(saved.scenes || []);
      const savedGenState = saved.generationState;
      setGenerationState(savedGenState === 'generating' ? 'paused' : (savedGenState || 'idle'));
      setCurrentIndex(saved.currentIndex || 0);
      setSettings(saved.settings);
    })();
  }, []);

  // Persist state changes
  useEffect(() => {
    StorageService.saveState({ scriptText, scenes, generationState, currentIndex, settings });
  }, [scriptText, scenes, generationState, currentIndex, settings]);

  // ─── Find active Meta AI tab ───
  const findMetaAITab = useCallback((): Promise<number | null> => {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.tabs) { resolve(null); return; }
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        // First try active tab
        const active = tabs.find(t => t.active && t.url && t.url.includes('meta.ai'));
        if (active?.id) { resolve(active.id); return; }
        // Then try any meta.ai tab
        const metaTab = tabs.find(t => t.url && t.url.includes('meta.ai'));
        if (metaTab?.id) { resolve(metaTab.id); return; }
        resolve(null);
      });
    });
  }, []);

  // ─── Inject content script into a tab (safe to call multiple times, with retry) ───
  const injectContentScript = useCallback(async (tabId: number, retries = 3): Promise<boolean> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
        await new Promise(r => setTimeout(r, 500 * attempt));
        return true;
      } catch (e: any) {
        console.warn(`[SidePanel] Content script injection attempt ${attempt} failed:`, e.message);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    return false;
  }, []);

  // ─── Force re-inject content script, verify with retries ───
  const ensureContentScript = useCallback(async (tabId: number): Promise<boolean> => {
    // First, try to ping; if it fails, force re-inject
    for (let attempt = 1; attempt <= 3; attempt++) {
      const alive = await new Promise<boolean>((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });

      if (alive) {
        // Verify URL is still meta.ai (detect soft-navigate)
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab?.url && !tab.url.includes('meta.ai')) {
            console.log('[SidePanel] Tab navigated away from meta.ai:', tab.url);
            lastTabUrlRef.current = tab.url;
            return false;
          }
          lastTabUrlRef.current = tab?.url || '';
        } catch { /* ignore */ }

        if (attempt > 1) console.log('[SidePanel] Content script recovered on attempt', attempt);
        return true;
      }

      console.log(`[SidePanel] Content script not responding (attempt ${attempt}), re-injecting...`);
      const injected = await injectContentScript(tabId);
      if (!injected && attempt < 3) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    console.error('[SidePanel] Content script could not be recovered after 3 attempts');
    return false;
  }, [injectContentScript]);

  // Check active Meta AI tab connection status
  useEffect(() => {
    const checkTab = async () => {
      const tabId = await findMetaAITab();
      if (tabId) {
        setIsMetaConnected(true);
        setActiveMetaTabId(tabId);
        // Background ping (don't await, don't block)
        ensureContentScript(tabId);
      } else {
        setIsMetaConnected(false);
        setActiveMetaTabId(undefined);
      }
    };

    checkTab();
    const interval = setInterval(checkTab, 4000);
    return () => clearInterval(interval);
  }, [findMetaAITab, ensureContentScript]);

  // Script Analysis
  const handleAnalyzeScript = async () => {
    if (!scriptText.trim()) return;
    setErrorMsg(undefined);
    setIsAnalyzing(true);

    try {
      const generatedScenes = await LlmService.analyzeScript(scriptText, settings);
      setScenes(generatedScenes);
      setGenerationState('idle');
      setCurrentIndex(0);
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setErrorMsg(err.message || 'Failed to analyze script.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── Send a single prompt with auto-retry and re-injection ───
  const sendPromptWithRetry = useCallback(async (prompt: string, maxRetries = 2): Promise<string> => {
    let lastError = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Find the meta AI tab (could have changed after navigation)
      const tabId = await findMetaAITab();
      if (!tabId) {
        lastError = 'Meta AI tab not found. Please keep meta.ai open.';
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      tabIdRef.current = tabId;
      setActiveMetaTabId(tabId);

      // Check if page has navigated away
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab?.url && !tab.url.includes('meta.ai')) {
          console.warn(`[SidePanel] Tab navigated to ${tab.url}, waiting for meta.ai...`);
          lastError = 'Meta AI page navigated away. Waiting...';
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        lastTabUrlRef.current = tab?.url || '';
      } catch { /* ignore */ }

      // Force re-inject content script before each attempt (handles soft-navigate)
      const injected = await injectContentScript(tabId);
      if (!injected) {
        lastError = 'Content script injection failed.';
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      await new Promise(r => setTimeout(r, 1000));

      // Verify content script is alive
      const alive = await ensureContentScript(tabId);
      if (!alive) {
        lastError = 'Content script not responding after injection.';
        console.warn(`[SidePanel] Attempt ${attempt}: content script not alive after injection`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      // Send prompt
      try {
        const imageUrl = await new Promise<string>((resolve, reject) => {
          chrome.tabs.sendMessage(
            tabId,
            { type: 'SEND_PROMPT_TO_META', payload: { prompt } },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              if (!response || !response.success) {
                reject(new Error(response?.error || 'Prompt execution failed.'));
                return;
              }
              resolve(response.imageUrl);
            }
          );
        });
        return imageUrl; // Success!
      } catch (err: any) {
        lastError = err.message;
        console.warn(`[SidePanel] Attempt ${attempt} failed:`, err.message);

        // Do not retry typing into Meta AI if Meta AI stopped the request
        if (err.message.includes('Request was stopped') || err.message.includes('unable to generate')) {
          throw err;
        }

        if (attempt < maxRetries) {
          const waitTime = 3000;
          console.log(`[SidePanel] Retrying in ${waitTime}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }

    throw new Error(lastError || `Failed to generate image.`);
  }, [findMetaAITab, ensureContentScript, injectContentScript]);

  // ─── Sequential Generation Loop ───
  const startOrResumeGeneration = useCallback(async (startIndex: number) => {
    const tabId = await findMetaAITab();
    if (!tabId) {
      setErrorMsg('Meta AI tab is not found. Please open https://www.meta.ai in any tab.');
      return;
    }

    setErrorMsg(undefined);
    setGenerationState('generating');
    pauseRef.current = false;

    const currentScenes = scenesRef.current;

    for (let idx = startIndex; idx < currentScenes.length; idx++) {
      if (pauseRef.current) {
        console.log('[SidePanel] Generation paused at index', idx);
        setGenerationState('paused');
        return;
      }

      setCurrentIndex(idx);
      const scene = currentScenes[idx];

      // Skip already completed scenes
      if (scene.status === 'completed' && scene.imageUrl) {
        console.log(`[SidePanel] Skipping already completed scene ${idx + 1}`);
        continue;
      }

      setScenes(prev => prev.map((s, i) => i === idx ? { ...s, status: 'generating', error: undefined } : s));

      // ─── Re-inject content script before each scene ───
      const injected = await injectContentScript(tabId);
      if (!injected) {
        console.error(`[SidePanel] Failed to inject content script before scene ${idx + 1}`);
        setScenes(prev => prev.map((s, i) => i === idx ? { ...s, status: 'failed' as const, error: 'Failed to inject content script.' } : s));
        setErrorMsg(`Scene ${idx + 1}: Content script injection failed.`);
        continue;
      }
      await new Promise(r => setTimeout(r, 1500));

      // Verify content script is alive
      const alive = await ensureContentScript(tabId);
      if (!alive) {
        console.error(`[SidePanel] Content script not alive before scene ${idx + 1}, retrying injection...`);
        const reinjected = await injectContentScript(tabId);
        if (!reinjected) {
          setScenes(prev => prev.map((s, i) => i === idx ? { ...s, status: 'failed' as const, error: 'Content script unresponsive.' } : s));
          setErrorMsg(`Scene ${idx + 1}: Content script unresponsive.`);
          continue;
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      try {
        console.log(`[SidePanel] === Generating scene ${idx + 1}/${currentScenes.length} ===`);
        const imageUrl = await sendPromptWithRetry(scene.prompt);

        setScenes(prev => {
          const updated = prev.map((s, i) => i === idx ? { ...s, status: 'completed' as const, imageUrl, selected: true } : s);
          scenesRef.current = updated;
          return updated;
        });

        console.log(`[SidePanel] Scene ${idx + 1} completed!`);
      } catch (err: any) {
        console.error(`[SidePanel] Scene ${idx + 1} failed:`, err);
        setScenes(prev => {
          const updated = prev.map((s, i) => i === idx ? { ...s, status: 'failed' as const, error: err.message } : s);
          scenesRef.current = updated;
          return updated;
        });
        setErrorMsg(`Scene ${idx + 1} failed: ${err.message}`);
        setGenerationState('paused');
        pauseRef.current = true;
        return; // Stop the loop on error
      }

      // Delay between scenes (give Meta AI time to settle)
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!pauseRef.current) {
      setGenerationState('completed');
    }
  }, [findMetaAITab, sendPromptWithRetry, injectContentScript, ensureContentScript]);

  const handleStart = () => startOrResumeGeneration(0);
  const handlePause = () => { pauseRef.current = true; setGenerationState('paused'); };
  const handleResume = () => {
    // Find first non-completed scene
    const nextIdx = scenesRef.current.findIndex((s, i) => i >= currentIndex && s.status !== 'completed');
    startOrResumeGeneration(nextIdx >= 0 ? nextIdx : currentIndex);
  };

  const handleReset = () => {
    pauseRef.current = true;
    setGenerationState('idle');
    setCurrentIndex(0);
    setErrorMsg(undefined);
    setScenes(prev => prev.map(s => ({ ...s, status: 'pending', imageUrl: undefined, error: undefined })));
  };

  // Single Scene Regeneration
  const handleRegenerateScene = async (sceneToRegen: Scene) => {
    setScenes(prev => prev.map(s => s.id === sceneToRegen.id ? { ...s, status: 'generating' } : s));

    try {
      const tabId = await findMetaAITab();
      if (tabId) {
        await injectContentScript(tabId);
        await new Promise(r => setTimeout(r, 1500));
      }
      const imageUrl = await sendPromptWithRetry(sceneToRegen.prompt);
      setScenes(prev => prev.map(s => s.id === sceneToRegen.id ? { ...s, status: 'completed', imageUrl } : s));
    } catch (err: any) {
      setScenes(prev => prev.map(s => s.id === sceneToRegen.id ? { ...s, status: 'failed', error: err.message } : s));
      setErrorMsg(`Regeneration failed: ${err.message}`);
    }
  };

  // Prompt Edits
  const handleUpdatePrompt = (id: string, newPrompt: string) => {
    setScenes(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, prompt: newPrompt } : s);
      scenesRef.current = updated;
      return updated;
    });
  };

  const handleDeleteScene = (id: string) => {
    setScenes(prev => {
      const updated = prev.filter(s => s.id !== id);
      scenesRef.current = updated;
      return updated;
    });
  };

  const handleAddScene = () => {
    const newNum = scenes.length + 1;
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      sceneNumber: newNum,
      scriptExcerpt: `Manual Scene ${newNum}`,
      prompt: `Cinematic high quality photorealistic shot, 8k resolution...`,
      status: 'pending',
      selected: true
    };
    setScenes(prev => {
      const updated = [...prev, newScene];
      scenesRef.current = updated;
      return updated;
    });
  };

  const handleToggleSelect = (id: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };
  const handleSelectAll = () => {
    setScenes(prev => prev.map(s => ({ ...s, selected: true })));
  };
  const handleDeselectAll = () => {
    setScenes(prev => prev.map(s => ({ ...s, selected: false })));
  };

  const handleDownloadSelected = async () => {
    setIsDownloading(true);
    setErrorMsg(undefined);
    setFailedDownloadIds([]);
    try {
      const pattern = settings.fileNamePattern || 'number_only';
      const res = await FileSaverService.saveImagesToDirectory(scenes, pattern);
      if (res.failedIds && res.failedIds.length > 0) {
        setFailedDownloadIds(res.failedIds);
        setErrorMsg(`⚠️ Saved ${res.count} images, but ${res.failedIds.length} failed. Scroll down to retry.`);
      } else if (!res.success && res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg('Failed to download images.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRetryFailedDownloads = async () => {
    if (failedDownloadIds.length === 0) return;
    setIsDownloading(true);
    setErrorMsg(undefined);
    try {
      const pattern = settings.fileNamePattern || 'number_only';
      const failedScenes = scenes.filter(s => failedDownloadIds.includes(s.id));
      const res = await FileSaverService.saveImagesToDirectory(failedScenes, pattern);
      const newFailed = res.failedIds || [];
      setFailedDownloadIds(newFailed);
      if (newFailed.length > 0) {
        setErrorMsg(`⚠️ Retried: Saved ${res.count} images, but ${newFailed.length} failed again.`);
      } else {
        setErrorMsg(undefined);
      }
    } catch (err: any) {
      setErrorMsg('Failed to retry download.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClearScript = async () => {
    pauseRef.current = true;
    setScriptText('');
    setScenes([]);
    setGenerationState('idle');
    setCurrentIndex(0);
    setErrorMsg(undefined);
    await StorageService.clearSession();
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100">
      <Header
        isMetaConnected={isMetaConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeMode={activeMode}
        onModeChange={setActiveMode}
      />

      <main className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full pb-10">
        {activeMode === 'downloader' ? (
          <QuickDownloader
            activeMetaTabId={activeMetaTabId}
            fileNamePattern={settings.fileNamePattern}
            onPatternChange={(pattern) => setSettings((prev) => ({ ...prev, fileNamePattern: pattern }))}
            injectContentScript={injectContentScript}
            ensureContentScript={ensureContentScript}
          />
        ) : (
          <>
            <ScriptInput
              scriptText={scriptText}
              onScriptChange={setScriptText}
              onAnalyze={handleAnalyzeScript}
              isAnalyzing={isAnalyzing}
              onClear={handleClearScript}
              imageStyle={settings.imageStyle || 'Cinematic'}
              onStyleChange={(style) => setSettings((prev) => ({ ...prev, imageStyle: style }))}
              imageFrame={settings.imageFrame || 'Landscape (16:9)'}
              onFrameChange={(frame) => setSettings((prev) => ({ ...prev, imageFrame: frame }))}
              sceneCount={settings.sceneCount || 5}
              onSceneCountChange={(count) => setSettings((prev) => ({ ...prev, sceneCount: count }))}
            />

            <GenerationProgress
              generationState={generationState}
              scenes={scenes}
              currentIndex={currentIndex}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onReset={handleReset}
              errorMsg={errorMsg}
            />

            <PromptList
              scenes={scenes}
              onUpdatePrompt={handleUpdatePrompt}
              onDeleteScene={handleDeleteScene}
              onAddScene={handleAddScene}
              onRegenerateScene={handleRegenerateScene}
              isGenerating={generationState === 'generating'}
            />

            <ImageGallery
              scenes={scenes}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onDownloadSelected={handleDownloadSelected}
              onRegenerateScene={handleRegenerateScene}
              isGenerating={generationState === 'generating'}
              isDownloading={isDownloading}
              failedDownloadIds={failedDownloadIds}
              onRetryFailed={handleRetryFailedDownloads}
            />
          </>
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
    </div>
  );
};
