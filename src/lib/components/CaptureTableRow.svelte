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
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role a11y_click_events_have_key_events -->
<tr
  class="table-row fade-in"
  class:trashed={capture.isTrashed}
  class:selected={isSelected}
  class:selection-mode={isSelectionMode}
  class:compact-density={$settings.density === 'compact'}
  class:menu-open={showMenu}
  role="button"
  tabindex="0"
  onclick={handleRowClick}
  onkeydown={handleRowKeydown}
  onmousedown={handleLongPressStart}
  onmouseup={handleLongPressEnd}
  onmouseleave={handleLongPressEnd}
>
  <td class="col-select" onclick={(e) => e.stopPropagation()}>
    <div class="checkbox-container" class:active={$isSelectionActive || isSelected}>
      <input
        type="checkbox"
        checked={isSelected}
        onchange={toggle}
        aria-label="Select capture"
      />
    </div>
  </td>

  <td class="col-title">
    <div class="title-cell">
      {#if capture.favicon}
        <img src={capture.favicon} alt="" class="favicon" />
      {:else}
        <span class="no-favicon">📄</span>
      {/if}
      
      <div class="title-text-group">
        <span class="title-text">{capture.title || t('capture.noTitle')}</span>
        {#if capture.type === 'link'}
          <span class="source-url">{truncate(capture.content, 54)}</span>
        {/if}
      </div>

      <div class="inline-badges">
        {#if isOcrRunning}
          <span class="badge ocr"><span class="pulse-dot"></span> OCR running...</span>
        {:else if capture.ocrStatus === 'failed'}
          <span class="badge error">
            ⚠ OCR failed
            <button class="retry-inline-btn" onclick={handleRetryOcr}>Retry</button>
          </span>
        {/if}

        {#if capture.archiveStatus === 'pending'}
          <span class="badge archive"><span class="pulse-dot"></span> Archiving...</span>
        {:else if capture.archiveStatus === 'failed'}
          <span class="badge error">
            ⚠ Offline archive failed
            <button class="retry-inline-btn" onclick={handleRetryArchive}>Retry</button>
          </span>
        {/if}

        {#if reminderLabel()}
          <span class="reminder-badge" class:overdue={isReminderOverdue}>
            🔔 {isReminderOverdue ? 'Overdue' : reminderLabel()}
          </span>
        {/if}
        
        {#if capture.status === 'unread'}
          <span class="unread-dot"></span>
        {/if}
      </div>
    </div>
  </td>

  <td class="col-type">
    <span class={`type-pill type-${capture.type}`}>{typeLabels[capture.type]}</span>
  </td>

  <td class="col-collection">
    {#if capture.collectionId}
      {#each $collections.filter(c => c.id === capture.collectionId) as col}
        <div class="collection-cell">
          <span class="collection-dot" style="background:{col.color}"></span>
          <span class="collection-name">{col.name}</span>
        </div>
      {/each}
    {:else}
      <span class="empty-cell">—</span>
    {/if}
  </td>

  <td class="col-tags">
    <div class="tags-container">
      {#each capture.tags.slice(0, 3) as tag}
        <span class="tag-badge">{tag}</span>
      {/each}
      {#if capture.tags.length > 3}
        <span class="tag-badge-more">+{capture.tags.length - 3}</span>
      {/if}
      {#if capture.tags.length === 0}
        <span class="empty-cell">—</span>
      {/if}
    </div>
  </td>

  <td class="col-date">
    <span class="date-text">{formatDate(capture.createdAt)}</span>
  </td>

  <td class="col-actions" onclick={(e) => e.stopPropagation()}>
    {#if !isSelectionMode}
      <button class="menu-btn" onclick={(e) => { e.stopPropagation(); showMenu = !showMenu; }} aria-label="Table row actions">...</button>
    {/if}

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
  </td>
</tr>

<style>
  .table-row {
    background: transparent;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
    cursor: pointer;
    transition: background var(--duration-fast), border-color var(--duration-fast);
  }

  .table-row.menu-open {
    position: relative;
    z-index: 50;
  }

  .table-row:hover {
    background: rgba(var(--color-surface-raw), 0.55);
  }

  .table-row.selected {
    background: color-mix(in srgb, var(--color-primary) 6%, rgba(var(--color-surface-raw), 0.45));
  }

  .table-row.trashed {
    opacity: 0.65;
  }

  td {
    padding: 14px 16px;
    font-size: 0.875rem;
    color: var(--color-text);
    vertical-align: middle;
  }

  /* Compact Density */
  .compact-density td {
    padding: 8px 16px;
    font-size: 0.8125rem;
  }

  .col-select {
    width: 44px;
    padding-right: 0;
  }

  .checkbox-container {
    display: none;
    align-items: center;
    justify-content: center;
  }

  .checkbox-container.active,
  .table-row:hover .checkbox-container {
    display: flex;
  }

  .checkbox-container input {
    width: 15px;
    height: 15px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  .col-title {
    max-width: 450px;
  }

  .title-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .favicon {
    width: 14px;
    height: 14px;
    object-fit: contain;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .no-favicon {
    font-size: 13px;
    opacity: 0.65;
    flex-shrink: 0;
  }

  .title-text-group {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .title-text {
    font-weight: 600;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.35;
  }

  .source-url {
    font-size: 10.5px;
    color: var(--color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 1px;
  }

  .inline-badges {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .badge {
    font-size: 10px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .badge.ocr, .badge.archive {
    color: var(--color-primary);
  }

  .badge.error {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    border: 1px dashed color-mix(in srgb, var(--color-danger) 25%, transparent);
  }

  .retry-inline-btn {
    background: var(--color-danger);
    color: white;
    border: none;
    border-radius: var(--radius-xs, 2px);
    padding: 0 4px;
    font-size: 8.5px;
    cursor: pointer;
    font-weight: 700;
    margin-left: 2px;
  }

  .pulse-dot {
    width: 5px;
    height: 5px;
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
    font-size: 9.5px;
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

  .unread-dot {
    width: 6px;
    height: 6px;
    background: #3b82f6;
    border-radius: 50%;
  }

  .col-type {
    width: 100px;
  }

  .type-pill {
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
  }

  .type-pill.type-link { color: #1d4ed8; background: #dbeafe; }
  .type-pill.type-quote { color: #7c3aed; background: #ede9fe; }
  .type-pill.type-note { color: #0f766e; background: #ccfbf1; }
  .type-pill.type-image { color: #be123c; background: #ffe4e6; }

  .col-collection {
    max-width: 180px;
  }

  .collection-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }

  .collection-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .collection-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-tags {
    max-width: 220px;
  }

  .tags-container {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
  }

  .tag-badge {
    padding: 1px 6px;
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 10px;
    font-weight: 500;
  }

  .tag-badge-more {
    font-size: 10px;
    color: var(--color-text-secondary);
    font-weight: 600;
    padding-left: 2px;
  }

  .empty-cell {
    color: var(--color-text-secondary);
    opacity: 0.55;
  }

  .col-date {
    width: 120px;
    color: var(--color-text-secondary);
  }

  .col-actions {
    width: 64px;
    position: relative;
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

  .ctx-menu {
    position: absolute;
    top: 36px;
    right: 16px;
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
