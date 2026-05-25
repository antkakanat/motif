<script lang="ts">
  import { t } from '$lib/i18n';
  import { capturesByType } from '$lib/stores/captures';
  import CaptureBrowser from '$lib/components/CaptureBrowser.svelte';

  const captures = capturesByType('image');
</script>

<svelte:head><title>Images — Motif</title></svelte:head>

<CaptureBrowser
  captures={$captures}
  title={t('nav.images') || 'Images'}
  icon="image"
  emptyTitle={t('empty.images') || 'No saved images'}
  emptyHint={t('empty.imagesHint') || 'Drag & drop screenshots or upload photos to scan with local OCR.'}
  newBtnLabel={t('capture.addImage') || 'Add Image'}
  newBtnTab="image"
  showTypeFilter={false}
  showStatusFilter={true}
/>
