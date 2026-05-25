<script lang="ts">
  import { onMount } from 'svelte';
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
  import { updateCapture, runOcrOnCapture, archiveArticleForCapture } from '$lib/stores/captures';
  import { activeOcrRuns } from '$lib/ocr';
  import { requestProFeature } from '$lib/pro';
  import { formatReminderDate } from '$lib/reminders';

  let {
    capture,
    searchScore,
    onDelete,
    onArchive,
    onRestore,
    onEdit,
    onOpen,
    visibleIds
  }: {
    capture: Capture;
    searchScore?: number;
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
  let isOcrRunning = $derived($activeOcrRuns.has(capture.id));
  let displayScore = $derived(searchScore !== undefined && searchScore >= 0.7 ? `${Math.round(searchScore * 100)}% match` : null);
  let reminderLabel = $derived(() => {
    if (!capture.reminderAt || capture.reminderDone) return null;
    return formatReminderDate(capture.reminderAt);
  });
  let isReminderOverdue = $derived(
    !!capture.reminderAt && !capture.reminderDone && capture.reminderAt < new Date().toISOString()
  );

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

  onMount(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (showMenu) {
        const target = e.target as HTMLElement;
        if (!target.closest('.ctx-menu') && !target.closest('.menu-btn')) {
          closeMenu();
        }
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card fade-in"
  class:trashed={capture.isTrashed}
  class:selected={isSelected}
  class:selection-mode={isSelectionMode}
  class:menu-open={showMenu}
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
    {#if displayScore}
      <span class="match-badge">{displayScore}</span>
    {/if}
    {#if !isSelectionMode}
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); showMenu = !showMenu; }} aria-label="Card actions">...</button>
    {/if}
  </div>

  <div class="card-body">
    <h3 class="card-title">{truncate(capture.title || t('capture.noTitle'), 96)}</h3>

    {#if capture.type === 'image' && capture.content}
      <div class="image-shell">
        <img src={capture.content} alt={capture.title} class="card-image" loading="lazy" />
        {#if isOcrRunning}
          <div class="ocr-overlay">
            <div class="spinner"></div>
            <span>Extracting text...</span>
          </div>
        {/if}
      </div>

      {#if isOcrRunning}
        <div class="ocr-running-indicator">
          <span class="pulse-dot"></span>
          <span>Running OCR...</span>
        </div>
      {:else if capture.ocrStatus === 'failed'}
        <div class="ocr-failed-row" onclick={(e) => e.stopPropagation()}>
          <span class="ocr-failed-text">⚠ Text extraction failed</span>
          <button class="ocr-retry-btn" onclick={async (e) => { e.stopPropagation(); const allowed = await requestProFeature('ocr', 'Local OCR'); if (allowed) runOcrOnCapture(capture.id, capture.content, true); }}>
            Retry
          </button>
        </div>
      {:else if capture.ocrText}
        <p class="ocr-excerpt">
          <span class="ocr-doc-icon">📄</span>
          <span class="ocr-text-content">{truncate(capture.ocrText, 80)}</span>
        </p>
      {/if}
    {:else if capture.type === 'quote'}
      <blockquote class="card-quote">"{truncate(capture.content, 220)}"</blockquote>
    {:else if capture.type === 'link'}
      <div class="link-container">
        {#if capture.favicon}
          <img src={capture.favicon} alt="" class="link-favicon" width="14" height="14" loading="lazy" />
        {/if}
        <p class="card-link">{truncate(capture.content, 72)}</p>
      </div>

      {#if capture.archiveStatus === 'pending'}
        <div class="ocr-running-indicator" onclick={(e) => e.stopPropagation()}>
          <span class="pulse-dot"></span>
          <span>Archiving for offline...</span>
        </div>
      {:else if capture.archiveStatus === 'failed'}
        <div class="ocr-failed-row" onclick={(e) => e.stopPropagation()}>
          <span class="ocr-failed-text">⚠ Offline archive failed</span>
          <button class="ocr-retry-btn" onclick={async (e) => { e.stopPropagation(); const allowed = await requestProFeature('readingView', 'Reading View'); if (allowed) void archiveArticleForCapture(capture.id, capture.content); }}>
            Retry
          </button>
        </div>
      {/if}
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
      {#if reminderLabel()}
        <span class="reminder-badge" class:overdue={isReminderOverdue} title={reminderLabel() ?? ''}>
          🔔 {isReminderOverdue ? 'Overdue' : reminderLabel()}
        </span>
      {/if}
    </div>
    <div class="footer-right">
      {#if capture.type === 'link' && !isSelectionMode}
        <a class="open-link-btn" href={capture.content} target="_blank" rel="noopener noreferrer" onclick={(e) => e.stopPropagation()}>Open ↗</a>
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
        {#if capture.type === 'link'}
          <a class="mi" href={capture.content} target="_blank" rel="noopener noreferrer" onclick={(e) => { e.stopPropagation(); closeMenu(); }}>Open Link ↗</a>
          <button class="mi" onclick={(e) => { handleReadClick(e); closeMenu(); }}>Read (Pro)</button>
        {/if}

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
    background:rgba(var(--color-surface-raw), 0.55);
    backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);
    border:1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
    border-radius:var(--radius-lg);
    padding:14px 14px 12px;
    cursor:pointer;
    transform-style: preserve-3d;
    perspective: 1000px;
    transition: transform var(--duration-slow) var(--ease-out), 
                border-color var(--duration-normal) var(--ease-out), 
                box-shadow var(--duration-normal) var(--ease-out), 
                background var(--duration-normal) var(--ease-out);
  }

  .card.menu-open {
    z-index: 50;
  }

  .card:hover {
    border-color:color-mix(in srgb, var(--color-primary) 55%, transparent);
    background:rgba(var(--color-surface-raw), 0.75);
    box-shadow: 0 12px 28px rgba(91, 78, 214, 0.12), 0 0 1px rgba(91, 78, 214, 0.1);
    transform: translateY(-5px) scale(1.015) rotateX(1.2deg) rotateY(1.2deg);
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
    background: color-mix(in srgb, var(--color-primary) 9%, rgba(var(--color-surface-raw), 0.75));
    box-shadow: 0 0 22px rgba(91, 78, 214, 0.22), 0 0 0 1px var(--color-primary);
    transform: scale(0.985);
  }

  .card.selected:hover {
    transform: scale(0.995) translateY(-2px);
    box-shadow: 0 0 26px rgba(91, 78, 214, 0.32), 0 0 0 1px var(--color-primary);
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
  .open-link-btn {
    border: 1px solid color-mix(in srgb, var(--color-text-secondary) 25%, transparent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--color-surface-raw) 20%, transparent);
    padding: 4px 9px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    font-family: var(--font-sans);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast) var(--ease-out);
  }
  .open-link-btn:hover {
    background: rgba(var(--color-surface-raw), 0.8);
    border-color: var(--color-text);
    color: var(--color-text);
  }

  .link-favicon {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .reminder-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
    white-space: nowrap;
  }

  .reminder-badge.overdue {
    color: #d97706;
    background: color-mix(in srgb, #f59e0b 14%, transparent);
    border-color: color-mix(in srgb, #f59e0b 30%, transparent);
    animation: reminder-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes reminder-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
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

  /* OCR Styles */
  .ocr-running-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-primary);
    margin-top: 6px;
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    background-color: var(--color-primary);
    border-radius: 50%;
    animation: ocr-pulse 1.5s infinite ease-in-out;
  }

  @keyframes ocr-pulse {
    0% { transform: scale(0.8); opacity: 0.5; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(0.8); opacity: 0.5; }
  }

  .ocr-failed-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    border: 1px dashed color-mix(in srgb, var(--color-danger) 30%, transparent);
    padding: 6px 10px;
    border-radius: var(--radius-md);
  }

  .ocr-failed-text {
    font-size: 12px;
    color: var(--color-danger);
    font-weight: 500;
  }

  .match-badge {
    padding: 2px 8px;
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.22);
    border-radius: var(--radius-full);
    font-size: 0.7rem;
    font-weight: 600;
    margin-left: 6px;
    display: inline-flex;
    align-items: center;
  }

  .ocr-retry-btn {
    background: var(--color-danger);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-sans);
    transition: background var(--duration-fast);
  }

  .ocr-retry-btn:hover {
    background: color-mix(in srgb, var(--color-danger) 85%, black);
  }

  .ocr-excerpt {
    font-size: 12.5px;
    color: var(--color-text-secondary);
    margin: 6px 0 0;
    line-height: 1.5;
    background: color-mix(in srgb, var(--color-border) 25%, transparent);
    padding: 8px 10px;
    border-radius: var(--radius-md);
    border-left: 2px solid var(--color-primary);
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  .ocr-doc-icon {
    font-size: 13px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .ocr-text-content {
    word-break: break-word;
    font-style: italic;
    opacity: 0.9;
  }

  .image-shell {
    position: relative;
  }

  .ocr-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: white;
    font-weight: 600;
    font-size: 13px;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: ocr-spin 0.8s linear infinite;
  }

  @keyframes ocr-spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .card, .card:hover, .card.selected, .card.selected:hover {
      transform: none !important;
      transition: none !important;
    }
  }
</style>
