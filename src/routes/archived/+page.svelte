<script lang="ts">
  import { t } from '$lib/i18n';
  import { capturesByStatus } from '$lib/stores/captures';
  import CaptureBrowser from '$lib/components/CaptureBrowser.svelte';

  const archived = capturesByStatus('archived');
</script>

<svelte:head><title>Archived — Motif</title></svelte:head>

<CaptureBrowser
  captures={$archived}
  title={t('status.archived') || 'Archived'}
  icon="archived"
  emptyTitle="No archived captures"
  emptyHint="Archived captures stay here until you restore them."
  newBtnLabel={t('capture.addNew') || 'Add New'}
  newBtnTab="link"
  isArchiveView={true}
  showTypeFilter={true}
  showStatusFilter={false}
/>
