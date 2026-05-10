<script lang="ts">
  import { t } from '$lib/i18n';
  import { factoryReset } from '$lib/stores/settings';

  let { open = $bindable(false) }: { open: boolean } = $props();

  let confirmText = $state('');
  let isDeleting = $state(false);

  const CONFIRM_PHRASE = 'DELETE MY DATA';
  $effect(() => { if (!open) confirmText = ''; });

  async function handleDelete() {
    if (confirmText !== CONFIRM_PHRASE) return;
    isDeleting = true;
    await factoryReset();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => open = false}>
    <div class="danger-modal scale-in" onclick={(e) => e.stopPropagation()}>
      <div class="danger-header">
        <span class="danger-icon">⚠️</span>
        <h2>{t('settings.clearData')}</h2>
      </div>
      <p class="danger-desc">{t('settings.clearDataWarning')}</p>
      <label class="danger-label" for="danger-confirm-input">{t('settings.clearDataConfirm')}</label>
      <input id="danger-confirm-input" type="text" class="danger-input" bind:value={confirmText} placeholder={CONFIRM_PHRASE} />
      <div class="danger-footer">
        <button class="btn-ghost" onclick={() => open = false}>{t('capture.cancel')}</button>
        <button class="btn-danger" disabled={confirmText !== CONFIRM_PHRASE || isDeleting} onclick={handleDelete}>
          {isDeleting ? t('common.loading') : t('settings.clearDataButton')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop { position:fixed; inset:0; background:rgba(15,14,26,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:100; padding:16px; }
  .danger-modal { background:var(--color-bg); border:2px solid var(--color-danger); border-radius:var(--radius-lg); width:100%; max-width:440px; padding:24px; box-shadow:var(--shadow-xl); }
  .danger-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
  .danger-header h2 { margin:0; font-size:18px; color:var(--color-danger); }
  .danger-icon { font-size:24px; }
  .danger-desc { font-size:14px; color:var(--color-text-secondary); line-height:1.6; margin:0 0 16px; }
  .danger-label { font-size:13px; font-weight:500; color:var(--color-text); display:block; margin-bottom:6px; }
  .danger-input { width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); color:var(--color-text); font-size:14px; font-family:var(--font-sans); outline:none; }
  .danger-input:focus { border-color:var(--color-danger); }
  .danger-footer { display:flex; justify-content:flex-end; gap:8px; margin-top:20px; }
  .btn-ghost { padding:8px 20px; background:none; border:none; color:var(--color-text-secondary); cursor:pointer; font-size:14px; border-radius:var(--radius-md); font-family:var(--font-sans); }
  .btn-danger { padding:8px 20px; background:var(--color-danger); color:white; border:none; border-radius:var(--radius-md); font-size:14px; font-weight:500; cursor:pointer; font-family:var(--font-sans); }
  .btn-danger:disabled { opacity:0.4; cursor:not-allowed; }
</style>
