<script lang="ts">
  import { t } from '$lib/i18n';
  import { capturesByStatus, softDeleteCapture, updateCapture } from '$lib/stores/captures';
  import CaptureCard from '$lib/components/CaptureCard.svelte';

  const archived = capturesByStatus('archived');
  let visibleIds = $derived($archived.map((capture) => capture.id));

  async function handleRestore(id: string) {
    await updateCapture(id, { status: 'saved' });
  }

  async function handleDelete(id: string) {
    await softDeleteCapture(id);
  }
</script>

<svelte:head><title>Archived - Motif</title></svelte:head>

<div class="page fade-in">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title">{t('status.archived')}</h1>
      <span class="count">{$archived.length}</span>
    </div>
  </div>

  {#if $archived.length > 0}
    <div class="grid">
      {#each $archived as capture (capture.id)}
        <CaptureCard {capture} onDelete={handleDelete} onRestore={handleRestore} {visibleIds} />
      {/each}
    </div>
  {:else}
    <div class="empty slide-up">
      <div class="empty-icon">📦</div>
      <h2>No archived captures</h2>
      <p>Archived captures stay here until you restore them.</p>
    </div>
  {/if}
</div>

<style>
  .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
  .header-left { display:flex; align-items:center; gap:10px; }
  .page-title { font-size:1.5rem; font-weight:700; color:var(--color-text); margin:0; }
  .count { padding:2px 10px; background:var(--color-primary-subtle); color:var(--color-primary); border-radius:var(--radius-full); font-size:0.8125rem; font-weight:600; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
  .empty { display:flex; flex-direction:column; align-items:center; padding:80px 20px; text-align:center; }
  .empty-icon { font-size:3rem; margin-bottom:16px; opacity:0.7; }
  .empty h2 { font-size:1.125rem; color:var(--color-text); margin:0 0 8px; }
  .empty p { font-size:0.875rem; color:var(--color-text-secondary); margin:0; }
</style>
