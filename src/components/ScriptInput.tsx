import React from 'react';
import { Sparkles, FileText, Trash2, Clipboard } from 'lucide-react';

interface ScriptInputProps {
  scriptText: string;
  onScriptChange: (text: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onClear: () => void;
}

export const ScriptInput: React.FC<ScriptInputProps> = ({
  scriptText,
  onScriptChange,
  onAnalyze,
  isAnalyzing,
  onClear
}) => {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onScriptChange(text);
      }
    } catch (e) {
      console.warn('Clipboard read error:', e);
    }
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs uppercase tracking-wider">
          <FileText className="w-4 h-4 text-blue-400" />
          <span>Video Script</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePaste}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition"
            title="Paste from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5" /> Paste
          </button>
          {scriptText && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 transition"
              title="Clear script"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <textarea
          value={scriptText}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Paste your video script here... (e.g. Scene 1: A futuristic cyberpunk city at sunset with glowing neon signs. Scene 2: An astronaut floating peacefully near a cosmic nebula...)"
          className="w-full h-44 p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-mono leading-relaxed"
        />
        <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 font-mono">
          {scriptText.length} characters
        </div>
      </div>

      <button
        onClick={onAnalyze}
        disabled={isAnalyzing || !scriptText.trim()}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs shadow-lg transition duration-200 ${
          isAnalyzing || !scriptText.trim()
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600/50'
            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-600/25 active:scale-[0.99]'
        }`}
      >
        {isAnalyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing Script & Generating Scenes...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Analyze Script & Generate Image Prompts
          </>
        )}
      </button>
    </div>
  );
};
