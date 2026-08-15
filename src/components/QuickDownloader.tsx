import React, { useState } from 'react';
import { RefreshCw, FolderDown, CheckCircle2, Hash, Layers, ListFilter, AlertCircle } from 'lucide-react';
import { FileSaverService } from '../services/fileSaver';

interface PageImage {
  id: string;
  src: string;
  alt?: string;
  pageIndex: number;
}

interface QuickDownloaderProps {
  activeMetaTabId?: number;
  fileNamePattern?: 'number_only' | 'scene_num' | 'padded_num';
  onPatternChange: (pattern: 'number_only' | 'scene_num' | 'padded_num') => void;
  injectContentScript: (tabId: number) => Promise<boolean>;
  ensureContentScript: (tabId: number) => Promise<boolean>;
}

export const QuickDownloader: React.FC<QuickDownloaderProps> = ({
  activeMetaTabId,
  fileNamePattern = 'number_only',
  onPatternChange,
  injectContentScript,
  ensureContentScript
}) => {
  const [images, setImages] = useState<PageImage[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [folderName, setFolderName] = useState<string>('');
  const [failedImageIds, setFailedImageIds] = useState<string[]>([]);

  // Range selection state
  const [rangeFrom, setRangeFrom] = useState<string>('');
  const [rangeTo, setRangeTo] = useState<string>('');

  // Scan Meta AI page for all available images + inject visual badges
  const handleScanPage = async () => {
    if (!activeMetaTabId) {
      setStatusMsg('Please open or focus Meta AI tab first.');
      return;
    }
    setIsScanning(true);
    setStatusMsg(undefined);
    setSelectedOrder([]);

    try {
      await injectContentScript(activeMetaTabId);
      await ensureContentScript(activeMetaTabId);

      chrome.tabs.sendMessage(
        activeMetaTabId,
        { type: 'SCAN_PAGE_IMAGES' },
        (res) => {
          setIsScanning(false);
          if (chrome.runtime.lastError || !res || !res.success) {
            setStatusMsg('Could not fetch images from Meta AI page. Try refreshing Meta AI tab.');
            return;
          }

          if (res.images && res.images.length > 0) {
            setImages(res.images);
            setSelectedOrder([]);
            setStatusMsg(`Found ${res.images.length} images. Numbers are shown on the Meta AI page. Use range or click to select.`);
          } else {
            setImages([]);
            setStatusMsg('No generated images found on current Meta AI page.');
          }
        }
      );
    } catch (e: any) {
      setIsScanning(false);
      setStatusMsg('Error scanning tab: ' + (e.message || String(e)));
    }
  };

  // Apply Range selection (e.g. 44 to 60)
  const handleApplyRange = () => {
    if (images.length === 0) {
      setStatusMsg('Please scan the page first before applying a range.');
      return;
    }
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);
    if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
      setStatusMsg(`Enter valid numbers. From must be ≥ 1 and To must be ≥ From. Images on this page: #1 – #${images.length}.`);
      return;
    }
    const inRange = images.filter((img) => img.pageIndex >= from && img.pageIndex <= to);
    if (inRange.length === 0) {
      setStatusMsg(`No images found in range #${from}–#${to}. Page has images #1–#${images.length}. Check your numbers!`);
      return;
    }
    setSelectedOrder(inRange.map((img) => img.id));
    setStatusMsg(`✅ Selected ${inRange.length} images (#${from} to #${to}). Click Download to save them.`);
  };

  // Toggle individual image click selection
  const handleImageClick = (id: string) => {
    setSelectedOrder((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleClearSelection = () => setSelectedOrder([]);
  const handleSelectAll = () => setSelectedOrder(images.map((img) => img.id));

  // Download in the order images are sequenced (by pageIndex in range order)
  const handleDownloadInOrder = async () => {
    if (selectedOrder.length === 0) return;
    setIsSaving(true);
    setStatusMsg(undefined);
    setFailedImageIds([]);

    try {
      // Sort selected images by their pageIndex so save order is always sequential
      const orderedScenes = selectedOrder
        .map((id) => images.find((img) => img.id === id))
        .filter(Boolean)
        .sort((a, b) => a!.pageIndex - b!.pageIndex)
        .map((img, index) => ({
          id: img!.id,
          sceneNumber: index + 1,
          scriptExcerpt: `Image ${img!.pageIndex}`,
          prompt: `Image ${img!.pageIndex}`,
          imageUrl: img!.src,
          status: 'completed' as const,
          selected: true
        }));

      const res = await FileSaverService.saveImagesToDirectory(orderedScenes, fileNamePattern, folderName);
      if (res.success) {
        const targetPath = folderName.trim() ? `Downloads/${folderName.trim()}/` : 'Downloads/';
        if (res.failedIds && res.failedIds.length > 0) {
          setFailedImageIds(res.failedIds);
          setStatusMsg(`⚠️ Saved ${res.count} images, but ${res.failedIds.length} failed to download. See below to retry.`);
        } else {
          setStatusMsg(`✅ Saved ${res.count} images to "${targetPath}"`);
        }
      } else {
        setStatusMsg(res.error || 'Download failed.');
        if (res.failedIds && res.failedIds.length > 0) {
          setFailedImageIds(res.failedIds);
        }
      }
    } catch (e: any) {
      setStatusMsg('Download failed: ' + (e.message || String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  // Retry downloading ONLY failed images
  const handleRetryFailedDownloads = async () => {
    if (failedImageIds.length === 0) return;
    setIsSaving(true);
    setStatusMsg(undefined);

    const retryIds = [...failedImageIds];
    try {
      const orderedScenes = retryIds
        .map((id) => images.find((img) => img.id === id))
        .filter(Boolean)
        .sort((a, b) => a!.pageIndex - b!.pageIndex)
        .map((img, index) => ({
          id: img!.id,
          sceneNumber: index + 1,
          scriptExcerpt: `Image ${img!.pageIndex}`,
          prompt: `Image ${img!.pageIndex}`,
          imageUrl: img!.src,
          status: 'completed' as const,
          selected: true
        }));

      const res = await FileSaverService.saveImagesToDirectory(orderedScenes, fileNamePattern, folderName);
      if (res.success) {
        const targetPath = folderName.trim() ? `Downloads/${folderName.trim()}/` : 'Downloads/';
        const newFailedIds = res.failedIds || [];
        setFailedImageIds(newFailedIds);
        if (newFailedIds.length > 0) {
          setStatusMsg(`⚠️ Saved ${res.count} retried images, but ${newFailedIds.length} failed again.`);
        } else {
          setStatusMsg(`✅ All failed images successfully saved to "${targetPath}"!`);
        }
      } else {
        setStatusMsg(res.error || 'Retry failed.');
        if (res.failedIds && res.failedIds.length > 0) {
          setFailedImageIds(res.failedIds);
        }
      }
    } catch (e: any) {
      setStatusMsg('Retry failed: ' + (e.message || String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Quick Image Downloader
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Scan → Numbers appear on Meta AI page → Select range or click → Download
          </p>
        </div>
        <button
          onClick={handleScanPage}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Scan Images'}
        </button>
      </div>

      {/* Folder Name Input */}
      <div className="flex items-center gap-2 p-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl">
        <FolderDown className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-slate-300 text-xs font-medium shrink-0">Save to:</span>
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="Folder name (e.g. school-video, reel-44)"
          className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-semibold"
        />
      </div>

      {/* Naming Format */}
      <div className="flex items-center gap-2 p-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl">
        <span className="text-slate-300 text-xs font-medium shrink-0">Name Format:</span>
        <select
          value={fileNamePattern}
          onChange={(e) => onPatternChange(e.target.value as any)}
          className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
        >
          <option value="number_only">1.png, 2.png, 3.png</option>
          <option value="padded_num">01.png, 02.png, 03.png</option>
          <option value="scene_num">scene-01.png, scene-02.png</option>
        </select>
      </div>

      {/* Status Message */}
      {statusMsg && (
        <div className="p-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-300 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Range Selector — shown only after scan */}
      {images.length > 0 && (
        <div className="space-y-3">
          {/* Range Input Row */}
          <div className="p-3 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">Select by Range</span>
              <span className="text-[10px] text-slate-500 ml-auto">
                Total: {images.length} images (#1 – #{images.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">From #</span>
              <input
                type="number"
                min={1}
                max={images.length}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                placeholder="1"
                className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
              />
              <span className="text-xs text-slate-400 shrink-0">To #</span>
              <input
                type="number"
                min={1}
                max={images.length}
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                placeholder={String(images.length)}
                className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleApplyRange}
                className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition"
              >
                Apply Range
              </button>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              Selected: <strong className="text-emerald-400">{selectedOrder.length}</strong> / {images.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-[11px] font-medium text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-600/60 transition"
              >
                Select All
              </button>
              {selectedOrder.length > 0 && (
                <button
                  onClick={handleClearSelection}
                  className="text-[11px] font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/20 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
            {images.map((img) => {
              const isSelected = selectedOrder.includes(img.id);
              return (
                <div
                  key={img.id}
                  onClick={() => handleImageClick(img.id)}
                  className={`group relative bg-slate-900 border-2 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 aspect-square ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20'
                      : 'border-slate-700/70 opacity-60 hover:opacity-100 hover:border-slate-500'
                  }`}
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-full object-cover"
                  />
                  {/* Page Index Number Badge */}
                  <div className={`absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-md font-mono ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-black/70 text-slate-200'
                  }`}>
                    <Hash className="w-2.5 h-2.5" />
                    {img.pageIndex}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Failed Downloads Section */}
          {failedImageIds.length > 0 && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-2.5 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
                <span className="text-xs font-bold text-red-200">
                  {failedImageIds.length} Image(s) Failed to Download
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                {failedImageIds.map((id) => {
                  const img = images.find((i) => i.id === id);
                  if (!img) return null;
                  return (
                    <div key={id} className="relative w-8 h-8 rounded border border-red-500/20 overflow-hidden bg-slate-900 group">
                      <img src={img.src} className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[9px] text-red-300 font-extrabold font-mono">
                        #{img.pageIndex}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleRetryFailedDownloads}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition shadow-md shadow-red-900/30"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Downloading Failed Images ({failedImageIds.length})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownloadInOrder}
            disabled={selectedOrder.length === 0 || isSaving}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm shadow-xl transition-all duration-200 ${
              selectedOrder.length === 0 || isSaving
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FolderDown className="w-4 h-4" />
                Download {selectedOrder.length} Images Sequentially
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
