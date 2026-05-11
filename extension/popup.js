// ────────────────────────────────────────────────
// Motif Extension — Popup Script
// ────────────────────────────────────────────────

const saveBtn = document.getElementById('save-btn');
const openBtn = document.getElementById('open-btn');

// ── Save This Page ──

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label">Saving…</span>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      saveBtn.innerHTML = '<span class="btn-label">Cannot save this page</span>';
      setTimeout(() => window.close(), 1500);
      return;
    }

    await chrome.runtime.sendMessage({
      action: 'saveLink',
      url: tab.url,
      title: tab.title || tab.url
    });

    // Success feedback
    saveBtn.classList.add('saved');
    saveBtn.innerHTML = '<span class="btn-label">✓ Saved</span>';
    setTimeout(() => window.close(), 1500);

  } catch (err) {
    console.error('Save failed:', err);
    saveBtn.innerHTML = '<span class="btn-label">Save failed</span>';
    saveBtn.disabled = false;
    setTimeout(() => {
      saveBtn.innerHTML = '<span class="btn-icon">🔗</span><span class="btn-label">Save This Page</span>';
    }, 2000);
  }
});

// ── Open Motif ──

openBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'openMotif' });
  window.close();
});
