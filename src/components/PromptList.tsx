import React from 'react';
import { Plus, Trash2, Edit3, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Scene } from '../types';

interface PromptListProps {
  scenes: Scene[];
  onUpdatePrompt: (id: string, newPrompt: string) => void;
  onDeleteScene: (id: string) => void;
  onAddScene: () => void;
  onRegenerateScene: (scene: Scene) => void;
  isGenerating: boolean;
}

export const PromptList: React.FC<PromptListProps> = ({
  scenes,
  onUpdatePrompt,
  onDeleteScene,
  onAddScene,
  onRegenerateScene,
  isGenerating
}) => {
  if (scenes.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Edit3 className="w-4 h-4 text-purple-400" />
          Editable Prompts List ({scenes.length} Scenes)
        </h3>
        <button
          onClick={onAddScene}
          disabled={isGenerating}
          className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Scene
        </button>
      </div>

      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {scenes.map((scene, idx) => (
          <div
            key={scene.id}
            className={`bg-slate-800/60 border rounded-xl p-3 space-y-2 transition-all ${
              scene.status === 'generating'
                ? 'border-blue-500/80 bg-blue-950/20 ring-1 ring-blue-500/50'
                : scene.status === 'completed'
                ? 'border-slate-700/80'
                : 'border-slate-700/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-blue-400 font-mono">
                  {idx + 1}
                </span>
                Scene #{scene.sceneNumber}
              </span>

              <div className="flex items-center gap-1">
                {scene.imageUrl && (
                  <button
                    onClick={() => onRegenerateScene(scene)}
                    disabled={isGenerating}
                    className="flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded-md transition"
                    title="Regenerate single image on Meta AI"
                  >
                    <Sparkles className="w-3 h-3" /> Regenerate
                  </button>
                )}
                <button
                  onClick={() => onDeleteScene(scene.id)}
                  disabled={isGenerating}
                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                  title="Delete scene"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Script excerpt preview */}
            {scene.scriptExcerpt && (
              <p className="text-[11px] text-slate-400 italic line-clamp-1 bg-slate-900/40 px-2 py-1 rounded">
                "{scene.scriptExcerpt}"
              </p>
            )}

            {/* Editable Prompt Area */}
            <textarea
              value={scene.prompt}
              onChange={(e) => onUpdatePrompt(scene.id, e.target.value)}
              disabled={isGenerating}
              placeholder="Cinematic prompt for Meta AI..."
              className="w-full h-20 p-2.5 bg-slate-900 border border-slate-700/70 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
