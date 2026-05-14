<script lang="ts">
  import { t } from '$lib/i18n';
  import { capturesByStatus, softDeleteCapture, updateCapture, addCapture, type CreateCaptureInput } from '$lib/stores/captures';
  import type { Capture, CaptureType } from '$lib/db';
  import CaptureCard from '$lib/components/CaptureCard.svelte';
  import CaptureModal from '$lib/components/CaptureModal.svelte';
  import { goto } from '$app/navigation';
  import { requestProFeature } from '$lib/pro';

  const archived = capturesByStatus('archived');
  let visibleIds = $derived($archived.map((capture) => capture.id));
  let showModal = $state(false);
  let editingCapture = $state<Capture | null>(null);
  let initialModalData = $state<any>(null);

  async function handleRestore(id: string) {
    await updateCapture(id, { status: 'saved' });
  }

  async function handleDelete(id: string) {
    await softDeleteCapture(id);
  }

  function openEditModal(capture: Capture) {
    editingCapture = capture;
    initialModalData = {
      type: capture.type,
      title: capture.title,
      content: capture.content,
      sourceUrl: capture.sourceUrl ?? '',
      collectionId: capture.collectionId ?? null,
      tags: [...capture.tags]
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

  async function handleSave(data: { type: CaptureType; title: string; content: string; tags: string[]; sourceUrl: string; collectionId: string | null }) {
    if (editingCapture) {
      await updateCapture(editingCapture.id, {
        type: data.type,
        title: data.title,
        content: data.content,
        tags: data.tags,
        sourceUrl: data.sourceUrl || null,
        collectionId: data.collectionId ?? null
      });
      editingCapture = null;
      initialModalData = null;
      return;
    }

    await addCapture(data as CreateCaptureInput);
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
        <CaptureCard
          {capture}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onEdit={openEditModal}
          onOpen={handleCardOpen}
          {visibleIds}
        />
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

<CaptureModal bind:open={showModal} onSave={handleSave} initialData={initialModalData} />

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
