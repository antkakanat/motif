// ────────────────────────────────────────────────
// Motif Extension — Background Service Worker (MV3)
// ────────────────────────────────────────────────

// ⚠️ CHANGE TO DEV URL FOR LOCAL TESTING
const MOTIF_URL = 'https://motif.byant.dev'; // production
// const MOTIF_URL = 'http://localhost:5173'; // dev

// ── Context Menu Setup ──

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-quote',
    title: 'Save to Motif as Quote',
    contexts: ['selection']
  });
});

// ── Context Menu Handler ──

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-quote' && info.selectionText) {
    let description = '';
    let ogImage = '';
    let favicon = tab?.favIconUrl || '';

    if (tab && tab.id && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const getMeta = (name) => {
              return document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
                     document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
                     null;
            };
            return {
              description: getMeta('description') || getMeta('og:description') || '',
              ogImage: getMeta('og:image') || getMeta('twitter:image') || ''
            };
          }
        });
        if (results?.[0]?.result) {
          description = results[0].result.description || '';
          ogImage = results[0].result.ogImage || '';
        }
      } catch (err) {
        console.warn('Metadata extraction in context menu failed:', err);
      }
    }

    await openMotifInBackground({
      ext_type: 'quote',
      ext_url: tab?.url || '',
      ext_title: tab?.title || '',
      ext_text: info.selectionText,
      ext_favicon: favicon,
      ext_description: description,
      ext_image: ogImage
    });

    // Brief badge feedback (no popup for context menu actions)
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#5B4ED6' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
  }
});

// ── Message Handler (from popup.js) ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveLink') {
    openMotifInBackground({
      ext_type: 'link',
      ext_url: message.url,
      ext_title: message.title,
      ext_favicon: message.favicon,
      ext_description: message.description,
      ext_image: message.ogImage
    }).then(() => sendResponse({ success: true }));
    return true; // keep channel open for async response
  }

  if (message.action === 'openMotif') {
    openMotifFocused();
    sendResponse({ success: true });
  }
});

// ── Tab Management ──

async function openMotifInBackground(params) {
  // URL length guards
  if (params.ext_text && params.ext_text.length > 2000) {
    params.ext_text = params.ext_text.substring(0, 2000) + '…';
  }
  if (params.ext_url && params.ext_url.length > 1000) {
    params.ext_url = params.ext_url.substring(0, 1000);
  }
  if (params.ext_description && params.ext_description.length > 300) {
    params.ext_description = params.ext_description.substring(0, 300) + '…';
  }
  if (params.ext_image && params.ext_image.length > 500) {
    params.ext_image = params.ext_image.substring(0, 500);
  }
  if (params.ext_favicon && params.ext_favicon.length > 500) {
    params.ext_favicon = params.ext_favicon.substring(0, 500);
  }

  const query = new URLSearchParams(params).toString();
  const targetUrl = `${MOTIF_URL}/?${query}`;

  const [existingTab] = await chrome.tabs.query({
    url: `${MOTIF_URL}/*`
  });

  if (existingTab) {
    // Update existing tab in background (don't focus — user stays on current page)
    await chrome.tabs.update(existingTab.id, { url: targetUrl });
  } else {
    // Create new tab in background
    await chrome.tabs.create({ url: targetUrl, active: false });
  }
}

async function openMotifFocused() {
  const [existingTab] = await chrome.tabs.query({
    url: `${MOTIF_URL}/*`
  });

  if (existingTab) {
    await chrome.tabs.update(existingTab.id, { active: true });
    await chrome.windows.update(existingTab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: MOTIF_URL });
  }
}
