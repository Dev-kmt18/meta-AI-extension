import type { ChromeMessage } from '../types';

// Handle extension icon click to open side panel
chrome.action?.onClicked?.addListener(async (tab: chrome.tabs.Tab) => {
  if (tab.id) {
    try {
      await (chrome.sidePanel as any).open({ tabId: tab.id });
    } catch (err) {
      console.warn('Failed to open side panel:', err);
    }
  }
});

// Configure side panel behavior to open on meta.ai
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: any) => console.error(error));
}

// Listener for background messages
chrome.runtime.onMessage.addListener((message: ChromeMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'PONG', sender: 'background' });
    return true;
  }

  if (message.type === 'GET_TAB_STATUS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      const activeTab = tabs[0];
      const isMetaAi = !!(activeTab && activeTab.url && (activeTab.url.includes('meta.ai') || activeTab.url.includes('www.meta.ai')));
      sendResponse({ isMetaAi, tabId: activeTab?.id, tabUrl: activeTab?.url });
    });
    return true; // async response
  }

  // Fetch image from CDN URL (cross-origin) — sidepanel can't do this due to CORS
  if (message.type === 'FETCH_IMAGE_AS_BLOB') {
    const { url } = (message as any).payload || {};
    if (!url) {
      sendResponse({ success: false, error: 'No URL provided' });
      return true;
    }
    // Background service worker has broader network access
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        // Convert ArrayBuffer to base64 data URL
        const uint8 = new Uint8Array(buffer);
        let binary = '';
        uint8.forEach((b) => (binary += String.fromCharCode(b)));
        const base64 = btoa(binary);
        sendResponse({ success: true, dataUrl: `data:image/png;base64,${base64}` });
      })
      .catch((err) => {
        console.error('[BG] FETCH_IMAGE_AS_BLOB failed:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // keep channel open for async
  }
});
