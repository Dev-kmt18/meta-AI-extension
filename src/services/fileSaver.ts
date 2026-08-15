let savedDirectoryHandle: any = null;

export const FileSaverService = {
  async selectDirectory(): Promise<{ success: boolean; folderName?: string; error?: string }> {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads'
        });
        savedDirectoryHandle = handle;
        return { success: true, folderName: handle.name };
      } else {
        return { success: false, error: 'Directory picker is not supported in this browser environment.' };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Folder selection cancelled.' };
      }
      return { success: false, error: err.message || 'Folder selection failed.' };
    }
  },

  getSavedFolderName(): string | undefined {
    return savedDirectoryHandle ? savedDirectoryHandle.name : undefined;
  },

  async saveImagesToDirectory(
    scenes: Scene[],
    pattern: 'number_only' | 'scene_num' | 'padded_num' = 'number_only',
    folderName: string = ''
  ): Promise<{ success: boolean; count: number; failedIds: string[]; error?: string }> {
    const selectedScenes = scenes.filter((s) => s.selected && s.imageUrl);

    if (selectedScenes.length === 0) {
      return { success: false, count: 0, failedIds: [], error: 'No scenes selected or no images available to download.' };
    }

    const cleanFolder = folderName.trim().replace(/[\\/:*?"<>|]/g, '');

    const getFileName = (index: number) => {
      const num = index + 1;
      const paddedNum = String(num).padStart(2, '0');
      let name = `${num}.png`;
      if (pattern === 'padded_num') name = `${paddedNum}.png`;
      if (pattern === 'scene_num') name = `scene-${paddedNum}.png`;
      return cleanFolder ? `${cleanFolder}/${name}` : name;
    };

    // If chrome.downloads API is available, download directly to Downloads/<folderName>/ without popup
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      return await this.chromeDownload(selectedScenes, getFileName);
    }

    // Web fallback using showDirectoryPicker or anchor click
    const failedIds: string[] = [];
    try {
      if ('showDirectoryPicker' in window) {
        let dirHandle = savedDirectoryHandle;
        if (!dirHandle) {
          dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' });
          savedDirectoryHandle = dirHandle;
        }

        // If folder name specified, create/get subfolder handle
        let targetHandle = dirHandle;
        if (cleanFolder) {
          targetHandle = await dirHandle.getDirectoryHandle(cleanFolder, { create: true });
        }

        let savedCount = 0;
        for (let i = 0; i < selectedScenes.length; i++) {
          const scene = selectedScenes[i];
          if (!scene.imageUrl) {
            failedIds.push(scene.id);
            continue;
          }

          const num = i + 1;
          const paddedNum = String(num).padStart(2, '0');
          let baseName = `${num}.png`;
          if (pattern === 'padded_num') baseName = `${paddedNum}.png`;
          if (pattern === 'scene_num') baseName = `scene-${paddedNum}.png`;

          try {
            const blob = await this.fetchImageBlob(scene.imageUrl);
            const fileHandle = await targetHandle.getFileHandle(baseName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            savedCount++;
          } catch (err) {
            console.error(`Failed to save ${baseName}:`, err);
            failedIds.push(scene.id);
          }
        }
        return { success: savedCount > 0, count: savedCount, failedIds };
      }
    } catch (err: any) {
      console.warn('Directory handle write failed, falling back to chrome download:', err);
    }

    return await this.chromeDownload(selectedScenes, getFileName);
  },

  async chromeDownload(
    selectedScenes: Scene[],
    getFileName: (index: number) => string
  ): Promise<{ success: boolean; count: number; failedIds: string[]; error?: string }> {
    let count = 0;
    const failedIds: string[] = [];
    for (let i = 0; i < selectedScenes.length; i++) {
      const scene = selectedScenes[i];
      if (!scene.imageUrl) {
        failedIds.push(scene.id);
        continue;
      }

      const fileName = getFileName(i);

      try {
        // Fetch image via background script (bypasses CDN CORS restrictions)
        let downloadUrl = scene.imageUrl!;
        let dataUrl: string | null = null;

        try {
          dataUrl = await this.fetchImageViaBackground(scene.imageUrl!);
          downloadUrl = dataUrl;
        } catch (fetchErr) {
          console.warn(`[FileSaver] Background fetch failed for ${fileName}, trying direct URL:`, fetchErr);
          // Try direct fetch as fallback
          try {
            const blob = await this.fetchImageBlob(scene.imageUrl!);
            const blobUrl = URL.createObjectURL(blob);
            downloadUrl = blobUrl;
          } catch (e2) {
            console.warn('[FileSaver] Direct fetch also failed, using raw URL');
          }
        }

        if (typeof chrome !== 'undefined' && chrome.downloads) {
          const downloadSuccess = await new Promise<boolean>((resolve) => {
            chrome.downloads.download(
              {
                url: downloadUrl,
                filename: fileName,
                saveAs: false,
                conflictAction: 'uniquify'
              },
              (downloadId) => {
                const err = chrome.runtime.lastError;
                if (err || !downloadId) {
                  console.error(`[FileSaver] chrome.downloads error for ${fileName}:`, err?.message || 'No download ID');
                  resolve(false);
                } else {
                  resolve(true);
                }
              }
            );
          });

          if (downloadSuccess) {
            count++;
          } else {
            failedIds.push(scene.id);
          }
          // Small delay between downloads to avoid overwhelming the browser
          await new Promise(r => setTimeout(r, 300));
        } else {
          // Fallback anchor click download
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          count++;
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (e) {
        console.error(`Download failed for ${fileName}`, e);
        failedIds.push(scene.id);
      }
    }

    return { success: count > 0, count, failedIds };
  },

  // Fetch image via background script (bypasses CORS for CDN URLs like scontent.fbcdn.net)
  async fetchImageViaBackground(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'FETCH_IMAGE_AS_BLOB', payload: { url } },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(new Error(err.message));
          if (response?.success && response.dataUrl) {
            resolve(response.dataUrl);
          } else {
            reject(new Error(response?.error || 'Background fetch failed'));
          }
        }
      );
    });
  },

  async fetchImageBlob(url: string): Promise<Blob> {
    if (url.startsWith('data:')) {
      const res = await fetch(url);
      return await res.blob();
    }
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    return await response.blob();
  }
};
