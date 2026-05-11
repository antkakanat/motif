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
    await openMotifInBackground({
      ext_type: 'quote',
      ext_url: tab?.url || '',
      ext_title: tab?.title || '',
      ext_text: info.selectionText
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
      ext_title: message.title
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
