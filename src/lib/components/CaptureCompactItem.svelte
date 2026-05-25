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
  import { settings } from '$lib/stores/settings';

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
  let isOcrRunning = $derived($activeOcrRuns.has(capture.id));
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

  function handleRowClick(e: MouseEvent) {
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

  function handleRowKeydown(e: KeyboardEvent) {
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

  function handleRetryArchive(e: MouseEvent) {
    e.stopPropagation();
    void archiveArticleForCapture(capture.id, capture.content);
  }

  function handleRetryOcr(e: MouseEvent) {
    e.stopPropagation();
    void runOcrOnCapture(capture.id, capture.content, true);
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
  class="compact-item fade-in"
  class:trashed={capture.isTrashed}
  class:selected={isSelected}
  class:selection-mode={isSelectionMode}
  class:menu-open={showMenu}
  class:compact-density={$settings.density === 'compact'}
  role="button"
  tabindex="0"
  onclick={handleRowClick}
  onkeydown={handleRowKeydown}
  onmousedown={handleLongPressStart}
  onmouseup={handleLongPressEnd}
  onmouseleave={handleLongPressEnd}
  ontouchstart={handleLongPressStart}
  ontouchend={handleLongPressEnd}
  ontouchcancel={handleLongPressEnd}
>
  <div class="selection-control" class:active={$isSelectionActive || isSelected}>
    <input
      type="checkbox"
      checked={isSelected}
      onchange={toggle}
      onclick={(e) => e.stopPropagation()}
      aria-label="Select capture"
    />
  </div>

  <div class="content-row">
    <div class="row-left">
      <div class="meta-line">
        <span class={`type-pill type-${capture.type}`}>{typeLabels[capture.type]}</span>
        {#if capture.favicon}
          <img src={capture.favicon} alt="" class="favicon" />
        {/if}
        <span class="date">{formatDate(capture.createdAt)}</span>
        {#if capture.status === 'unread'}
          <span class="status-dot unread"></span>
        {:else if capture.status === 'archived'}
          <span class="status-pill">{t('status.archived')}</span>
        {/if}
        {#if capture.collectionId}
          {#each $collections.filter(c => c.id === capture.collectionId) as col}
            <span class="collection-dot" style="background:{col.color}" title={col.name}></span>
          {/each}
        {/if}
      </div>

      <div class="title-line">
        <h3 class="title">{truncate(capture.title || t('capture.noTitle'), 90)}</h3>
        {#if capture.type === 'link'}
          <span class="url-text">{truncate(capture.content, 48)}</span>
        {/if}
      </div>

      {#if $settings.density !== 'compact'}
        {#if capture.type === 'quote'}
          <p class="excerpt quote">"{truncate(capture.content, 120)}"</p>
        {:else if capture.type === 'note'}
          <p class="excerpt">{truncate(capture.content, 140)}</p>
        {/if}
      {/if}

      <!-- Status alerts (OCR or Archiving) -->
      <div class="row-alerts">
        {#if isOcrRunning}
          <span class="status-badge-run ocr"><span class="pulse-dot"></span> OCR running...</span>
        {:else if capture.ocrStatus === 'failed'}
          <span class="status-badge-run error">
            ⚠ OCR failed
            <button class="retry-inline-btn" onclick={handleRetryOcr}>Retry</button>
          </span>
        {/if}

        {#if capture.archiveStatus === 'pending'}
          <span class="status-badge-run archive"><span class="pulse-dot"></span> Archiving...</span>
        {:else if capture.archiveStatus === 'failed'}
          <span class="status-badge-run error">
            ⚠ Offline archive failed
            <button class="retry-inline-btn" onclick={handleRetryArchive}>Retry</button>
          </span>
        {/if}

        {#if reminderLabel()}
          <span class="reminder-badge" class:overdue={isReminderOverdue}>
            🔔 {isReminderOverdue ? 'Overdue' : reminderLabel()}
          </span>
        {/if}
      </div>

      {#if capture.tags.length > 0}
        <div class="tags-row">
          {#each capture.tags.slice(0, 3) as tag}
            <span class="tag">{tag}</span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Far Right elements: Thumbnail & Actions -->
    <div class="row-right">
      {#if capture.type === 'image' && capture.content}
        <div class="thumbnail">
          <img src={capture.content} alt={capture.title} loading="lazy" />
        </div>
      {:else if capture.type === 'link' && capture.ogImage}
        <div class="thumbnail">
          <img src={capture.ogImage} alt="" loading="lazy" />
        </div>
      {/if}

      {#if !isSelectionMode}
        <button class="menu-btn" onclick={(e) => { e.stopPropagation(); showMenu = !showMenu; }} aria-label="Compact item actions">...</button>
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
  .compact-item {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(var(--color-surface-raw), 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .compact-item.menu-open {
    z-index: 50;
  }

  .compact-item:hover {
    border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
    background: rgba(var(--color-surface-raw), 0.65);
    box-shadow: var(--shadow-sm);
  }

  .compact-item.selected {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 6%, rgba(var(--color-surface-raw), 0.65));
    box-shadow: 0 0 14px rgba(91, 78, 214, 0.12);
  }

  .compact-item.trashed {
    opacity: 0.65;
  }

  .selection-control {
    display: none;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .selection-control.active,
  .compact-item:hover .selection-control {
    display: flex;
  }

  .selection-control input {
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  .content-row {
    display: flex;
    flex-grow: 1;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
  }

  .row-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-grow: 1;
    min-width: 0;
  }

  .row-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .meta-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    flex-wrap: wrap;
  }

  .type-pill {
    padding: 1px 6px;
    border-radius: var(--radius-full);
    font-size: 10px;
    font-weight: 700;
  }

  .type-pill.type-link { color: #1d4ed8; background: #dbeafe; }
  .type-pill.type-quote { color: #7c3aed; background: #ede9fe; }
  .type-pill.type-note { color: #0f766e; background: #ccfbf1; }
  .type-pill.type-image { color: #be123c; background: #ffe4e6; }

  .favicon {
    width: 12px;
    height: 12px;
    object-fit: contain;
    border-radius: 2px;
  }

  .date {
    color: var(--color-text-secondary);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .status-dot.unread {
    background: #3b82f6;
  }

  .status-pill {
    padding: 1px 6px;
    border-radius: var(--radius-full);
    font-size: 10px;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-text-secondary) 15%, transparent);
  }

  .collection-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .title-line {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }

  .title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-text);
  }

  .url-text {
    font-size: 11px;
    color: var(--color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .excerpt {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }

  .excerpt.quote {
    font-style: italic;
    border-left: 2px solid var(--color-primary-subtle);
    padding-left: 6px;
  }

  .tags-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .tag {
    padding: 1px 6px;
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 10px;
    font-weight: 500;
  }

  .thumbnail {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .menu-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: 16px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .menu-btn:hover {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }

  /* Compact Density */
  .compact-density {
    padding: 6px 12px;
    margin-bottom: 4px;
  }

  .compact-density .title {
    font-size: 0.9rem;
  }

  .compact-density .thumbnail {
    width: 32px;
    height: 32px;
  }

  /* Async Status Badges */
  .row-alerts {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .status-badge-run {
    font-size: 10.5px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .status-badge-run.ocr, .status-badge-run.archive {
    color: var(--color-primary);
  }

  .status-badge-run.error {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    border: 1px dashed color-mix(in srgb, var(--color-danger) 25%, transparent);
  }

  .retry-inline-btn {
    background: var(--color-danger);
    color: white;
    border: none;
    border-radius: var(--radius-xs, 2px);
    padding: 1px 4px;
    font-size: 9px;
    cursor: pointer;
    font-weight: 700;
  }

  .retry-inline-btn:hover {
    background: color-mix(in srgb, var(--color-danger) 85%, black);
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    background-color: var(--color-primary);
    border-radius: 50%;
    animation: ocr-pulse 1.5s infinite ease-in-out;
  }

  @keyframes ocr-pulse {
    0% { transform: scale(0.8); opacity: 0.5; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(0.8); opacity: 0.5; }
  }

  .reminder-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    border-radius: var(--radius-full);
    font-size: 10px;
    font-weight: 600;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  .reminder-badge.overdue {
    color: #d97706;
    background: color-mix(in srgb, #f59e0b 14%, transparent);
    border-color: color-mix(in srgb, #f59e0b 30%, transparent);
  }

  .ctx-menu {
    position: absolute;
    top: 36px;
    right: 12px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    min-width: 180px;
    z-index: 30;
    padding: 4px;
  }

  .mi {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: var(--color-text);
    border-radius: var(--radius-sm);
    text-align: left;
  }

  .mi:hover { background: var(--color-surface); }
  .mi.danger { color: var(--color-danger); }
  .mi.danger:hover { background: #fff1f2; }

  .sub-menu {
    border-top: 1px solid var(--color-border);
    margin-top: 4px;
    padding-top: 4px;
    max-height: 150px;
    overflow-y: auto;
  }

  .mi.sub {
    font-size: 11px;
    padding: 4px 10px 4px 20px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dot { width: 6px; height: 6px; border-radius: 50%; }
</style>
