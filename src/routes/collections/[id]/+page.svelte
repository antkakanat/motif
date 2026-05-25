<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/i18n';
  import { collections, updateCollection, deleteCollection } from '$lib/stores/collections';
  import { activeCaptures } from '$lib/stores/captures';
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';
  import { requestProFeature } from '$lib/pro';
  import CaptureBrowser from '$lib/components/CaptureBrowser.svelte';

  let collection = $derived($collections.find(c => c.id === $page.params.id));
  let items = $derived($activeCaptures.filter(c => c.collectionId === $page.params.id));

  let isEditing = $state(false);
  let editName = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  async function startEditing() {
    if (!collection) return;
    editName = collection.name;
    isEditing = true;
    await tick();
    inputEl?.focus();
  }

  async function saveRename() {
    if (!collection) {
      isEditing = false;
      return;
    }
    const nextName = editName.trim();
    if (!nextName || nextName === collection.name) {
      isEditing = false;
      return;
    }

    const allowed = await requestProFeature('collections', 'Collections');
    if (!allowed) return;

    await updateCollection(collection.id, { name: nextName });
    isEditing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveRename();
    if (e.key === 'Escape') isEditing = false;
  }

  async function handleDeleteCollection() {
    const allowed = await requestProFeature('collections', 'Collections');
    if (!allowed) return;

    if (confirm(t('collections.deleteConfirm')) && collection) {
      await deleteCollection(collection.id);
      await goto('/');
    }
  }
</script>

<svelte:head>
  <title>{collection?.name || 'Collection'} — Motif</title>
</svelte:head>

<div class="page fade-in">
  {#if collection}
    <div class="custom-collection-header">
      <div class="header-left">
        <span class="collection-dot" style="background: {collection.color}"></span>
        {#if isEditing}
          <input
            bind:this={inputEl}
            bind:value={editName}
            onkeydown={handleKeydown}
            onblur={saveRename}
            class="rename-input"
            maxlength="30"
          />
        {:else}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_to_interactive_role -->
          <h1 class="page-title" onclick={startEditing} role="button" tabindex="0">
            {collection.name}
          </h1>
        {/if}
        <span class="capture-count">{items.length}</span>
      </div>

      <div class="header-actions">
        <button class="btn-icon-only" onclick={startEditing} title={t('collections.rename')}>✎</button>
        <button class="btn-icon-only danger" onclick={handleDeleteCollection} title={t('collections.delete')}>🗑</button>
      </div>
    </div>

    <!-- CaptureBrowser handles search, sorting, layouts, modals, and list rendering -->
    <CaptureBrowser
      captures={$activeCaptures}
      title=""
      icon=""
      emptyTitle={t('collections.empty') || 'This collection is empty'}
      emptyHint=""
      newBtnLabel={t('capture.addNew') || 'Add New'}
      newBtnTab="link"
      collectionId={collection.id}
      showTypeFilter={true}
      showStatusFilter={true}
    />
  {:else}
    <div class="empty-state">
      <h2 class="empty-title">Collection not found</h2>
      <a href="/" class="btn-primary">Go Home</a>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 100%; }
  .custom-collection-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 16px; }
  .header-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
  
  .collection-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
    letter-spacing: -0.02em;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .page-title:hover {
    color: var(--color-primary);
  }

  .rename-input {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    background: none;
    border: none;
    border-bottom: 2px solid var(--color-primary);
    outline: none;
    padding: 0;
    margin: 0;
    width: 100%;
    font-family: var(--font-sans);
    letter-spacing: -0.02em;
  }

  .capture-count {
    padding: 2px 10px;
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 0.8125rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .btn-icon-only {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 1.125rem;
    transition: all var(--duration-fast);
  }

  .btn-icon-only:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-icon-only.danger:hover {
    border-color: var(--color-danger);
    color: var(--color-danger);
    background: #fff1f2;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100px 20px;
    text-align: center;
  }

  .empty-title { font-size: 1.25rem; font-weight: 600; color: var(--color-text-secondary); margin: 0; }

  .btn-primary {
    margin-top: 16px;
    padding: 10px 24px;
    background: var(--color-primary);
    color: white;
    text-decoration: none;
    border-radius: var(--radius-md);
    font-weight: 500;
  }
</style>
