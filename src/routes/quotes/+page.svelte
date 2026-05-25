<script lang="ts">
  import { t } from '$lib/i18n';
  import { capturesByType } from '$lib/stores/captures';
  import CaptureBrowser from '$lib/components/CaptureBrowser.svelte';

  const captures = capturesByType('quote');
</script>

<svelte:head><title>Quotes — Motif</title></svelte:head>

<CaptureBrowser
  captures={$captures}
  title={t('nav.quotes') || 'Quotes'}
  icon="quote"
  emptyTitle={t('empty.quotes') || 'No saved quotes'}
  emptyHint={t('empty.quotesHint') || 'Save highlights and memorable text snippets here.'}
  newBtnLabel={t('capture.addQuote') || 'Add Quote'}
  newBtnTab="quote"
  showTypeFilter={false}
  showStatusFilter={true}
/>
