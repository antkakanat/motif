<script lang="ts">
  import { t } from '$lib/i18n';
  import { capturesByType } from '$lib/stores/captures';
  import CaptureBrowser from '$lib/components/CaptureBrowser.svelte';

  const captures = capturesByType('note');
</script>

<svelte:head><title>Notes — Motif</title></svelte:head>

<CaptureBrowser
  captures={$captures}
  title={t('nav.notes') || 'Notes'}
  icon="note"
  emptyTitle={t('empty.notes') || 'No saved notes'}
  emptyHint={t('empty.notesHint') || 'Capture your thoughts and ideas using text notes.'}
  newBtnLabel={t('capture.addNote') || 'Add Note'}
  newBtnTab="note"
  showTypeFilter={false}
  showStatusFilter={true}
/>
