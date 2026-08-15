import React from 'react';
import { Settings, Sparkles, CheckCircle2, AlertCircle, Download, FileText } from 'lucide-react';

interface HeaderProps {
  isMetaConnected: boolean;
  onOpenSettings: () => void;
  activeMode: 'downloader' | 'prompter';
  onModeChange: (mode: 'downloader' | 'prompter') => void;
}

export const Header: React.FC<HeaderProps> = ({
  isMetaConnected,
  onOpenSettings,
  activeMode,
  onModeChange
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 shadow-md shadow-blue-500/20 text-white">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight">
              Meta AI Scene Studio
            </h1>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              {isMetaConnected ? (
                <span className="inline-flex items-center text-emerald-400 gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Meta AI Connected
                </span>
              ) : (
                <span className="inline-flex items-center text-amber-400 gap-1">
                  <AlertCircle className="w-3 h-3" /> Open Meta AI Tab
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all duration-200 shadow-sm"
          title="AI API Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
        <button
          onClick={() => onModeChange('downloader')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition duration-200 ${
            activeMode === 'downloader'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          Quick Image Saver
        </button>

        <button
          onClick={() => onModeChange('prompter')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition duration-200 ${
            activeMode === 'prompter'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Script & Auto-Prompter
        </button>
      </div>
    </header>
  );
};

