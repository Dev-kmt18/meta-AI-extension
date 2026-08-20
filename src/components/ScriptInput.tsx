import React from 'react';
import { Sparkles, FileText, Trash2, Clipboard } from 'lucide-react';

interface ScriptInputProps {
  scriptText: string;
  onScriptChange: (text: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onClear: () => void;
  
  imageStyle: string;
  onStyleChange: (style: string) => void;
  imageFrame: string;
  onFrameChange: (frame: string) => void;
  sceneCount: number;
  onSceneCountChange: (count: number) => void;
}

export const ScriptInput: React.FC<ScriptInputProps> = ({
  scriptText,
  onScriptChange,
  onAnalyze,
  isAnalyzing,
  onClear,
  imageStyle,
  onStyleChange,
  imageFrame,
  onFrameChange,
  sceneCount,
  onSceneCountChange
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
      {/* Header */}
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

      {/* Input Textarea */}
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

      {/* Settings Grid */}
      <div className="grid grid-cols-3 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/40">
        {/* Style Dropdown (All 18 Custom Presets) */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Image Style
          </label>
          <select
            value={imageStyle}
            onChange={(e) => onStyleChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
          >
            <option value="Photorealistic / 8K">Photorealistic 8K 📸</option>
            <option value="3D Pixar / Disney">3D Pixar / Disney 🎨</option>
            <option value="Japanese Anime / Ghibli">Anime / Ghibli 🌸</option>
            <option value="Vintage Comic Book">Comic Book 💥</option>
            <option value="Cyberpunk / Sci-Fi">Cyberpunk 🏙️</option>
            <option value="Soft Watercolor Painting">Watercolor 🖌️</option>
            <option value="Classic Renaissance Oil Painting">Oil Painting 🏛️</option>
            <option value="Retro 16-Bit Pixel Art">16-Bit Pixel Art 👾</option>
            <option value="Claymation / Stop-Motion">Claymation 🧸</option>
            <option value="Minimalist Vector / Flat Art">Flat Vector 📐</option>
            <option value="Stickman / Doodle Art">Stickman Doodle ✏️</option>
            <option value="Dark Gothic Horror">Gothic Horror 👻</option>
            <option value="Charcoal & Pencil Sketch">Pencil Sketch 📝</option>
            <option value="Synthwave / 80s Retro Neon">80s Synthwave 🌅</option>
            <option value="Papercut / 3D Origami">3D Origami 📄</option>
            <option value="Steampunk Fantasy">Steampunk ⚙️</option>
            <option value="Pop Art / Andy Warhol">Pop Art 🎨</option>
            <option value="Low-Poly 3D Geometric">Low-Poly 3D 🧊</option>
          </select>
        </div>

        {/* Frame / Aspect Ratio Dropdown */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Image Frame
          </label>
          <select
            value={imageFrame}
            onChange={(e) => onFrameChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
          >
            <option value="Landscape (16:9)">Landscape (16:9)</option>
            <option value="Portrait (9:16)">Portrait (9:16)</option>
            <option value="Square (1:1)">Square (1:1)</option>
            <option value="Wide Cinematic (21:9)">Wide (21:9)</option>
            <option value="Social Post (4:5)">Social Post (4:5)</option>
            <option value="Classic TV (4:3)">Classic TV (4:3)</option>
            <option value="Ultrawide (32:9)">Ultrawide (32:9)</option>
          </select>
        </div>

        {/* Number of Images (Manual Input) */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            No. of Images
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={sceneCount}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              onSceneCountChange(isNaN(val) ? 1 : Math.max(1, Math.min(100, val)));
            }}
            placeholder="e.g. 10"
            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Action Button */}
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
