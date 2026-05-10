<script lang="ts">
  import { t } from '$lib/i18n';
  import { selectedIds, clearSelection, selectAll } from '$lib/stores/selection';
  import { bulkSoftDelete, bulkUpdateTags, bulkMoveToCollection } from '$lib/stores/captures';
  import { collections } from '$lib/stores/collections';
  import { exportData } from '$lib/export';
  import { fade, slide } from 'svelte/transition';

  let { visibleIds }: { visibleIds: string[] } = $props();

  let showTagPicker = $state(false);
  let showCollectionPicker = $state(false);
  let tagInput = $state('');
  let isExporting = $state(false);

  async function handleDelete() {
    if (confirm(`Move ${$selectedIds.size} items to trash?`)) {
      await bulkSoftDelete([...$selectedIds]);
      clearSelection();
    }
  }

  async function handleAddTags() {
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      await bulkUpdateTags([...$selectedIds], tags, true);
      tagInput = '';
      showTagPicker = false;
      clearSelection();
    }
  }

  async function handleMove(colId: string | null) {
    await bulkMoveToCollection([...$selectedIds], colId);
    showCollectionPicker = false;
    clearSelection();
  }

  async function handleExport() {
    isExporting = true;
    try {
      await exportData('selection', [...$selectedIds]);
      clearSelection();
    } finally {
      isExporting = false;
    }
  }

  function toggleTagPicker(e: MouseEvent) {
    e.stopPropagation();
    showTagPicker = !showTagPicker;
    showCollectionPicker = false;
  }

  function toggleCollectionPicker(e: MouseEvent) {
    e.stopPropagation();
    showCollectionPicker = !showCollectionPicker;
    showTagPicker = false;
  }
</script>

{#if $selectedIds.size > 0}
  <div class="bulk-bar-container" transition:fade={{ duration: 200 }}>
    <div class="bulk-bar shadow-lg">
      <div class="selection-info">
        <span class="count">{$selectedIds.size}</span>
        <span class="label">{t('common.selected', { defaultValue: 'selected' })}</span>
      </div>

      <div class="divider"></div>

      <div class="actions">
        <!-- Select All / Clear -->
        <button class="btn-ghost" onclick={() => selectAll(visibleIds)}>{t('common.selectAll', { defaultValue: 'Select All' })}</button>
        <button class="btn-ghost" onclick={clearSelection}>{t('capture.cancel')}</button>

        <div class="divider"></div>

        <!-- Tagging -->
        <div class="action-wrapper">
          <button class="btn-action" onclick={toggleTagPicker}>
            <span class="icon">🏷️</span> {t('tags.addTag')}
          </button>
          {#if showTagPicker}
            <div class="picker tag-picker" transition:slide={{ duration: 150 }}>
              <input 
                type="text" 
                bind:value={tagInput} 
                placeholder="Tags (comma separated)..." 
                onkeydown={(e) => e.key === 'Enter' && handleAddTags()}
                autofocus
              />
              <button class="btn-primary" onclick={handleAddTags}>{t('capture.save')}</button>
            </div>
          {/if}
        </div>

        <!-- Collections -->
        <div class="action-wrapper">
          <button class="btn-action" onclick={toggleCollectionPicker}>
            <span class="icon">📂</span> {t('nav.collections')}
          </button>
          {#if showCollectionPicker}
            <div class="picker collection-picker" transition:slide={{ duration: 150 }}>
              <button class="picker-item" onclick={() => handleMove(null)}>
                <em>— {t('collections.none')} —</em>
              </button>
              {#each $collections as col}
                <button class="picker-item" onclick={() => handleMove(col.id)}>
                  <span class="dot" style="background: {col.color}"></span>
                  {col.name}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Export -->
        <button class="btn-action" onclick={handleExport} disabled={isExporting}>
          <span class="icon">{isExporting ? '⏳' : '📥'}</span> 
          {isExporting ? '...' : t('settings.exportData') || 'Export'}
        </button>

        <!-- Delete -->
        <button class="btn-action danger" onclick={handleDelete}>
          <span class="icon">🗑️</span> {t('capture.delete')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bulk-bar-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    pointer-events: none;
    width: auto;
    max-width: 90vw;
  }

  .bulk-bar {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    color: var(--color-text);
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 8px;
  }

  .count {
    font-weight: 700;
    color: var(--color-primary);
    font-size: 1.125rem;
  }

  .label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    font-weight: 500;
    text-transform: lowercase;
  }

  .divider {
    width: 1px;
    height: 24px;
    background: var(--color-border);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-ghost {
    background: none;
    border: none;
    padding: 6px 10px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--duration-fast);
  }

  .btn-ghost:hover {
    color: var(--color-text);
    background: var(--color-primary-subtle);
  }

  .btn-action {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 8px 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    cursor: pointer;
    border-radius: var(--radius-full);
    transition: all var(--duration-fast);
    white-space: nowrap;
  }

  .btn-action:hover {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }

  .btn-action.danger:hover {
    background: #fff1f2;
    color: var(--color-danger);
  }

  .action-wrapper {
    position: relative;
  }

  .picker {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 12px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    min-width: 220px;
    padding: 8px;
    z-index: 110;
  }

  .tag-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tag-picker input {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
    outline: none;
  }

  .tag-picker input:focus {
    border-color: var(--color-primary);
  }

  .collection-picker {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .picker-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--color-text);
    border-radius: var(--radius-md);
    transition: background var(--duration-fast);
  }

  .picker-item:hover {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    border: none;
    padding: 6px;
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .bulk-bar {
      gap: 8px;
      padding: 6px 10px;
    }
    .btn-action .icon { font-size: 1.125rem; }
    .btn-action span:not(.icon) { display: none; }
    .label { display: none; }
  }
</style>
