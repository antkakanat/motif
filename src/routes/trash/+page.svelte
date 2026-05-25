<script lang="ts">
  import { t } from '$lib/i18n';
  import { trashedCaptures } from '$lib/stores/captures';
  import CaptureBrowser from '$lib/components/CaptureBrowser.svelte';
</script>

<svelte:head><title>Trash — Motif</title></svelte:head>

<div class="page fade-in">
  <CaptureBrowser
    captures={$trashedCaptures}
    title={t('trash.title') || 'Trash'}
    icon="trash"
    emptyTitle={t('trash.empty') || 'Trash is empty'}
    emptyHint=""
    newBtnLabel=""
    newBtnTab="link"
    isTrashView={true}
    showTypeFilter={true}
    showStatusFilter={false}
  />
</div>

<style>
  .page { max-width: 100%; }
</style>
