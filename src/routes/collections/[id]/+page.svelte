<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/i18n';
  import { collections, updateCollection, deleteCollection } from '$lib/stores/collections';
  import { activeCaptures, softDeleteCapture, updateCapture, addCapture, type CreateCaptureInput } from '$lib/stores/captures';
  import { clearSelection, selectAll } from '$lib/stores/selection';
  import CaptureCard from '$lib/components/CaptureCard.svelte';
  import CaptureModal from '$lib/components/CaptureModal.svelte';
  import type { Capture, CaptureType } from '$lib/db';
  import BulkActionBar from '$lib/components/BulkActionBar.svelte';
  import { goto } from '$app/navigation';
  import { registerShortcuts } from '$lib/shortcuts';
  import { onMount, tick } from 'svelte';
  import { requestProFeature } from '$lib/pro';

  let collection = $derived($collections.find(c => c.id === $page.params.id));
  let items = $derived($activeCaptures.filter(c => c.collectionId === $page.params.id));
  let visibleIds = $derived(items.map(c => c.id));

  onMount(() => {
    registerShortcuts([
      { key: 'A', label: 'Select All', description: 'Select all in collection', shift: true, handler: () => selectAll(visibleIds) },
      { key: 'Escape', label: 'Clear', description: 'Clear selection', ctrlOrCmd: false, handler: () => clearSelection() }
    ]);
  });

  let isEditing = $state(false);
  let showModal = $state(false);
  let editingCapture = $state<Capture | null>(null);
  let initialModalData = $state<any>(null);
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

  async function handleDeleteCapture(id: string) {
    await softDeleteCapture(id);
  }

  async function handleArchiveCapture(id: string) {
    await updateCapture(id, { status: 'archived' });
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
</script>

<svelte:head>
  <title>{collection?.name || 'Collection'} — Motif</title>
</svelte:head>

<div class="page fade-in">
  {#if collection}
    <div class="page-header">
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
          <h1 class="page-title">
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

    {#if items.length > 0}
      <div class="capture-grid">
        {#each items as capture (capture.id)}
          <CaptureCard 
            {capture} 
            onDelete={handleDeleteCapture} 
            onArchive={handleArchiveCapture}
            onEdit={openEditModal}
            onOpen={handleCardOpen}
            {visibleIds}
          />
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h2 class="empty-title">{t('collections.empty')}</h2>
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <h2 class="empty-title">Collection not found</h2>
      <a href="/" class="btn-primary">Go Home</a>
    </div>
  {/if}
</div>

<BulkActionBar {visibleIds} />
<CaptureModal bind:open={showModal} onSave={handleSave} initialData={initialModalData} />

<style>
  .page { max-width: 100%; }
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; gap: 16px; }
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

  .capture-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100px 20px;
    text-align: center;
  }

  .empty-icon { font-size: 4rem; margin-bottom: 16px; opacity: 0.3; }
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
