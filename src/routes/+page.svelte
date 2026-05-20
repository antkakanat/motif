<script lang="ts">
  import { t } from '$lib/i18n';
  import { nonTrashedCaptures, addCapture, softDeleteCapture, updateCapture, type CreateCaptureInput } from '$lib/stores/captures';
  import { search, type SearchResult } from '$lib/search';
  import { clearSelection, selectAll } from '$lib/stores/selection';
  import CaptureCard from '$lib/components/CaptureCard.svelte';
  import BulkActionBar from '$lib/components/BulkActionBar.svelte';
  import CaptureModal from '$lib/components/CaptureModal.svelte';
  import type { CaptureType, CaptureStatus, Capture } from '$lib/db';
  import { registerShortcuts } from '$lib/shortcuts';
  import { startOnboarding } from '$lib/onboarding';
  import { settings, setAutoAiSearch } from '$lib/stores/settings';
  import { showToast } from '$lib/stores/toast';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { requestProFeature } from '$lib/pro';
  import {
    modelLoadingState,
    downloadProgress,
    backfillProgress,
    isBackfilling,
    cancelBackfill,
    semanticSearchQuery
  } from '$lib/stores/semanticSearch';

  let showModal = $state(false);
  let searchQuery = $state('');
  let filterType = $state<CaptureType | 'all'>('all');
  let filterStatus = $state<CaptureStatus | 'all' | 'active'>('active');
  let searchResults = $state<SearchResult[]>([]);
  let initialModalData = $state<any>(null);
  let editingCapture = $state<Capture | null>(null);
  let lastHandledParamSignature = $state('');

  let isAiSearchActive = $state(false);
  let showAiOptInModal = $state(false);
  let aiSearchScores = $state<Record<string, number>>({});

  function openNewCapture() {
    editingCapture = null;
    initialModalData = null;
    showModal = true;
  }

  function openEditModal(capture: Capture) {
    editingCapture = capture;
    initialModalData = {
      type: capture.type,
      title: capture.title,
      content: capture.content,
      sourceUrl: capture.sourceUrl ?? '',
      collectionId: capture.collectionId ?? null,
      tags: [...capture.tags],
      id: capture.id,
      ocrText: capture.ocrText,
      ocrStatus: capture.ocrStatus
    };
    showModal = true;
  }

  async function handleCardOpen(capture: Capture) {
    if (capture.type === 'link') {
      const allowed = await requestProFeature('readingView', 'Reading View');
      if (!allowed) return;
      void goto(`/read/${capture.id}`);
      return;
    }
    openEditModal(capture);
  }

  function handleRouteParams() {
    const statusParam = $page.url.searchParams.get('status');
    const openNewCaptureParam = $page.url.searchParams.get('new') === '1';
    const focusSearch = $page.url.searchParams.get('focus') === 'search';
    const signature = `${statusParam ?? ''}|${openNewCaptureParam}|${focusSearch}`;
    if (signature === lastHandledParamSignature) return;
    lastHandledParamSignature = signature;

    if (statusParam === 'archived' || statusParam === 'saved' || statusParam === 'unread' || statusParam === 'all' || statusParam === 'active') {
      filterStatus = statusParam;
    }

    if (openNewCaptureParam) {
      openNewCapture();
    }

    if (focusSearch) {
      requestAnimationFrame(() => {
        document.getElementById('search-input')?.focus();
      });
    }

    if (statusParam || openNewCaptureParam || focusSearch) {
      void goto('/', { replaceState: true });
    }
  }

  // Register shortcuts + start onboarding for new users
  onMount(() => {
    registerShortcuts([
      { key: 'k', label: 'New Capture', description: 'Open capture modal', ctrlOrCmd: true, handler: () => openNewCapture() },
      { key: 'f', label: 'Search', description: 'Focus search', ctrlOrCmd: true, handler: () => document.getElementById('search-input')?.focus() },
      { key: 'A', label: 'Select All', description: 'Select all visible', shift: true, handler: () => selectAll(visibleIds) },
      { key: 'Escape', label: 'Close/Clear', description: 'Close modal or clear selection', ctrlOrCmd: false, handler: () => { 
        if (showModal) showModal = false;
        else clearSelection();
      }}
    ]);
    // Start onboarding tour for new users (no-op if already done)
    if (!$settings.onboardingDone) {
      void startOnboarding();
    }

    // ── Handle Browser Extension params (auto-save, no modal) ──
    const extType = $page.url.searchParams.get('ext_type');
    if (extType) {
      const extUrl = $page.url.searchParams.get('ext_url') || '';
      const extTitle = $page.url.searchParams.get('ext_title') || '';
      const extText = $page.url.searchParams.get('ext_text') || '';
      void handleExtensionCapture(extType, extUrl, extTitle, extText);
      return; // skip Share Target handling
    }

    // ── Handle Share Target API params (show modal) ──
    const shareUrl = $page.url.searchParams.get('url');
    const shareTitle = $page.url.searchParams.get('title');
    const shareText = $page.url.searchParams.get('text');

    if (shareUrl || shareTitle || shareText) {
      initialModalData = {
        type: shareUrl ? 'link' : 'note',
        title: shareTitle || '',
        content: shareUrl || shareText || '',
      };
      editingCapture = null;
      showModal = true;
      // Clear URL params
      void goto('/', { replaceState: true });
      return;
    }

    handleRouteParams();
  });

  $effect(() => {
    $page.url.search;
    handleRouteParams();
  });

  // ── Extension capture auto-save ──
  async function handleExtensionCapture(type: string, url: string, title: string, text: string) {
    try {
      const captureType: CaptureType = type === 'quote' ? 'quote' : 'link';

      // Title priority for extension captures:
      // 1. Page title from extension (ext_title)
      // 2. Hostname from URL
      // 3. "Untitled"
      let displayTitle = title;
      if (!displayTitle && url) {
        try {
          displayTitle = new URL(url).hostname.replace('www.', '');
        } catch {
          displayTitle = url;
        }
      }

      await addCapture({
        type: captureType,
        title: displayTitle || 'Untitled',
        content: captureType === 'quote' ? text : url,
        sourceUrl: captureType === 'quote' ? url : undefined,
      });

      showToast(captureType === 'quote' ? '✓ Quote saved from extension' : '✓ Link saved from extension');
    } catch (err) {
      console.error('Extension capture failed:', err);
      showToast('Failed to save capture');
    }

    // Clear extension params from URL
    void goto('/', { replaceState: true });
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      searchResults = [];
      aiSearchScores = {};
      return;
    }

    if (isAiSearchActive && $settings.autoAiSearch && $modelLoadingState === 'ready') {
      const results = await semanticSearchQuery(query);
      searchResults = results.map(r => ({ id: r.id, score: r.score }));
      const scoresMap: Record<string, number> = {};
      for (const r of results) {
        scoresMap[r.id] = r.score;
      }
      aiSearchScores = scoresMap;
    } else {
      searchResults = search(query);
      aiSearchScores = {};
    }
  }

  async function toggleAiSearch() {
    if (!$settings.autoAiSearch) {
      showAiOptInModal = true;
      return;
    }
    isAiSearchActive = !isAiSearchActive;
    await handleSearch();
  }

  // Watch settings & loading state to auto-activate semantic search
  $effect(() => {
    if ($settings.autoAiSearch && $modelLoadingState === 'ready') {
      isAiSearchActive = true;
    }
  });

  // Compute displayed captures
  let displayedCaptures = $derived.by(() => {
    let items = $nonTrashedCaptures;

    // Apply search filter (empty result set must not fall through to full list)
    if (searchQuery.trim()) {
      if (searchResults.length === 0) {
        items = [];
      } else {
        const ids = new Set(searchResults.map(r => r.id));
        items = items.filter(c => ids.has(c.id));
        items.sort((a, b) => {
          const sa = searchResults.find(r => r.id === a.id)?.score ?? 0;
          const sb = searchResults.find(r => r.id === b.id)?.score ?? 0;
          return sb - sa;
        });
      }
    }

    // Apply type filter
    if (filterType !== 'all') {
      items = items.filter(c => c.type === filterType);
    }

    // Default "active" view behaves like an inbox: archived is hidden unless explicitly requested.
    if (filterStatus === 'active') {
      items = items.filter(c => c.status !== 'archived');
    } else if (filterStatus === 'all') {
      // Intentionally include archived in "all" to match the filter label semantics.
      items = items;
    } else {
      items = items.filter(c => c.status === filterStatus);
    }

    return items;
  });

  let visibleIds = $derived(displayedCaptures.map(c => c.id));

  async function handleSave(data: any) {
    if (editingCapture) {
      await updateCapture(editingCapture.id, {
        type: data.type,
        title: data.title,
        content: data.content,
        tags: data.tags,
        sourceUrl: data.sourceUrl || null,
        collectionId: data.collectionId ?? null,
        ocrText: data.ocrText,
        ocrStatus: data.ocrStatus
      });
      editingCapture = null;
      initialModalData = null;
      return;
    }

    await addCapture(data as CreateCaptureInput);
  }

  async function handleDelete(id: string) {
    await softDeleteCapture(id);
  }

  async function handleArchive(id: string) {
    await updateCapture(id, { status: 'archived' });
  }
</script>

<div class="page fade-in">
  <!-- Header -->
  <div class="page-header">
    <div class="header-left">
      <div class="title-row">
        <h1 id="page-title" class="page-title">{t('nav.allCaptures')}</h1>
        <span class="capture-count">{displayedCaptures.length}</span>
      </div>
      <span class="privacy-badge">Private by default</span>
    </div>
    <button id="btn-new-capture" class="btn-new" onclick={openNewCapture}
      title={t('shortcuts.newCapture')}>
      <span class="btn-icon">+</span>
      <span class="btn-label">{t('capture.addNew')}</span>
    </button>
  </div>

  <!-- Search & Filters -->
  <div class="toolbar">
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input
        id="search-input"
        type="text"
        class="search-input"
        placeholder={t('search.placeholder')}
        bind:value={searchQuery}
        oninput={handleSearch}
      />
      {#if searchQuery}
        <button class="search-clear" onclick={() => { searchQuery = ''; searchResults = []; aiSearchScores = {}; }}>✕</button>
      {/if}
      <button
        type="button"
        class="ai-search-toggle"
        class:active={isAiSearchActive && $settings.autoAiSearch}
        onclick={toggleAiSearch}
        title={t('search.aiToggle')}
      >
        ✨
      </button>
    </div>
    <div class="filters">
      <select class="filter-select" bind:value={filterType}>
        <option value="all">{t('filter.allTypes')}</option>
        <option value="link">{t('nav.links')}</option>
        <option value="quote">{t('nav.quotes')}</option>
        <option value="note">{t('nav.notes')}</option>
        <option value="image">{t('nav.images')}</option>
      </select>
      <select class="filter-select" bind:value={filterStatus}>
        <option value="active">{t('filter.inbox')}</option>
        <option value="all">{t('filter.allStatuses')}</option>
        <option value="unread">{t('status.unread')}</option>
        <option value="saved">{t('status.saved')}</option>
        <option value="archived">{t('status.archived')}</option>
      </select>
    </div>
  </div>

  <!-- AI Status Banner -->
  {#if isAiSearchActive && $settings.autoAiSearch}
    {#if $modelLoadingState === 'loading'}
      <div class="ai-status-banner glass">
        <div class="status-left">
          <span class="spinner">⏳</span>
          <span class="status-text">{t('search.aiDownloading', { progress: $downloadProgress })}</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: {$downloadProgress}%"></div>
        </div>
      </div>
    {:else if $isBackfilling}
      <div class="ai-status-banner glass">
        <div class="status-left">
          <span class="pulse-dot"></span>
          <span class="status-text">
            {t('search.aiIndexing', { done: $backfillProgress.done, total: $backfillProgress.total })} ({$backfillProgress.percent}%)
          </span>
        </div>
        <div class="status-right">
          <div class="progress-bar-container mini">
            <div class="progress-bar-fill" style="width: {$backfillProgress.percent}%"></div>
          </div>
          <button class="btn-cancel-indexing" onclick={cancelBackfill}>[Cancel]</button>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Capture Grid -->
  {#if displayedCaptures.length > 0}
    <div class="capture-grid">
      {#each displayedCaptures as capture (capture.id)}
        <CaptureCard 
          {capture} 
          searchScore={aiSearchScores[capture.id]}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onEdit={openEditModal}
          onOpen={handleCardOpen}
          {visibleIds}
        />
      {/each}
    </div>
  {:else}
    <div class="empty-state slide-up">
      <div class="empty-icon">📝</div>
      <h2 class="empty-title">
        {searchQuery ? t('search.noResults') : t('empty.allCaptures')}
      </h2>
      <p class="empty-hint">
        {searchQuery ? '' : t('empty.allCapturesHint')}
      </p>
      {#if !searchQuery}
        <button class="btn-empty" onclick={openNewCapture}>
          <span>+</span> {t('capture.addNew')}
        </button>
      {/if}
    </div>
  {/if}
</div>

<!-- Modal -->
<CaptureModal bind:open={showModal} onSave={handleSave} initialData={initialModalData} />

<!-- AI Search Opt-In Modal -->
{#if showAiOptInModal}
  <div class="modal-backdrop" onclick={() => showAiOptInModal = false} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal scale-in" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <span class="ai-modal-sparkles">✨</span>
          <h2>{t('search.aiModalTitle')}</h2>
        </div>
        
        <p class="ai-modal-body">
          {t('search.aiModalBody')}
        </p>
        
        <div class="ai-modal-privacy-card">
          <span class="privacy-icon">🛡️</span>
          <span class="privacy-text">{t('search.aiModalSafe')}</span>
        </div>

        <div class="ai-modal-actions">
          <button class="btn-cancel" onclick={() => showAiOptInModal = false}>
            {t('search.aiModalCancel')}
          </button>
          <button class="btn-enable-ai" onclick={async () => {
            showAiOptInModal = false;
            await setAutoAiSearch(true);
            isAiSearchActive = true;
          }}>
            {t('search.aiModalEnable')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Bulk Action Bar -->
<BulkActionBar {visibleIds} />

<style>
  .page { max-width: 100%; }
  .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
  .header-left { display:flex; flex-direction:column; align-items:flex-start; gap:6px; }
  .title-row { display:flex; align-items:center; gap:10px; }
  .page-title { font-size:1.75rem; font-weight:700; color:var(--color-text); margin:0; letter-spacing:-0.02em; }
  .capture-count { padding:2px 10px; background:var(--color-primary-subtle); color:var(--color-primary); border-radius:var(--radius-full); font-size:0.8125rem; font-weight:600; }
  .privacy-badge {
    display:inline-flex;
    align-items:center;
    padding:2px 10px;
    border-radius:var(--radius-full);
    font-size:0.72rem;
    font-weight:600;
    color:var(--color-text-secondary);
    background:color-mix(in srgb, var(--color-text-secondary) 14%, transparent);
    border:1px solid color-mix(in srgb, var(--color-text-secondary) 18%, transparent);
  }

  .btn-new { display:flex; align-items:center; gap:6px; padding:10px 20px; background:var(--color-primary); color:white; border:none; border-radius:var(--radius-md); font-size:0.875rem; font-weight:500; cursor:pointer; transition:all var(--duration-fast) var(--ease-out); font-family:var(--font-sans); }
  .btn-new:hover { background:var(--color-primary-hover); box-shadow:var(--shadow-md); transform:translateY(-1px); }
  .btn-icon { font-size:1.125rem; font-weight:300; }

  @media (max-width: 768px) {
    .btn-new { display:none; }
    .btn-label { display:none; }
  }

  .toolbar { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
  .search-bar { display:flex; align-items:center; flex:1; min-width:200px; padding:0 14px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); transition:border-color var(--duration-fast); }
  .search-bar:focus-within { border-color:var(--color-primary); box-shadow:0 0 0 3px rgba(91,78,214,0.1); }
  .search-icon { font-size:0.875rem; margin-right:8px; }
  .search-input { flex:1; border:none; background:none; outline:none; padding:10px 0; font-size:0.875rem; color:var(--color-text); font-family:var(--font-sans); }
  .search-clear { background:none; border:none; cursor:pointer; color:var(--color-text-secondary); font-size:0.875rem; padding:4px; }

  .filters { display:flex; gap:8px; }
  .filter-select { padding:8px 12px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); color:var(--color-text); font-size:0.8125rem; cursor:pointer; font-family:var(--font-sans); outline:none; }
  .filter-select:focus { border-color:var(--color-primary); }

  .capture-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px; }
  @media (max-width: 640px) { .capture-grid { grid-template-columns:1fr; } }

  .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 20px; text-align:center; }
  .empty-icon { font-size:4rem; margin-bottom:16px; opacity:0.6; }
  .empty-title { font-size:1.25rem; font-weight:600; color:var(--color-text); margin:0 0 8px; }
  .empty-hint { font-size:0.875rem; color:var(--color-text-secondary); margin:0 0 24px; max-width:360px; }
  .btn-empty { display:flex; align-items:center; gap:6px; padding:10px 24px; background:var(--color-primary); color:white; border:none; border-radius:var(--radius-md); font-size:0.875rem; font-weight:500; cursor:pointer; transition:all var(--duration-fast) var(--ease-out); font-family:var(--font-sans); }
  .btn-empty:hover { background:var(--color-primary-hover); }

  /* AI Search Styles */
  .ai-search-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    padding: 6px;
    margin-left: 6px;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    transition: all var(--duration-fast) var(--ease-out);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ai-search-toggle:hover {
    color: var(--color-primary);
    background: rgba(91, 78, 214, 0.08);
    transform: scale(1.08);
  }
  .ai-search-toggle.active {
    color: #10b981;
    text-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
    animation: pulse-glow 2s infinite;
  }
  
  @keyframes pulse-glow {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(16,185,129,0.2)); }
    50% { transform: scale(1.08); filter: drop-shadow(0 0 6px rgba(16,185,129,0.6)); }
  }

  .ai-status-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    margin-top: 12px;
    margin-bottom: 8px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    gap: 12px;
    flex-wrap: wrap;
    width: 100%;
  }
  .status-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .spinner {
    animation: rotate 1.5s linear infinite;
    display: inline-block;
  }
  @keyframes rotate {
    100% { transform: rotate(360deg); }
  }
  .pulse-dot {
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
    animation: pulse-dot-anim 1.5s infinite;
  }
  @keyframes pulse-dot-anim {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }
  .progress-bar-container {
    flex: 1;
    min-width: 100px;
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  .progress-bar-container.mini {
    width: 80px;
    flex: none;
  }
  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary), #10b981);
    transition: width var(--duration-fast) ease;
    border-radius: var(--radius-full);
  }
  .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn-cancel-indexing {
    background: none;
    border: none;
    color: var(--color-danger);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    transition: background var(--duration-fast);
  }
  .btn-cancel-indexing:hover {
    background: rgba(239, 68, 68, 0.08);
  }

  .ai-modal-content {
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .ai-modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .ai-modal-header h2 {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }
  .ai-modal-sparkles {
    font-size: 1.8rem;
    background: linear-gradient(135deg, #10b981, var(--color-primary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .ai-modal-body {
    font-size: 0.93rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
    margin: 0;
  }
  .ai-modal-privacy-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.18);
    border-radius: var(--radius-md);
  }
  .privacy-icon {
    font-size: 1.1rem;
  }
  .privacy-text {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #10b981;
  }
  .ai-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }
  .btn-cancel {
    padding: 10px 18px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }
  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  .btn-enable-ai {
    padding: 10px 20px;
    background: linear-gradient(135deg, var(--color-primary), #10b981);
    border: none;
    border-radius: var(--radius-md);
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast);
    box-shadow: 0 4px 12px rgba(91, 78, 214, 0.2);
  }
  .btn-enable-ai:hover {
    opacity: 0.95;
    box-shadow: 0 4px 16px rgba(91, 78, 214, 0.35);
    transform: translateY(-1px);
  }
</style>
