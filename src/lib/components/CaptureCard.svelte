<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Capture } from '$lib/db';
  import {
    selectedIds,
    isSelectionActive,
    selectionMode,
    toggleSelection,
    rangeSelect,
    enterSelectionMode
  } from '$lib/stores/selection';
  import { collections } from '$lib/stores/collections';
  import { updateCapture } from '$lib/stores/captures';
  import { requestProFeature } from '$lib/pro';

  let {
    capture,
    onDelete,
    onArchive,
    onRestore,
    onEdit,
    onOpen,
    visibleIds
  }: {
    capture: Capture;
    onDelete?: (id: string) => void;
    onArchive?: (id: string) => void;
    onRestore?: (id: string) => void;
    onEdit?: (capture: Capture) => void;
    onOpen?: (capture: Capture) => void;
    visibleIds?: string[];
  } = $props();

  let showMenu = $state(false);
  let showCollectionPicker = $state(false);
  let isSelected = $derived($selectedIds.has(capture.id));
  let isSelectionMode = $derived($selectionMode === 'selection');

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressTriggered = $state(false);

  const typeLabels: Record<string, string> = {
    link: 'Link',
    quote: 'Quote',
    note: 'Note',
    image: 'Image'
  };

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const ms = now.getTime() - d.getTime();
    const m = Math.floor(ms / 60000);
    const h = Math.floor(ms / 3600000);
    const dy = Math.floor(ms / 86400000);

    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (dy < 7) return `${dy}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function truncate(s: string, n: number): string {
    return s.length <= n ? s : `${s.slice(0, n).trim()}...`;
  }

  function getPreview(): string {
    if (capture.type === 'note') {
      try {
        return extractText(JSON.parse(capture.content));
      } catch {
        return capture.content;
      }
    }

    return capture.content;
  }

  function extractText(node: Record<string, unknown>): string {
    const parts: string[] = [];

    if (typeof node.text === 'string') {
      parts.push(node.text);
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        parts.push(extractText(child as Record<string, unknown>));
      }
    }

    return parts.join(' ');
  }

  function closeMenu() {
    showMenu = false;
    showCollectionPicker = false;
  }

  async function moveToCollection(collectionId: string | null) {
    if (collectionId !== null) {
      const allowed = await requestProFeature('collections', 'Collections');
      if (!allowed) return;
    }
    await updateCapture(capture.id, { collectionId });
    closeMenu();
  }

  async function setStatus(status: 'unread' | 'saved' | 'archived') {
    await updateCapture(capture.id, { status });
    closeMenu();
  }

  $effect(() => {
    if (isSelectionMode && showMenu) {
      closeMenu();
    }
  });

  function handleCardClick(e: MouseEvent) {
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }

    if (isSelectionMode) {
      toggleSelection(capture.id, { enterMode: false });
      return;
    }

    if (e.shiftKey && visibleIds) {
      e.preventDefault();
      rangeSelect(capture.id, visibleIds);
      return;
    }

    onOpen?.(capture);
  }

  function handleCardKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();

    if (isSelectionMode) {
      toggleSelection(capture.id, { enterMode: false });
      return;
    }

    onOpen?.(capture);
  }

  function handleReadClick(e: MouseEvent) {
    e.stopPropagation();
    onOpen?.(capture);
  }

  function toggle() {
    if (!isSelectionMode) {
      enterSelectionMode();
    }
    toggleSelection(capture.id, { enterMode: false });
  }

  function handleLongPressStart() {
    if (isSelectionMode) return;
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      enterSelectionMode();
      toggleSelection(capture.id, { enterMode: false });
    }, 550);
  }

  function handleLongPressEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card fade-in"
  class:trashed={capture.isTrashed}
  class:selected={isSelected}
  class:selection-mode={isSelectionMode}
  role="button"
  tabindex="0"
  onclick={handleCardClick}
  onkeydown={handleCardKeydown}
  onmousedown={handleLongPressStart}
  onmouseup={handleLongPressEnd}
  onmouseleave={handleLongPressEnd}
  ontouchstart={handleLongPressStart}
  ontouchend={handleLongPressEnd}
  ontouchcancel={handleLongPressEnd}
>
  <div class="card-meta-row">
    <div class="selection-control" class:active={$isSelectionActive || isSelected}>
      <input
        type="checkbox"
        checked={isSelected}
        onchange={toggle}
        onclick={(e) => e.stopPropagation()}
        aria-label="Select capture"
      />
    </div>

    <span class={`type-pill type-${capture.type}`}>{typeLabels[capture.type]}</span>
    <span class="card-date">{formatDate(capture.createdAt)}</span>
    {#if !isSelectionMode}
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); showMenu = !showMenu; }} aria-label="Card actions">...</button>
    {/if}
  </div>

  <div class="card-body">
    <h3 class="card-title">{truncate(capture.title || t('capture.noTitle'), 96)}</h3>

    {#if capture.type === 'image' && capture.content}
      <div class="image-shell">
        <img src={capture.content} alt={capture.title} class="card-image" loading="lazy" />
      </div>
    {:else if capture.type === 'quote'}
      <blockquote class="card-quote">"{truncate(capture.content, 220)}"</blockquote>
    {:else if capture.type === 'link'}
      <div class="link-container">
        <p class="card-link">{truncate(capture.content, 72)}</p>
      </div>
    {:else}
      <p class="card-preview">{truncate(getPreview(), 200)}</p>
    {/if}
  </div>

  <div class="card-footer">
    <div class="footer-status">
      {#if capture.status === 'unread'}
        <span class="status-dot unread" aria-hidden="true"></span>
        <span class="sr-only">{t('status.unread')}</span>
      {:else if capture.status === 'archived'}
        <span class="status-pill">{t('status.archived')}</span>
      {/if}
    </div>
    <div class="footer-right">
      {#if capture.type === 'link' && !isSelectionMode}
        <button class="read-btn" type="button" onclick={handleReadClick}>Read</button>
      {/if}
      {#if capture.tags.length > 0}
        <div class="card-tags">
          {#each capture.tags.slice(0, 2) as tag}
            <span class="card-tag">{tag}</span>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if showMenu && !isSelectionMode}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="ctx-menu scale-in" role="menu" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      {#if !capture.isTrashed}
        {#if onEdit}
          <button class="mi" onclick={() => { onEdit(capture); closeMenu(); }}>Edit</button>
        {/if}

        {#if capture.status === 'unread'}
          <button class="mi" onclick={() => setStatus('saved')}>Mark as {t('status.saved')}</button>
        {:else if capture.status === 'saved'}
          <button class="mi" onclick={() => setStatus('unread')}>Mark as {t('status.unread')}</button>
        {/if}

        {#if capture.status !== 'archived' && onArchive}
          <button class="mi" onclick={() => { onArchive(capture.id); closeMenu(); }}>Archive</button>
        {:else if capture.status === 'archived' && onRestore}
          <button class="mi" onclick={() => { onRestore(capture.id); closeMenu(); }}>Restore</button>
        {/if}

        <button class="mi" onclick={(e) => { e.stopPropagation(); showCollectionPicker = !showCollectionPicker; }}>
          {t('nav.collections')}
        </button>

        {#if showCollectionPicker}
          <div class="sub-menu">
            {#each $collections as col}
              <button class="mi sub" onclick={() => moveToCollection(col.id)}>
                <span class="dot" style="background:{col.color}"></span>
                {col.name}
              </button>
            {/each}
            <button class="mi sub italic" onclick={() => moveToCollection(null)}>{t('collections.none')}</button>
          </div>
        {/if}

        {#if onDelete}
          <button class="mi danger" onclick={() => { onDelete(capture.id); closeMenu(); }}>{t('capture.delete')}</button>
        {/if}
      {:else}
        {#if onRestore}
          <button class="mi" onclick={() => { onRestore(capture.id); closeMenu(); }}>{t('capture.restore')}</button>
        {/if}
        {#if onDelete}
          <button class="mi danger" onclick={() => { onDelete(capture.id); closeMenu(); }}>{t('capture.deletePermanently')}</button>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .card {
    position:relative;
    background:var(--color-surface);
    border:1px solid var(--color-border);
    border-radius:var(--radius-lg);
    padding:14px 14px 12px;
    transition:all var(--duration-fast) var(--ease-out);
    cursor:pointer;
  }

  .card:hover {
    border-color:var(--color-primary);
    box-shadow:var(--shadow-md);
    transform:translateY(-1px);
  }

  .card:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .card.selection-mode {
    cursor: pointer;
  }

  .card.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .card.trashed { opacity:0.7; }

  .selection-control {
    display:none;
    align-items:center;
    justify-content:center;
    width:20px;
    height:20px;
    margin-right:4px;
  }

  .selection-control.active,
  .card:hover .selection-control {
    display:flex;
  }

  .selection-control input {
    width:18px;
    height:18px;
    cursor:pointer;
    accent-color:var(--color-primary);
  }

  .card-meta-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .type-pill {
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.01em;
    line-height: 1.2;
  }
  .type-pill.type-link {
    color: #1d4ed8;
    background: #dbeafe;
  }
  .type-pill.type-quote {
    color: #7c3aed;
    background: #ede9fe;
  }
  .type-pill.type-note {
    color: #0f766e;
    background: #ccfbf1;
  }
  .type-pill.type-image {
    color: #be123c;
    background: #ffe4e6;
  }
  .status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .status-dot.unread { background:#3b82f6; }

  .status-pill {
    padding:2px 8px;
    border-radius:var(--radius-full);
    font-size:11px;
    font-weight:600;
    color:var(--color-text-secondary);
    background:color-mix(in srgb, var(--color-text-secondary) 16%, transparent);
  }

  .card-date { font-size:12px; color:var(--color-text-secondary); flex:1; }

  .menu-btn {
    background:none;
    border:none;
    cursor:pointer;
    color:var(--color-text-secondary);
    font-size:18px;
    padding:4px 8px;
    border-radius:var(--radius-sm);
    transition:background var(--duration-fast);
    line-height:1;
  }

  .menu-btn:hover { background:var(--color-primary-subtle); color:var(--color-primary); }

  .card-body { margin-bottom:10px; display:flex; flex-direction:column; gap:8px; }
  .card-title { font-size:1.05rem; font-weight:650; color:var(--color-text); margin:0; line-height:1.35; }
  .image-shell {
    width: 100%;
    height: 180px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
  }
  .card-image { width:100%; height:100%; object-fit:cover; display:block; }
  .card-quote { margin:0; padding:8px 12px; border-left:3px solid var(--color-primary); background:var(--color-primary-subtle); border-radius:0 var(--radius-sm) var(--radius-sm) 0; font-size:13px; font-style:italic; line-height:1.6; }
  .card-link { font-size:13px; color:var(--color-primary); margin:0; word-break:break-word; line-height:1.45; }
  .link-container { display:flex; align-items:center; gap:12px; }

  .card-preview { font-size:13px; color:var(--color-text-secondary); margin:0; line-height:1.5; }
  .card-footer {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
    padding-top: 8px;
  }
  .footer-status { display:flex; align-items:center; gap:6px; min-width: 0; }
  .footer-right { display:flex; align-items:center; gap:8px; margin-left:auto; }
  .read-btn {
    border: 1px solid color-mix(in srgb, var(--color-primary) 32%, transparent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    padding: 4px 9px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary);
    white-space: nowrap;
    cursor: pointer;
    font-family: var(--font-sans);
  }
  .read-btn:hover {
    background: var(--color-primary-subtle);
    border-color: var(--color-primary);
  }
  .card-tags { display:flex; flex-wrap:wrap; gap:4px; }
  .card-tag { padding:2px 8px; background:var(--color-primary-subtle); color:var(--color-primary); border-radius:var(--radius-full); font-size:11px; font-weight:500; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .ctx-menu {
    position:absolute;
    top:48px;
    right:12px;
    background:var(--color-bg);
    border:1px solid var(--color-border);
    border-radius:var(--radius-md);
    box-shadow:var(--shadow-lg);
    min-width:180px;
    z-index:30;
    padding:4px;
  }

  .mi {
    display:flex;
    align-items:center;
    gap:10px;
    width:100%;
    padding:8px 12px;
    background:none;
    border:none;
    cursor:pointer;
    font-size:13px;
    color:var(--color-text);
    border-radius:var(--radius-sm);
    transition:background var(--duration-fast);
    font-family:var(--font-sans);
    text-align:left;
  }

  .mi:hover { background:var(--color-surface); }
  .mi.danger { color:var(--color-danger); }
  .mi.danger:hover { background:#fff1f2; color:var(--color-danger); }

  .sub-menu {
    border-top:1px solid var(--color-border);
    margin-top:4px;
    padding-top:4px;
    max-height:200px;
    overflow-y:auto;
  }

  .mi.sub {
    font-size:12px;
    padding:6px 12px 6px 24px;
    display:flex;
    align-items:center;
    gap:8px;
  }

  .italic { font-style:italic; opacity:0.7; }
  .dot { width:8px; height:8px; border-radius:50%; }

  @media (max-width: 768px) {
    .card {
      padding: 14px 14px 12px;
    }
    .image-shell {
      height: 190px;
    }
  }

  :global([data-theme='dark']) .card {
    border-color: color-mix(in srgb, var(--color-border) 75%, #ffffff 25%);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border) 35%, transparent);
  }

  :global([data-theme='dark']) .card-footer {
    border-top-color: color-mix(in srgb, var(--color-border) 88%, transparent);
  }
</style>
