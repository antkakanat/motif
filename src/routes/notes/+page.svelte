<script lang="ts">
  import { t } from '$lib/i18n';
  import { capturesByType, addCapture, softDeleteCapture, updateCapture, type CreateCaptureInput } from '$lib/stores/captures';
  import { clearSelection, selectAll } from '$lib/stores/selection';
  import CaptureCard from '$lib/components/CaptureCard.svelte';
  import BulkActionBar from '$lib/components/BulkActionBar.svelte';
  import CaptureModal from '$lib/components/CaptureModal.svelte';
  import { registerShortcuts } from '$lib/shortcuts';
  import { onMount } from 'svelte';

  const captures = capturesByType('note');
  let visibleIds = $derived($captures.map((c) => c.id));
  let showModal = $state(false);

  onMount(() => {
    registerShortcuts([
      { key: 'A', label: 'Select All', description: 'Select all visible', shift: true, handler: () => selectAll(visibleIds) },
      { key: 'Escape', label: 'Clear', description: 'Clear selection', ctrlOrCmd: false, handler: () => clearSelection() }
    ]);
  });

  async function handleSave(data: CreateCaptureInput) { await addCapture({ ...data, type: 'note' }); }
  async function handleDelete(id: string) { await softDeleteCapture(id); }
  async function handleArchive(id: string) { await updateCapture(id, { status: 'archived' }); }
</script>

<svelte:head><title>Notes - Motif</title></svelte:head>

<div class="page fade-in">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title">✎ {t('nav.notes')}</h1>
      <span class="count">{$captures.length}</span>
    </div>
    <button class="btn-new" onclick={() => (showModal = true)}>+ {t('capture.addNote')}</button>
  </div>

  {#if $captures.length > 0}
    <div class="grid">
      {#each $captures as capture (capture.id)}
        <CaptureCard {capture} onDelete={handleDelete} onArchive={handleArchive} {visibleIds} />
      {/each}
    </div>
  {:else}
    <div class="empty slide-up">
      <div class="empty-icon">✎</div>
      <h2>{t('empty.notes')}</h2>
      <p>{t('empty.notesHint')}</p>
    </div>
  {/if}
</div>

<CaptureModal bind:open={showModal} defaultTab="note" onSave={handleSave} />
<BulkActionBar {visibleIds} />

<style>
  .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
  .header-left { display:flex; align-items:center; gap:10px; }
  .page-title { font-size:1.5rem; font-weight:700; color:var(--color-text); margin:0; }
  .count { padding:2px 10px; background:var(--color-primary-subtle); color:var(--color-primary); border-radius:var(--radius-full); font-size:0.8125rem; font-weight:600; }
  .btn-new { padding:10px 20px; background:var(--color-primary); color:white; border:none; border-radius:var(--radius-md); font-size:0.875rem; font-weight:500; cursor:pointer; font-family:var(--font-sans); transition:all var(--duration-fast); }
  .btn-new:hover { background:var(--color-primary-hover); }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
  .empty { display:flex; flex-direction:column; align-items:center; padding:80px 20px; text-align:center; }
  .empty-icon { font-size:4rem; margin-bottom:16px; opacity:0.6; }
  .empty h2 { font-size:1.25rem; font-weight:600; color:var(--color-text); margin:0 0 8px; }
  .empty p { font-size:0.875rem; color:var(--color-text-secondary); margin:0; }
</style>
