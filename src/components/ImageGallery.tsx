import React, { useState } from 'react';
import { Download, CheckSquare, Square, RefreshCw, FolderDown, Image as ImageIcon, ExternalLink, AlertCircle } from 'lucide-react';
import { Scene } from '../types';

interface ImageGalleryProps {
  scenes: Scene[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDownloadSelected: () => void;
  onRegenerateScene: (scene: Scene) => void;
  isGenerating: boolean;
  isDownloading: boolean;
  failedDownloadIds?: string[];
  onRetryFailed?: () => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  scenes,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onDownloadSelected,
  onRegenerateScene,
  isGenerating,
  isDownloading,
  failedDownloadIds = [],
  onRetryFailed
}) => {
  const [selectedPreviewImg, setSelectedPreviewImg] = useState<string | null>(null);

  // Show only scenes that are currently generating or have finished generating
  const visibleScenes = scenes.filter((s) => s.imageUrl || s.status === 'generating');
  const generatedScenes = scenes.filter((s) => s.imageUrl);

  if (visibleScenes.length === 0) return null;

  const selectedCount = scenes.filter((s) => s.selected && s.imageUrl).length;
  const allSelected = generatedScenes.length > 0 && generatedScenes.every((s) => s.selected);

  return (
    <div className="space-y-3 pt-2 border-t border-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          Generated Images ({generatedScenes.length}/{scenes.length})
        </h3>

        {/* Selection Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 transition"
          >
            {allSelected ? (
              <>
                <Square className="w-3.5 h-3.5" /> Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-blue-400" /> Select All
              </>
            )}
          </button>

          <button
            onClick={onDownloadSelected}
            disabled={selectedCount === 0 || isDownloading}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md transition ${
              selectedCount === 0 || isDownloading
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            {isDownloading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FolderDown className="w-3.5 h-3.5" />
                Download Selected ({selectedCount})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 gap-3">
        {visibleScenes.map((scene) => {
          const numStr = String(scene.sceneNumber).padStart(2, '0');
          return (
            <div
              key={scene.id}
              className={`group relative bg-slate-800/80 border rounded-xl overflow-hidden flex flex-col justify-between transition-all ${
                scene.selected ? 'border-blue-500/70 ring-1 ring-blue-500/40' : 'border-slate-700/60'
              }`}
            >
              {/* Header inside card */}
              <div className="flex items-center justify-between p-2 bg-slate-900/60 border-b border-slate-700/40">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scene.selected}
                    onChange={() => onToggleSelect(scene.id)}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-[11px] font-bold text-slate-300 font-mono">
                    scene-{numStr}
                  </span>
                </label>

                {scene.imageUrl && (
                  <button
                    onClick={() => onRegenerateScene(scene)}
                    disabled={isGenerating}
                    className="p-1 text-slate-400 hover:text-purple-300 rounded hover:bg-slate-700 transition"
                    title="Regenerate this image"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Image / Placeholder Body */}
              <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                {scene.imageUrl ? (
                  <>
                    <img
                      src={scene.imageUrl}
                      alt={`Scene ${scene.sceneNumber}`}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-300"
                      onClick={() => setSelectedPreviewImg(scene.imageUrl || null)}
                    />
                    <button
                      onClick={() => setSelectedPreviewImg(scene.imageUrl || null)}
                      className="absolute bottom-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 text-white rounded-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center text-slate-600">
                    <ImageIcon className="w-6 h-6 mb-1 opacity-40" />
                    <span className="text-[10px] uppercase font-semibold tracking-wider">
                      {scene.status === 'generating' ? 'Generating...' : 'Not Generated'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Failed Downloads retry block */}
      {failedDownloadIds.length > 0 && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-2.5 mt-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
            <span className="text-xs font-bold text-red-200">
              {failedDownloadIds.length} Image(s) Failed to Download
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
            {failedDownloadIds.map((id) => {
              const scene = scenes.find((s) => s.id === id);
              if (!scene || !scene.imageUrl) return null;
              return (
                <div key={id} className="relative w-8 h-8 rounded border border-red-500/20 overflow-hidden bg-slate-900 group">
                  <img src={scene.imageUrl} className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[9px] text-red-300 font-extrabold font-mono">
                    #{scene.sceneNumber}
                  </div>
                </div>
              );
            })}
          </div>
          {onRetryFailed && (
            <button
              onClick={onRetryFailed}
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition shadow-md shadow-red-900/30"
            >
              {isDownloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Downloading Failed Images ({failedDownloadIds.length})
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Full Resolution Modal Preview */}
      {selectedPreviewImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setSelectedPreviewImg(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-2">
            <img
              src={selectedPreviewImg}
              alt="Preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
            />
            <div className="p-3 flex justify-end">
              <button
                onClick={() => setSelectedPreviewImg(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
