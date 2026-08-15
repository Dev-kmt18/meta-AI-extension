import React, { useState } from 'react';
import { X, Key, Cpu, Save, Check } from 'lucide-react';
import { LlmSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: LlmSettings;
  onSave: (newSettings: LlmSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave
}) => {
  const [form, setForm] = useState<LlmSettings>({
    ...settings,
    useOwnAi: settings.useOwnAi || false,
    ownApiKey: settings.ownApiKey || ''
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">AI API Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Use Own AI Checkbox/Toggle */}
          <div className="flex items-start justify-between p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl hover:border-slate-700/80 transition duration-150">
            <div className="flex-1 pr-3">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider cursor-pointer">
                Use your own AI for analysis
              </label>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Enable this to enter your own API key. Otherwise, the extension will use the built-in default AI automatically.
              </p>
            </div>
            <div className="flex items-center h-5">
              <input
                id="useOwnAi"
                type="checkbox"
                checked={form.useOwnAi}
                onChange={(e) => setForm({ ...form, useOwnAi: e.target.checked })}
                className="w-4.5 h-4.5 text-blue-600 rounded bg-slate-900 border-slate-700 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
              />
            </div>
          </div>

          {/* Conditional API Key Input */}
          {form.useOwnAi && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Your API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={form.ownApiKey}
                  onChange={(e) => setForm({ ...form, ownApiKey: e.target.value })}
                  placeholder="Enter API key (starts with sk-, gsk_, etc.)"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                💡 Provider and model will be automatically detected based on the prefix of your API key.
              </p>
            </div>
          )}

          {/* Download Naming Format */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Image Download Naming Format
            </label>
            <select
              value={form.fileNamePattern || 'number_only'}
              onChange={(e) => setForm({ ...form, fileNamePattern: e.target.value as any })}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
            >
              <option value="number_only">1.png, 2.png, 3.png (Numbers Only)</option>
              <option value="padded_num">01.png, 02.png, 03.png (Padded Numbers)</option>
              <option value="scene_num">scene-01.png, scene-02.png (Scene Prefix)</option>
            </select>
          </div>

          {/* Submit Action */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition duration-200"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" /> Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Configuration
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
