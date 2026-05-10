<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Capture } from '$lib/db';
  import { selectedIds, isSelectionActive, toggleSelection, rangeSelect } from '$lib/stores/selection';
  import { onMount } from 'svelte';

  let {
    capture, onDelete, onArchive, onRestore, onEdit, visibleIds
  }: {
    capture: Capture;
    onDelete?: (id: string) => void;
    onArchive?: (id: string) => void;
    onRestore?: (id: string) => void;
    onEdit?: (capture: Capture) => void;
    visibleIds?: string[];
  } = $props();

  let showMenu = $state(false);
  let isSelected = $derived($selectedIds.has(capture.id));

  let longPressTimer: any;

  const typeIcons: Record<string, string> = { link: '🔗', quote: '❝', note: '✎', image: '◻' };
  const statusColors: Record<string, string> = {
    unread: 'var(--color-primary)', saved: 'var(--color-accent)', archived: 'var(--color-text-secondary)'
  };

  function formatDate(iso: string): string {
    const d = new Date(iso), now = new Date(), ms = now.getTime() - d.getTime();
    const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), dy = Math.floor(ms / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (dy < 7) return `${dy}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function truncate(s: string, n: number): string { return s.length <= n ? s : s.slice(0, n).trim() + '…'; }

  function getPreview(): string {
    if (capture.type === 'note') {
      try { return extractText(JSON.parse(capture.content)); } catch { return capture.content; }
    }
    return capture.content;
  }

  function extractText(node: Record<string, unknown>): string {
    const p: string[] = [];
    if (typeof node.text === 'string') p.push(node.text);
    if (Array.isArray(node.content)) for (const c of node.content) p.push(extractText(c as Record<string, unknown>));
    return p.join(' ');
  }

  function closeMenu() { showMenu = false; }

  function handleCardClick(e: MouseEvent) {
    if (e.shiftKey && visibleIds) {
      e.preventDefault();
      rangeSelect(capture.id, visibleIds);
    } else if ($isSelectionActive) {
      // If we're already selecting, clicking anywhere toggles it
      // unless it's a link/menu button (handled by those elements)
    }
  }

  function toggle() {
    toggleSelection(capture.id);
  }

  function handleLongPressStart() {
    longPressTimer = setTimeout(() => {
      toggleSelection(capture.id);
    }, 600);
  }

  function handleLongPressEnd() {
    clearTimeout(longPressTimer);
  }
</script>

<article 
  class="card fade-in" 
  class:trashed={capture.isTrashed}
  class:selected={isSelected}
  onclick={handleCardClick}
  onmousedown={handleLongPressStart}
  onmouseup={handleLongPressEnd}
  ontouchstart={handleLongPressStart}
  ontouchend={handleLongPressEnd}
>
  <div class="card-header">
    <div class="selection-control" class:active={$isSelectionActive || isSelected}>
      <input 
        type="checkbox" 
        checked={isSelected} 
        onchange={toggle} 
        onclick={(e) => e.stopPropagation()} 
        aria-label="Select capture"
      />
    </div>
    <span class="type-icon">{typeIcons[capture.type]}</span>
    <span class="status-dot" style="background:{statusColors[capture.status]}"></span>
    <span class="card-date">{formatDate(capture.createdAt)}</span>
    <button class="menu-btn" onclick={(e) => { e.stopPropagation(); showMenu = !showMenu; }}>⋯</button>
  </div>
  <div class="card-body">
    <h3 class="card-title">{truncate(capture.title || t('capture.noTitle'), 80)}</h3>
    {#if capture.type === 'image' && capture.content}
      <img src={capture.content} alt={capture.title} class="card-image" loading="lazy" />
    {:else if capture.type === 'quote'}
      <blockquote class="card-quote">"{truncate(capture.content, 200)}"</blockquote>
    {:else if capture.type === 'link'}
      <div class="link-container">
        <a href={capture.content} class="card-link" target="_blank" rel="noopener">{truncate(capture.content, 50)}</a>
        <a href="/read/{capture.id}" class="read-card-btn" onclick={(e) => e.stopPropagation()}>
          📖 {t('capture.read') || 'Read'}
        </a>
      </div>
    {:else}
      <p class="card-preview">{truncate(getPreview(), 200)}</p>
    {/if}
  </div>
  {#if capture.tags.length > 0}
    <div class="card-tags">
      {#each capture.tags as tag}<span class="card-tag">{tag}</span>{/each}
    </div>
  {/if}
  {#if showMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="ctx-menu scale-in" onclick={(e) => e.stopPropagation()}>
      {#if !capture.isTrashed}
        {#if onEdit}<button class="mi" onclick={() => { onEdit(capture); closeMenu(); }}>✏️ {t('capture.edit')}</button>{/if}
        {#if onArchive}<button class="mi" onclick={() => { onArchive(capture.id); closeMenu(); }}>📦 {t('capture.archive')}</button>{/if}
        {#if onDelete}<button class="mi danger" onclick={() => { onDelete(capture.id); closeMenu(); }}>🗑 {t('capture.delete')}</button>{/if}
      {:else}
        {#if onRestore}<button class="mi" onclick={() => { onRestore(capture.id); closeMenu(); }}>↩️ {t('capture.restore')}</button>{/if}
        {#if onDelete}<button class="mi danger" onclick={() => { onDelete(capture.id); closeMenu(); }}>💀 {t('capture.deletePermanently')}</button>{/if}
      {/if}
    </div>
  {/if}
</article>

<style>
  .card { 
    position:relative; 
    background:var(--color-surface); 
    border:1px solid var(--color-border); 
    border-radius:var(--radius-lg); 
    padding:16px; 
    transition:all var(--duration-fast) var(--ease-out); 
  }

  .card:hover { 
    border-color:var(--color-primary); 
    box-shadow:var(--shadow-sm); 
    transform:translateY(-1px); 
  }

  .card.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .card.trashed { opacity:0.7; }

  .selection-control {
    display: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-right: 4px;
  }

  .selection-control.active, .card:hover .selection-control {
    display: flex;
  }

  .selection-control input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }

  .card-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .type-icon { font-size:16px; }
  .status-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
  .card-date { font-size:12px; color:var(--color-text-secondary); flex:1; }
  .menu-btn { background:none; border:none; cursor:pointer; color:var(--color-text-secondary); font-size:18px; padding:4px 8px; border-radius:var(--radius-sm); transition:background var(--duration-fast); line-height:1; }
  .menu-btn:hover { background:var(--color-primary-subtle); color:var(--color-primary); }
  .card-body { margin-bottom:8px; }
  .card-title { font-size:15px; font-weight:600; color:var(--color-text); margin:0 0 6px; line-height:1.4; }
  .card-image { width:100%; max-height:180px; object-fit:cover; border-radius:var(--radius-md); margin-top:8px; }
  .card-quote { margin:0; padding:8px 12px; border-left:3px solid var(--color-primary); background:var(--color-primary-subtle); border-radius:0 var(--radius-sm) var(--radius-sm) 0; font-size:13px; font-style:italic; line-height:1.6; }
  .card-link { font-size:13px; color:var(--color-primary); text-decoration:none; word-break:break-all; flex: 1; }
  .card-link:hover { text-decoration:underline; }
  .link-container { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
  .read-card-btn { 
    display: inline-flex; 
    align-items: center; 
    gap: 4px; 
    font-size: 12px; 
    color: var(--color-text-secondary); 
    text-decoration: none; 
    padding: 4px 8px; 
    background: var(--color-surface); 
    border: 1px solid var(--color-border); 
    border-radius: var(--radius-sm); 
    white-space: nowrap;
    transition: all var(--duration-fast);
  }
  .read-card-btn:hover {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .card-preview { font-size:13px; color:var(--color-text-secondary); margin:0; line-height:1.5; }
  .card-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
  .card-tag { padding:2px 8px; background:var(--color-primary-subtle); color:var(--color-primary); border-radius:var(--radius-full); font-size:11px; font-weight:500; }
  .ctx-menu { position:absolute; top:48px; right:12px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:var(--radius-md); box-shadow:var(--shadow-lg); min-width:180px; z-index:30; padding:4px; }
  .mi { display:flex; align-items:center; gap:10px; width:100%; padding:8px 12px; background:none; border:none; cursor:pointer; font-size:13px; color:var(--color-text); border-radius:var(--radius-sm); transition:background var(--duration-fast); font-family:var(--font-sans); text-align:left; }
  .mi:hover { background:var(--color-surface); }
  .mi.danger { color:var(--color-danger); }
  .mi.danger:hover { background:var(--color-danger-subtle); }
</style>
