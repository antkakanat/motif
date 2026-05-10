<script lang="ts">
  import { t } from '$lib/i18n';
  import { trashedCaptures, restoreCapture, permanentDeleteCapture } from '$lib/stores/captures';
  import CaptureCard from '$lib/components/CaptureCard.svelte';

  async function handleRestore(id: string) { await restoreCapture(id); }
  async function handlePermanentDelete(id: string) { await permanentDeleteCapture(id); }
</script>

<svelte:head><title>Trash — Motif</title></svelte:head>

<div class="page fade-in">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title">🗑 {t('trash.title')}</h1>
      <span class="count">{$trashedCaptures.length}</span>
    </div>
  </div>

  <p class="auto-purge">{t('trash.autoPurge')}</p>

  {#if $trashedCaptures.length > 0}
    <div class="grid">
      {#each $trashedCaptures as capture (capture.id)}
        <CaptureCard {capture} onDelete={handlePermanentDelete} onRestore={handleRestore} />
      {/each}
    </div>
  {:else}
    <div class="empty slide-up">
      <div class="empty-icon">🗑</div>
      <h2>{t('trash.empty')}</h2>
    </div>
  {/if}
</div>

<style>
  .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .header-left { display:flex; align-items:center; gap:10px; }
  .page-title { font-size:24px; font-weight:700; color:var(--color-text); margin:0; }
  .count { padding:2px 10px; background:var(--color-primary-subtle); color:var(--color-primary); border-radius:var(--radius-full); font-size:13px; font-weight:600; }
  .auto-purge { font-size:13px; color:var(--color-text-secondary); margin:0 0 20px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
  .empty { display:flex; flex-direction:column; align-items:center; padding:80px 20px; text-align:center; }
  .empty-icon { font-size:64px; margin-bottom:16px; opacity:0.6; }
  .empty h2 { font-size:20px; font-weight:600; color:var(--color-text); margin:0; }
</style>
