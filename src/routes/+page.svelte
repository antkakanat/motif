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
  import { settings } from '$lib/stores/settings';
  import { showToast } from '$lib/stores/toast';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let showModal = $state(false);
  let searchQuery = $state('');
  let filterType = $state<CaptureType | 'all'>('all');
  let filterStatus = $state<CaptureStatus | 'all' | 'active'>('active');
  let searchResults = $state<SearchResult[]>([]);
  let initialModalData = $state<any>(null);
  let lastHandledParamSignature = $state('');

  function handleRouteParams() {
    const statusParam = $page.url.searchParams.get('status');
    const openNewCapture = $page.url.searchParams.get('new') === '1';
    const focusSearch = $page.url.searchParams.get('focus') === 'search';
    const signature = `${statusParam ?? ''}|${openNewCapture}|${focusSearch}`;
    if (signature === lastHandledParamSignature) return;
    lastHandledParamSignature = signature;

    if (statusParam === 'archived' || statusParam === 'saved' || statusParam === 'unread' || statusParam === 'all' || statusParam === 'active') {
      filterStatus = statusParam;
    }

    if (openNewCapture) {
      showModal = true;
    }

    if (focusSearch) {
      requestAnimationFrame(() => {
        document.getElementById('search-input')?.focus();
      });
    }

    if (statusParam || openNewCapture || focusSearch) {
      void goto('/', { replaceState: true });
    }
  }

  // Register shortcuts + start onboarding for new users
  onMount(() => {
    registerShortcuts([
      { key: 'k', label: 'New Capture', description: 'Open capture modal', ctrlOrCmd: true, handler: () => showModal = true },
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

  function handleSearch() {
    if (searchQuery.trim()) {
      searchResults = search(searchQuery);
    } else {
      searchResults = [];
    }
  }

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

  async function handleSave(data: { type: CaptureType; title: string; content: string; tags: string[]; sourceUrl: string }) {
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
        <h1 class="page-title">{t('nav.allCaptures')}</h1>
        <span class="capture-count">{displayedCaptures.length}</span>
      </div>
      <span class="privacy-badge">Private by default</span>
    </div>
    <button id="btn-new-capture" class="btn-new" onclick={() => showModal = true}
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
        <button class="search-clear" onclick={() => { searchQuery = ''; searchResults = []; }}>✕</button>
      {/if}
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
        <option value="active">Active (Unread + Saved)</option>
        <option value="all">{t('filter.allStatuses')}</option>
        <option value="unread">{t('status.unread')}</option>
        <option value="saved">{t('status.saved')}</option>
        <option value="archived">{t('status.archived')}</option>
      </select>
    </div>
  </div>

  <!-- Capture Grid -->
  {#if displayedCaptures.length > 0}
    <div class="capture-grid">
      {#each displayedCaptures as capture (capture.id)}
        <CaptureCard 
          {capture} 
          onDelete={handleDelete} 
          onArchive={handleArchive} 
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
        <button class="btn-empty" onclick={() => showModal = true}>
          <span>+</span> {t('capture.addNew')}
        </button>
      {/if}
    </div>
  {/if}
</div>

<!-- Modal -->
<CaptureModal bind:open={showModal} onSave={handleSave} initialData={initialModalData} />

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

</style>
