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

// ─── Force clear the Lexical editor / input box completely ───
function clearInputBox(inputEl: HTMLElement) {
  inputEl.focus();
  try {
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch (e) { /* ignore */ }

  if (inputEl.isContentEditable) {
    inputEl.innerHTML = '<p><br></p>';
  } else if (inputEl instanceof HTMLTextAreaElement) {
    inputEl.value = '';
  }

  try {
    document.execCommand('selectAll', false, undefined);
    document.execCommand('delete', false, undefined);
  } catch (e) { /* ignore */ }
}

// ─── Type text into the chat input using execCommand insertText or events ───
async function typeIntoInput(inputEl: HTMLElement, text: string): Promise<boolean> {
  // Clear any existing text first to avoid appending to unsent prompts
  clearInputBox(inputEl);
  await sleep(100);

  // Approach 1: execCommand insertText (most reliable & synchronous for rich contenteditable)
  try {
    const success = document.execCommand('insertText', false, text);
    const val = (inputEl.textContent || '').trim();
    if (success && val.length > 0) {
      console.log('[MAISG] execCommand insertText succeeded');
      return true;
    }
  } catch (e) {
    console.warn('[MAISG] execCommand insertText failed:', e);
  }

  // Approach 2: Direct DOM set + Dispatch Input Events (Lexical compatible fallback)
  try {
    if (inputEl.isContentEditable) {
      inputEl.innerHTML = `<p>${text}</p>`;
    } else if (inputEl instanceof HTMLTextAreaElement) {
      inputEl.value = text;
    }
    inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
    inputEl.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, composed: true, cancelable: true }));
    inputEl.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true, composed: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    
    const val = (inputEl.textContent || '').trim();
    if (val.length > 0) {
      console.log('[MAISG] Direct DOM set + events succeeded');
      return true;
    }
  } catch (e) {
    console.warn('[MAISG] Direct DOM set failed:', e);
  }

  // Approach 3: Clipboard paste as last resort
  try {
    await navigator.clipboard.writeText(text);
    document.execCommand('paste');
    await sleep(200);
    const val = (inputEl.textContent || '').trim();
    if (val.length > 0) {
      console.log('[MAISG] Clipboard paste succeeded');
      return true;
    }
  } catch (e) {
    console.warn('[MAISG] Clipboard paste failed:', e);
  }

  return false;
}

// ─── Find and click the send/submit button ───
function findAndClickSubmit(inputEl: HTMLElement): boolean {
  // Dispatch Enter key event first
  try {
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    inputEl.dispatchEvent(new KeyboardEvent('keydown', opts));
    inputEl.dispatchEvent(new KeyboardEvent('keypress', opts));
    inputEl.dispatchEvent(new KeyboardEvent('keyup', opts));
  } catch (e) { /* ignore */ }

  // Walk up from the input to find the closest send button
  let container: HTMLElement | null = inputEl;
  for (let i = 0; i < 10; i++) {
    container = container?.parentElement || null;
    if (!container) break;

    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    for (const btn of buttons) {
      if (btn.disabled || btn.offsetWidth === 0) continue;

      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const className = (btn.className || '').toLowerCase();

      // Skip attachment/media buttons
      const isExclude = ['attach', 'upload', 'file', 'image', 'media', 'voice', 'audio', 'mic', 'document', 'photo', 'camera', 'plus', 'add'].some(
        term => ariaLabel.includes(term) || title.includes(term) || className.includes(term)
      );
      if (isExclude) continue;

      // Match send/submit buttons (Meta AI's send button is blue circular button with upward arrow)
      const style = window.getComputedStyle(btn);
      const isBlueBtn = style.backgroundColor.includes('rgb(0,') || style.backgroundColor.includes('rgb(24,') || style.backgroundColor.includes('rgb(10,') || style.backgroundColor.includes('rgb(59,');

      if (
        ariaLabel.includes('send') ||
        ariaLabel.includes('submit') ||
        title.includes('send') ||
        title.includes('submit') ||
        isBlueBtn ||
        (btn.querySelector('svg') && btn.offsetWidth < 60)
      ) {
        console.log('[MAISG] Found send button, clicking:', ariaLabel || className);
        btn.click();
        return true;
      }
    }
  }

  // Broad fallback
  const allButtons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
  for (const btn of allButtons) {
    if (btn.disabled || btn.offsetWidth === 0) continue;
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const title = (btn.getAttribute('title') || '').toLowerCase();
    const className = (btn.className || '').toLowerCase();
    
    const isExclude = ['attach', 'upload', 'file', 'image', 'media', 'voice', 'audio', 'mic', 'document', 'photo', 'camera', 'plus', 'add'].some(
      term => ariaLabel.includes(term) || title.includes(term) || className.includes(term)
    );
    if (isExclude) continue;

    if (ariaLabel.includes('send') || ariaLabel.includes('submit') || title.includes('send')) {
      console.log('[MAISG] Fallback send button found:', ariaLabel);
      btn.click();
      return true;
    }
  }

  return true;
}

// ─── Get existing large image URLs currently on the page ───
function getExistingLargeImageUrls(): Set<string> {
  const urls = new Set<string>();
  const imgEls = Array.from(document.querySelectorAll('img'));
  for (const img of imgEls) {
    if (img.width >= 150 && img.height >= 150 && img.src && !img.src.includes('emoji') && !img.src.includes('avatar')) {
      urls.add(img.src);
    }
  }
  return urls;
}

// ─── Find the newly generated image on the page ───
function findNewGeneratedImage(existingUrls: Set<string>): string | null {
  const allImages = Array.from(document.querySelectorAll('img')).reverse();
  for (const img of allImages) {
    if (img.width >= 150 && img.height >= 150 && img.src && !img.src.includes('emoji') && !img.src.includes('avatar')) {
      if (!existingUrls.has(img.src)) {
        return img.src;
      }
    }
  }
  // Check for any new large images by source format as fallback
  for (const img of allImages) {
    const src = img.src || '';
    if (
      (src.includes('scontent') || src.includes('fbcdn') || src.startsWith('blob:') || src.startsWith('data:image')) &&
      img.width >= 150 && img.height >= 150
    ) {
      if (!existingUrls.has(src)) {
        return src;
      }
    }
  }
  return null;
}

// ─── Check for Meta AI error state (e.g. Request was stopped) ───
function checkMetaAiErrorState(): string | null {
  const bodyText = document.body.innerText || '';
  if (bodyText.includes('Request was stopped')) {
    return 'Meta AI stopped the request ("Request was stopped"). Please try changing the style or simplifying the prompt.';
  }
  if (bodyText.includes("Can't generate image") || bodyText.includes("Unable to generate image")) {
    return "Meta AI was unable to generate an image for this prompt.";
  }
  return null;
}

// ─── Wait for a new image to appear (MutationObserver + polling) ───
async function waitForNewImage(existingUrls: Set<string>, timeoutMs = 90000): Promise<string> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    console.log('[MAISG] Watching for new image generation... (existing count:', existingUrls.size, ')');

    const poll = setInterval(() => {
      // Check for Meta AI error state (e.g. Request was stopped)
      const errorMsg = checkMetaAiErrorState();
      if (errorMsg) {
        clearInterval(poll);
        obs.disconnect();
        console.warn('[MAISG] Meta AI error detected:', errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      const newImgUrl = findNewGeneratedImage(existingUrls);
      if (newImgUrl) {
        clearInterval(poll);
        obs.disconnect();
        console.log('[MAISG] New image detected via polling:', newImgUrl);
        resolve(newImgUrl);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(poll);
        obs.disconnect();
        reject(new Error('Timed out waiting for image generation (90s).'));
      }
    }, 2000);

    const obs = new MutationObserver(() => {
      const errorMsg = checkMetaAiErrorState();
      if (errorMsg) {
        clearInterval(poll);
        obs.disconnect();
        console.warn('[MAISG] Meta AI error detected:', errorMsg);
        reject(new Error(errorMsg));
        return;
      }

      const newImgUrl = findNewGeneratedImage(existingUrls);
      if (newImgUrl) {
        clearInterval(poll);
        obs.disconnect();
        console.log('[MAISG] New image detected via MutationObserver:', newImgUrl);
        resolve(newImgUrl);
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

        // Step 2: Record existing image URLs to avoid matching old images
        const existingUrls = getExistingLargeImageUrls();

        // Step 3: Type the prompt text
        const typed = await typeIntoInput(inputEl, prompt);
        if (!typed) {
          throw new Error('Failed to type text into Meta AI chat input.');
        }
        await sleep(600);

        // Step 4: Submit the prompt
        const clicked = findAndClickSubmit(inputEl);
        if (!clicked) {
          console.warn('[MAISG] Send button click simulation did not match a standard button.');
        }
        await sleep(1500);

        // Step 5: Wait for image generation
        const imageUrl = await waitForNewImage(existingUrls, 90000);
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
