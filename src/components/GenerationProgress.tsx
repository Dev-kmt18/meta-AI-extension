import React from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { AppGenerationState, Scene } from '../types';

interface GenerationProgressProps {
  generationState: AppGenerationState;
  scenes: Scene[];
  currentIndex: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  errorMsg?: string;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  generationState,
  scenes,
  currentIndex,
  onStart,
  onPause,
  onResume,
  onReset,
  errorMsg
}) => {
  const total = scenes.length;
  const completedCount = scenes.filter((s) => s.status === 'completed').length;
  const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {generationState === 'generating' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating Scene {currentIndex + 1} of {total}
            </span>
          )}
          {generationState === 'paused' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Pause className="w-3.5 h-3.5" /> Paused ({completedCount}/{total})
            </span>
          )}
          {generationState === 'completed' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> All {total} Scenes Generated!
            </span>
          )}
          {generationState === 'idle' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
              Ready to Generate ({total} Scenes)
            </span>
          )}
          {generationState === 'error' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-3.5 h-3.5" /> Error
            </span>
          )}
        </div>

        <button
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
          title="Reset generation progress"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-0.5">
          <span>Progress: {progressPercent}%</span>
          <span>{completedCount} / {total} Completed</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 pt-1">
        {generationState === 'idle' && (
          <button
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition"
          >
            <Play className="w-4 h-4 fill-white" /> Start Generation
          </button>
        )}

        {generationState === 'generating' && (
          <button
            onClick={onPause}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 transition"
          >
            <Pause className="w-4 h-4 fill-white" /> Pause Generation
          </button>
        )}

        {generationState === 'paused' && (
          <button
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition"
          >
            <Play className="w-4 h-4 fill-white" /> Resume Generation
          </button>
        )}
      </div>
    </div>
  );
};
