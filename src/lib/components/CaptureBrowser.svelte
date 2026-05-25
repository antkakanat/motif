<script lang="ts">
  import { t } from '$lib/i18n';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  import type { Capture, CaptureType, CaptureStatus } from '$lib/db';
  import { addCapture, updateCapture, softDeleteCapture, restoreCapture, permanentDeleteCapture } from '$lib/stores/captures';
  import { search, type SearchResult } from '$lib/search';
  import { settings, setViewMode, setDensity, setSortMode, setAutoAiSearch } from '$lib/stores/settings';
  import { clearSelection, selectAll } from '$lib/stores/selection';
  import { requestProFeature } from '$lib/pro';
  import { showToast } from '$lib/stores/toast';
  import { registerShortcuts } from '$lib/shortcuts';
  import {
    modelLoadingState,
    downloadProgress,
    backfillProgress,
    isBackfilling,
    cancelBackfill,
    semanticSearchQuery
  } from '$lib/stores/semanticSearch';

  import NavIcon from '$lib/components/NavIcon.svelte';
  import CaptureCard from '$lib/components/CaptureCard.svelte';
  import CaptureCompactItem from '$lib/components/CaptureCompactItem.svelte';
  import CaptureTableRow from '$lib/components/CaptureTableRow.svelte';
  import BulkActionBar from '$lib/components/BulkActionBar.svelte';
  import CaptureModal from '$lib/components/CaptureModal.svelte';

  // ── Strict Prop Interface ──
  interface CaptureBrowserProps {
    captures: Capture[];
    title: string;
    icon: string;
    emptyTitle: string;
    emptyHint: string;
    newBtnLabel: string;
    newBtnTab: CaptureType;
    isTrashView?: boolean;
    isArchiveView?: boolean;
    collectionId?: string | null;
    showTypeFilter?: boolean;
    showStatusFilter?: boolean;
  }

  let {
    captures,
    title,
    icon,
    emptyTitle,
    emptyHint,
    newBtnLabel,
    newBtnTab,
    isTrashView = false,
    isArchiveView = false,
    collectionId = null,
    showTypeFilter = true,
    showStatusFilter = true
  }: CaptureBrowserProps = $props();

  // ── Core States ──
  let showModal = $state(false);
  let searchQuery = $state('');
  let filterType = $state<CaptureType | 'all'>('all');
  let filterStatus = $state<CaptureStatus | 'all' | 'active'>('active');
  let searchResults = $state<SearchResult[]>([]);
  let initialModalData = $state<any>(null);
  let editingCapture = $state<Capture | null>(null);

  let isAiSearchActive = $state(false);
  let showAiOptInModal = $state(false);
  let aiSearchScores = $state<Record<string, number>>({});
  let searchFocused = $state(false);

  let lastHandledParamSignature = $state('');

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

  // ── Extension capture auto-save ──
  async function handleExtensionCapture(
    type: string,
    url: string,
    title: string,
    text: string,
    favicon?: string,
    description?: string,
    ogImage?: string
  ) {
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
        favicon: favicon || undefined,
        description: description || undefined,
        ogImage: ogImage || undefined,
      });

      showToast(captureType === 'quote' ? '✓ Quote saved from extension' : '✓ Link saved from extension');
    } catch (err) {
      console.error('Extension capture failed:', err);
      showToast('Failed to save capture');
    }

    // Clear extension params from URL
    void goto('/', { replaceState: true });
  }

  // ── Mobile Responsive Tracking (Avoid dual rendering performance hit) ──
  let isMobile = $state(false);

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

    // ── Handle Browser Extension params (auto-save, no modal) ──
    const extType = $page.url.searchParams.get('ext_type');
    if (extType) {
      const extUrl = $page.url.searchParams.get('ext_url') || '';
      const extTitle = $page.url.searchParams.get('ext_title') || '';
      const extText = $page.url.searchParams.get('ext_text') || '';
      const extFavicon = $page.url.searchParams.get('ext_favicon') || '';
      const extDescription = $page.url.searchParams.get('ext_description') || '';
      const extImage = $page.url.searchParams.get('ext_image') || '';
      void handleExtensionCapture(extType, extUrl, extTitle, extText, extFavicon, extDescription, extImage);
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

    if (typeof window !== 'undefined') {
      isMobile = window.innerWidth < 768;
      const handleResize = () => {
        isMobile = window.innerWidth < 768;
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  });

  $effect(() => {
    $page.url.search;
    handleRouteParams();
  });

  // ── Handlers ──
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

  // Watch settings to auto-activate AI search
  $effect(() => {
    if ($settings.autoAiSearch && $modelLoadingState === 'ready') {
      isAiSearchActive = true;
    }
  });

  // ── Derived Filtered and Sorted list ──
  let displayedCaptures = $derived.by(() => {
    let items = captures;

    // Filter collection
    if (collectionId !== null) {
      items = items.filter(c => c.collectionId === collectionId);
    }

    // Filter trashed/archive/normal states
    if (isTrashView) {
      // Handled by route array, but double-check for safety
      items = items.filter(c => c.isTrashed);
    } else if (isArchiveView) {
      items = items.filter(c => !c.isTrashed && c.status === 'archived');
    } else {
      items = items.filter(c => !c.isTrashed);
      
      // Default active behaves like inbox, filter archived unless explicitly all/archived
      if (showStatusFilter) {
        if (filterStatus === 'active') {
          items = items.filter(c => c.status !== 'archived');
        } else if (filterStatus !== 'all') {
          items = items.filter(c => c.status === filterStatus);
        }
      }
    }

    // Filter type select
    if (showTypeFilter && filterType !== 'all') {
      items = items.filter(c => c.type === filterType);
    }

    // Apply Search matches
    if (searchQuery.trim()) {
      if (searchResults.length === 0) {
        items = [];
      } else {
        const ids = new Set(searchResults.map(r => r.id));
        items = items.filter(c => ids.has(c.id));
      }
    }

    // Apply Sorting logic
    const sort = $settings.sortMode;
    const scores = searchQuery.trim() ? searchResults : [];

    items = [...items].sort((a, b) => {
      // 1. Relevance sort (only when there are active search results)
      if (sort === 'relevance' && scores.length > 0) {
        const sa = scores.find(r => r.id === a.id)?.score ?? 0;
        const sb = scores.find(r => r.id === b.id)?.score ?? 0;
        if (sb !== sa) return sb - sa;
      }

      // 2. Alphabetical
      if (sort === 'alphabetical') {
        const titleA = (a.title || a.content || '').toLowerCase();
        const titleB = (b.title || b.content || '').toLowerCase();
        return titleA.localeCompare(titleB);
      }

      // 3. Oldest
      if (sort === 'oldest') {
        return a.createdAt.localeCompare(b.createdAt);
      }

      // Default/Newest
      return b.createdAt.localeCompare(a.createdAt);
    });

    return items;
  });

  let visibleIds = $derived(displayedCaptures.map(c => c.id));

  // ── CRUD hooks ──
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

    await addCapture(data);
  }

  async function handleDelete(id: string) {
    if (isTrashView) {
      await permanentDeleteCapture(id);
    } else {
      await softDeleteCapture(id);
    }
  }

  async function handleArchive(id: string) {
    await updateCapture(id, { status: 'archived' });
  }

  async function handleRestore(id: string) {
    if (isTrashView) {
      await restoreCapture(id);
    } else {
      await updateCapture(id, { status: 'saved' });
    }
  }
</script>

<div class="browser-wrapper">
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-left">
      <div class="title-row">
        <h1 id="page-title" class="page-title">
          <span class="title-icon"><NavIcon name={icon} size={22} /></span>
          {title}
        </h1>
        <span class="capture-count">{displayedCaptures.length}</span>
      </div>
      <span class="privacy-badge">🛡️ Private capture</span>
    </div>
    
    {#if !isTrashView && !isArchiveView}
      <button id="btn-new-capture" class="btn-new" onclick={openNewCapture}>
        <span class="btn-icon">+</span>
        <span class="btn-label">{newBtnLabel}</span>
      </button>
    {/if}
  </div>

  <!-- Unified Search & Filters Toolbar -->
  <div class="toolbar">
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input
        id="search-input"
        type="text"
        class="search-input"
        placeholder={t('search.placeholder') || 'Search everything...'}
        bind:value={searchQuery}
        oninput={handleSearch}
        onfocus={() => searchFocused = true}
        onblur={() => setTimeout(() => searchFocused = false, 200)}
      />
      {#if searchQuery}
        <button class="search-clear" onclick={() => { searchQuery = ''; searchResults = []; aiSearchScores = {}; }}>✕</button>
      {/if}
      <button
        type="button"
        class="ai-search-toggle"
        class:active={isAiSearchActive && $settings.autoAiSearch}
        onclick={toggleAiSearch}
        title={t('search.aiToggle') || 'Toggle Offline AI Semantic Search'}
      >
        ✨
      </button>
    </div>

    <!-- Filter selects -->
    <div class="filters">
      {#if showTypeFilter}
        <select class="filter-select" bind:value={filterType}>
          <option value="all">{t('filter.allTypes') || 'All Types'}</option>
          <option value="link">{t('nav.links') || 'Links'}</option>
          <option value="quote">{t('nav.quotes') || 'Quotes'}</option>
          <option value="note">{t('nav.notes') || 'Notes'}</option>
          <option value="image">{t('nav.images') || 'Images'}</option>
        </select>
      {/if}

      {#if showStatusFilter && !isArchiveView && !isTrashView}
        <select class="filter-select" bind:value={filterStatus}>
          <option value="active">{t('filter.inbox') || 'Inbox (Active)'}</option>
          <option value="all">{t('filter.allStatuses') || 'All Statuses'}</option>
          <option value="unread">{t('status.unread') || 'Unread'}</option>
          <option value="saved">{t('status.saved') || 'Saved'}</option>
          <option value="archived">{t('status.archived') || 'Archived'}</option>
        </select>
      {/if}

      <!-- PERSISTED SORT MODE SELECTOR -->
      <select class="filter-select" value={$settings.sortMode} onchange={(e) => setSortMode((e.target as HTMLSelectElement).value as any)}>
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="alphabetical">Alphabetical (A-Z)</option>
        {#if searchQuery.trim()}
          <option value="relevance">Search Relevance</option>
        {/if}
      </select>
    </div>

    <!-- VIEW & DENSITY PERSISTED SWITCHERS -->
    <div class="preferences-bar">
      <!-- Layout Modes Toggle -->
      <div class="preference-group">
        <button 
          class="pref-btn" 
          class:active={$settings.viewMode === 'cards'} 
          onclick={() => setViewMode('cards')} 
          title="Cards View"
        >
          🎴
        </button>
        <button 
          class="pref-btn" 
          class:active={$settings.viewMode === 'compact'} 
          onclick={() => setViewMode('compact')} 
          title="Compact List View"
        >
          ☰
        </button>
        <button 
          class="pref-btn" 
          class:active={$settings.viewMode === 'table'} 
          onclick={() => setViewMode('table')} 
          title="Table View"
        >
          ▤
        </button>
      </div>

      <div class="divider"></div>

      <!-- Density Toggle -->
      <div class="preference-group">
        <button 
          class="pref-btn text-pref" 
          class:active={$settings.density === 'comfortable'} 
          onclick={() => setDensity('comfortable')} 
          title="Comfortable Density"
        >
          Comfortable
        </button>
        <button 
          class="pref-btn text-pref" 
          class:active={$settings.density === 'compact'} 
          onclick={() => setDensity('compact')} 
          title="Compact Density"
        >
          Compact
        </button>
      </div>
    </div>
  </div>

  <!-- AI Status Banner -->
  {#if isAiSearchActive && $settings.autoAiSearch}
    {#if $modelLoadingState === 'loading'}
      <div class="ai-status-banner glass">
        <div class="status-left">
          <span class="spinner">⏳</span>
          <span class="status-text">Downloading offline AI search model... {$downloadProgress}%</span>
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
            AI Indexing captures: {$backfillProgress.done} / {$backfillProgress.total} ({$backfillProgress.percent}%)
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

  <!-- Capture List Rendering -->
  {#if displayedCaptures.length > 0}
    {#if $settings.viewMode === 'cards'}
      <div class="capture-grid" class:compact-density={$settings.density === 'compact'}>
        {#each displayedCaptures as capture (capture.id)}
          <CaptureCard 
            {capture} 
            searchScore={aiSearchScores[capture.id]}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onRestore={isTrashView || isArchiveView ? handleRestore : undefined}
            onEdit={openEditModal}
            onOpen={handleCardOpen}
            {visibleIds}
          />
        {/each}
      </div>
    {:else if $settings.viewMode === 'compact'}
      <div class="capture-list-compact">
        {#each displayedCaptures as capture (capture.id)}
          <CaptureCompactItem 
            {capture}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onRestore={isTrashView || isArchiveView ? handleRestore : undefined}
            onEdit={openEditModal}
            onOpen={handleCardOpen}
            {visibleIds}
          />
        {/each}
      </div>
    {:else if $settings.viewMode === 'table'}
      <!-- Reactive mobile innerWidth toggle -> either render desktop semantic table or list. Never both. -->
      {#if isMobile}
        <div class="capture-list-compact">
          {#each displayedCaptures as capture (capture.id)}
            <CaptureCompactItem 
              {capture}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onRestore={isTrashView || isArchiveView ? handleRestore : undefined}
              onEdit={openEditModal}
              onOpen={handleCardOpen}
              {visibleIds}
            />
          {/each}
        </div>
      {:else}
        <div class="capture-table-container">
          <table class="capture-table">
            <thead>
              <tr>
                <th class="col-select"></th>
                <th class="col-title">Title & Source</th>
                <th class="col-type">Type</th>
                <th class="col-collection">Collection</th>
                <th class="col-tags">Tags</th>
                <th class="col-date">Date</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {#each displayedCaptures as capture (capture.id)}
                <CaptureTableRow 
                  {capture}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onRestore={isTrashView || isArchiveView ? handleRestore : undefined}
                  onEdit={openEditModal}
                  onOpen={handleCardOpen}
                  {visibleIds}
                />
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  {:else}
    <div class="empty-state slide-up">
      <div class="empty-icon">📝</div>
      <h2 class="empty-title">{searchQuery ? t('search.noResults') || 'No captures match search' : emptyTitle}</h2>
      <p class="empty-hint">{searchQuery ? '' : emptyHint}</p>
      {#if !searchQuery && !isTrashView && !isArchiveView}
        <button class="btn-empty" onclick={openNewCapture}>
          <span>+</span> {newBtnLabel}
        </button>
      {/if}
    </div>
  {/if}
</div>

<!-- Add/Edit Capture Modal -->
<CaptureModal bind:open={showModal} defaultTab={newBtnTab} onSave={handleSave} initialData={initialModalData} lockTab={!showTypeFilter} />

<!-- Bulk Actions Manager Bar -->
<BulkActionBar {visibleIds} />

<!-- AI Search Opt-In Modal -->
{#if showAiOptInModal}
  <div class="modal-backdrop" onclick={() => showAiOptInModal = false} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal scale-in" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <span class="ai-modal-sparkles">✨</span>
          <h2>Activate Local AI Search</h2>
        </div>
        
        <p class="ai-modal-body">
          This download and activates a lightweight transformer model directly on your device. Searches will scan capture meanings and contexts 100% offline, privately, and locally.
        </p>
        
        <div class="ai-modal-privacy-card">
          <span class="privacy-icon">🛡️</span>
          <span class="privacy-text">No data ever leaves your device.</span>
        </div>

        <div class="ai-modal-actions">
          <button class="btn-cancel" onclick={() => showAiOptInModal = false}>
            Cancel
          </button>
          <button class="btn-enable-ai" onclick={async () => {
            showAiOptInModal = false;
            const allowed = await requestProFeature('aiSearch', 'AI Semantic Search');
            if (allowed) {
              await setAutoAiSearch(true);
              isAiSearchActive = true;
            }
          }}>
            Enable Local AI
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .browser-wrapper {
    width: 100%;
  }

  .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
  .header-left { display:flex; flex-direction:column; align-items:flex-start; gap:6px; }
  .title-row { display:flex; align-items:center; gap:10px; }
  .page-title { font-size:1.75rem; font-weight:700; color:var(--color-text); margin:0; letter-spacing:-0.02em; display: flex; align-items: center; gap: 8px; }
  .title-icon { display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary); }
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

  .toolbar { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; align-items: center; }
  .search-bar {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 240px;
    padding: 0 16px;
    border: 1px solid color-mix(in srgb, var(--color-primary) 12%, var(--color-border));
    border-radius: var(--radius-full);
    background: rgba(var(--color-surface-raw), 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all var(--duration-normal) var(--ease-out);
    box-shadow: var(--shadow-sm);
  }
  .search-bar:focus-within {
    border-color: var(--color-primary);
    background: rgba(var(--color-surface-raw), 0.85);
    box-shadow: 0 0 20px rgba(91, 78, 214, 0.22), 0 0 0 1px var(--color-primary);
  }
  .search-icon { font-size:0.875rem; margin-right:8px; }
  .search-input { flex:1; border:none; background:none; outline:none; padding:10px 0; font-size:0.875rem; color:var(--color-text); font-family:var(--font-sans); }
  .search-clear { background:none; border:none; cursor:pointer; color:var(--color-text-secondary); font-size:0.875rem; padding:4px; }

  .filters { display:flex; gap:8px; flex-wrap: wrap; }
  .filter-select { padding:8px 12px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); color:var(--color-text); font-size:0.8125rem; cursor:pointer; font-family:var(--font-sans); outline:none; }
  .filter-select:focus { border-color:var(--color-primary); }

  .preferences-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    background: rgba(var(--color-surface-raw), 0.5);
    border: 1px solid var(--color-border);
    padding: 3px;
    border-radius: var(--radius-md);
  }

  @media (max-width: 900px) {
    .preferences-bar {
      margin-left: 0;
      width: 100%;
      justify-content: space-between;
    }
  }

  .preference-group {
    display: flex;
    gap: 2px;
  }

  .pref-btn {
    border: none;
    background: none;
    cursor: pointer;
    padding: 4px 8px;
    font-size: 13px;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast);
  }

  .pref-btn:hover {
    color: var(--color-text);
    background: var(--color-surface);
  }

  .pref-btn.active {
    color: var(--color-primary);
    background: var(--color-primary-subtle);
    font-weight: 600;
  }

  .pref-btn.text-pref {
    font-size: 11px;
    font-weight: 500;
  }

  .divider {
    width: 1px;
    height: 14px;
    background: var(--color-border);
  }

  .capture-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:16px; }
  @media (max-width: 640px) { .capture-grid { grid-template-columns:1fr; } }

  .capture-table-container {
    width: 100%;
    overflow-x: auto;
    background: rgba(var(--color-surface-raw), 0.35);
    backdrop-filter: blur(8px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .capture-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .capture-table th {
    padding: 12px 16px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
    background: rgba(var(--color-surface-raw), 0.55);
  }

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

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 14, 26, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }

  .modal {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 480px;
    box-shadow: var(--shadow-xl);
    overflow: hidden;
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
  }
</style>
