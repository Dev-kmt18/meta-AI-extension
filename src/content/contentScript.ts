import type { ChromeMessage } from '../types';

console.log('[Meta AI Scene Generator] Content script loaded on Meta AI.');

// ─── Find the chat input box ───
function getChatInput(): HTMLElement | null {
  // Meta AI uses a contenteditable div inside their chat composer
  const candidates = [
    ...Array.from(document.querySelectorAll('div[contenteditable="true"]')),
    ...Array.from(document.querySelectorAll('[role="textbox"]')),
    ...Array.from(document.querySelectorAll('textarea')),
  ] as HTMLElement[];

  for (const el of candidates) {
    if (el.offsetWidth > 50 && el.offsetHeight > 10) {
      console.log('[MAISG] Found chat input:', el.tagName, el.className);
      return el;
    }
  }
  return null;
}

// ─── Type text into the chat input using clipboard paste (most reliable for React/Lexical) ───
async function typeIntoInput(inputEl: HTMLElement, text: string): Promise<boolean> {
  inputEl.focus();
  await sleep(100);

  // Approach 1: Use Clipboard API to paste (works best with Lexical editors)
  try {
    // Select all existing text first
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    selection?.removeAllRanges();
    selection?.addRange(range);
    await sleep(50);

    // Write to clipboard then paste
    await navigator.clipboard.writeText(text);
    document.execCommand('paste');
    await sleep(200);

    const currentText = inputEl.textContent || (inputEl as any).value || '';
    if (currentText.trim().length > 0) {
      console.log('[MAISG] Clipboard paste succeeded');
      return true;
    }
  } catch (e) {
    console.warn('[MAISG] Clipboard paste failed:', e);
  }

  // Approach 2: execCommand insertText
  try {
    inputEl.focus();
    // Clear existing
    document.execCommand('selectAll', false, undefined);
    document.execCommand('delete', false, undefined);
    await sleep(50);

    const success = document.execCommand('insertText', false, text);
    if (success) {
      console.log('[MAISG] execCommand insertText succeeded');
      return true;
    }
  } catch (e) {
    console.warn('[MAISG] execCommand insertText failed:', e);
  }

  // Approach 3: Simulate key-by-key input events (synthetic typing)
  try {
    inputEl.focus();
    inputEl.textContent = '';
    await sleep(50);

    // Set via innerHTML for contenteditable
    if (inputEl.isContentEditable) {
      inputEl.innerHTML = `<p>${text}</p>`;
    } else if (inputEl instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(inputEl, text);
      else inputEl.value = text;
    }

    // Fire React-compatible synthetic events
    inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
    inputEl.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, composed: true, cancelable: true }));
    inputEl.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true, composed: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    console.log('[MAISG] Direct DOM set + synthetic events dispatched');
    return true;
  } catch (e) {
    console.warn('[MAISG] Direct DOM set failed:', e);
  }

  return false;
}

// ─── Find and click the send/submit button ───
function findAndClickSubmit(inputEl: HTMLElement): boolean {
  // Walk up from the input to find the closest send button
  let container: HTMLElement | null = inputEl;
  for (let i = 0; i < 10; i++) {
    container = container?.parentElement || null;
    if (!container) break;

    // Look for buttons with SVG icons (Meta AI's send button is usually a circular icon button)
    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    for (const btn of buttons) {
      if (btn.disabled || btn.offsetWidth === 0) continue;

      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const textContent = (btn.textContent || '').toLowerCase().trim();

      // Match send/submit buttons
      if (
        ariaLabel.includes('send') ||
        ariaLabel.includes('submit') ||
        title.includes('send') ||
        title.includes('submit') ||
        // Meta AI send button has no text, just an SVG icon - look for small icon buttons near the input
        (btn.querySelector('svg') && btn.offsetWidth < 60 && textContent === '')
      ) {
        console.log('[MAISG] Found send button:', btn.ariaLabel || btn.className);
        btn.click();
        return true;
      }
    }
  }

  // Broad fallback: any visible button with SVG near bottom of page
  const allButtons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
  for (const btn of allButtons) {
    if (btn.disabled || btn.offsetWidth === 0) continue;
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes('send') || ariaLabel.includes('submit')) {
      console.log('[MAISG] Fallback send button found:', ariaLabel);
      btn.click();
      return true;
    }
  }

  // Last resort: Enter key
  console.log('[MAISG] Dispatching Enter key as last resort submit');
  const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  inputEl.dispatchEvent(new KeyboardEvent('keydown', opts));
  inputEl.dispatchEvent(new KeyboardEvent('keypress', opts));
  inputEl.dispatchEvent(new KeyboardEvent('keyup', opts));
  return true;
}

// ─── Count all images currently on the page ───
function countImages(): number {
  return document.querySelectorAll('img').length;
}

// ─── Find the newest large image on the page ───
function findNewestLargeImage(): string | null {
  const allImages = Array.from(document.querySelectorAll('img')).reverse();
  for (const img of allImages) {
    if (img.width >= 150 && img.height >= 150 && img.src && !img.src.includes('emoji') && !img.src.includes('avatar')) {
      return img.src;
    }
  }
  // Also check for any new large images by src pattern
  for (const img of allImages) {
    const src = img.src || '';
    if (
      src.includes('scontent') ||
      src.includes('fbcdn') ||
      src.startsWith('blob:') ||
      src.startsWith('data:image')
    ) {
      return src;
    }
  }
  return null;
}

// ─── Wait for a new image to appear (MutationObserver + polling) ───
async function waitForNewImage(initialImgCount: number, timeoutMs = 90000): Promise<string> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    console.log('[MAISG] Watching for new image generation... (initial count:', initialImgCount, ')');

    const poll = setInterval(() => {
      const currentCount = countImages();
      if (currentCount > initialImgCount) {
        const url = findNewestLargeImage();
        if (url) {
          clearInterval(poll);
          obs.disconnect();
          console.log('[MAISG] New image detected via polling:', url);
          resolve(url);
          return;
        }
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(poll);
        obs.disconnect();
        // Try one last time
        const fallback = findNewestLargeImage();
        if (fallback) {
          console.log('[MAISG] Timeout but found a fallback image:', fallback);
          resolve(fallback);
        } else {
          reject(new Error('Timed out waiting for image generation (90s).'));
        }
      }
    }, 2000);

    const obs = new MutationObserver(() => {
      const currentCount = countImages();
      if (currentCount > initialImgCount) {
        const url = findNewestLargeImage();
        if (url) {
          clearInterval(poll);
          obs.disconnect();
          console.log('[MAISG] New image detected via MutationObserver:', url);
          resolve(url);
        }
      }
    });

    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
  });
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Message handler ───
chrome.runtime.onMessage.addListener((message: ChromeMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'PONG', url: window.location.href });
    return true;
  }

  if (message.type === 'SCAN_PAGE_IMAGES') {
    const images: { src: string; alt?: string; id: string; pageIndex: number }[] = [];
    const imgEls = Array.from(document.querySelectorAll('img'));
    let idx = 1;

    for (const img of imgEls) {
      if (img.width >= 100 && img.height >= 100 && img.src && !img.src.includes('emoji') && !img.src.includes('avatar') && !img.src.includes('icon')) {
        const pageIdx = idx++;
        images.push({
          id: `page-img-${pageIdx}-${Date.now()}`,
          src: img.src,
          alt: img.alt || `Meta AI Image ${pageIdx}`,
          pageIndex: pageIdx
        });

        // Add visual badge floating on the Meta AI page over the image
        try {
          const parent = img.parentElement;
          if (parent && !parent.querySelector('.meta-img-badge-num')) {
            if (getComputedStyle(parent).position === 'static') {
              parent.style.position = 'relative';
            }
            const badge = document.createElement('div');
            badge.className = 'meta-img-badge-num';
            badge.textContent = `#${pageIdx}`;
            badge.style.cssText = `
              position: absolute;
              top: 10px;
              left: 10px;
              background: #059669;
              color: #ffffff;
              font-size: 14px;
              font-weight: 900;
              font-family: monospace;
              padding: 4px 10px;
              border-radius: 20px;
              z-index: 99999;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
              border: 2px solid #ffffff;
              pointer-events: none;
            `;
            parent.appendChild(badge);
          }
        } catch (e) {
          /* ignore badge DOM insert error */
        }
      }
    }

    sendResponse({ success: true, images });
    return true;
  }

  if (message.type === 'SEND_PROMPT_TO_META') {
    const { prompt } = message.payload;
    console.log('[MAISG] === RECEIVED PROMPT ===', prompt.substring(0, 80) + '...');

    (async () => {
      try {
        // Step 1: Find the input element
        const inputEl = getChatInput();
        if (!inputEl) {
          throw new Error('Meta AI chat input not found. Make sure you are on meta.ai with the chat open.');
        }

        // Step 2: Record current image count
        const initialImgCount = countImages();

        // Step 3: Type the prompt text
        const typed = await typeIntoInput(inputEl, prompt);
        if (!typed) {
          throw new Error('Failed to type text into Meta AI chat input.');
        }
        await sleep(600);

        // Step 4: Submit the prompt
        findAndClickSubmit(inputEl);
        await sleep(1500);

        // Step 5: Wait for image generation
        const imageUrl = await waitForNewImage(initialImgCount, 90000);
        console.log('[MAISG] === SUCCESS === Image URL:', imageUrl);

        sendResponse({ success: true, imageUrl });
      } catch (err: any) {
        console.error('[MAISG] === FAILED ===', err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();

    return true; // keep message channel open
  }
});
