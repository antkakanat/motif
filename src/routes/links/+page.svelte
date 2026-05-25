<script lang="ts">
  import { t } from '$lib/i18n';
  import { capturesByType } from '$lib/stores/captures';
  import CaptureBrowser from '$lib/components/CaptureBrowser.svelte';

  const captures = capturesByType('link');
</script>

<svelte:head><title>Links — Motif</title></svelte:head>

<CaptureBrowser
  captures={$captures}
  title={t('nav.links') || 'Links'}
  icon="link"
  emptyTitle={t('empty.links') || 'No saved links'}
  emptyHint={t('empty.linksHint') || 'Links captured from browser extensions will appear here.'}
  newBtnLabel={t('capture.addLink') || 'Add Link'}
  newBtnTab="link"
  showTypeFilter={false}
  showStatusFilter={true}
/>
