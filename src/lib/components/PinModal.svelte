<script lang="ts">
  import { t } from '$lib/i18n';
  import { settings, setPin, clearPin, hashPin } from '$lib/stores/settings';

  let {
    open = $bindable(false)
  }: {
    open: boolean;
  } = $props();

  let mode = $derived($settings.pinHash ? 'change' : 'set');
  let step = $state(1); // 1: enter new pin, 2: confirm pin

  let pin1 = $state('');
  let pin2 = $state('');
  let error = $state('');

  function reset() {
    pin1 = '';
    pin2 = '';
    error = '';
    step = 1;
  }

  function close() {
    open = false;
    reset();
  }

  async function handleNext() {
    if (pin1.length < 4) {
      error = t('settings.pinTooShort') || 'PIN must be at least 4 digits';
      return;
    }
    error = '';
    step = 2;
  }

  async function handleSave() {
    if (pin1 !== pin2) {
      error = t('settings.pinMismatch');
      return;
    }

    const hash = await hashPin(pin1);
    await setPin(hash, pin1.length);
    close();
  }

  async function handleRemove() {
    if (confirm(t('settings.pinRemoveConfirm') || 'Are you sure you want to remove the PIN lock?')) {
      await clearPin();
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') {
      if (step === 1) handleNext();
      else handleSave();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdropClick} transition:fade={{ duration: 150 }} role="presentation">
    <div class="modal scale-in" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('settings.pinLock')}>
      <div class="modal-header">
        <h2 class="modal-title">{t('settings.pinLock')}</h2>
        <button class="btn-close" onclick={close}>×</button>
      </div>

      <div class="modal-body">
        {#if step === 1}
          <p class="modal-desc">{mode === 'set' ? t('settings.pinNew') : t('settings.pinChange')}</p>
          <input
            type="password"
            inputmode="numeric"
            pattern="[0-9]*"
            class="pin-input"
            placeholder="••••"
            bind:value={pin1}
            maxlength="8"
            autofocus
          />
        {:else}
          <p class="modal-desc">{t('settings.pinConfirm')}</p>
          <input
            type="password"
            inputmode="numeric"
            pattern="[0-9]*"
            class="pin-input"
            placeholder="••••"
            bind:value={pin2}
            maxlength="8"
            autofocus
          />
        {/if}

        {#if error}
          <p class="error-text">{error}</p>
        {/if}
      </div>

      <div class="modal-footer">
        {#if $settings.pinHash && step === 1}
          <button class="btn btn-danger-ghost" onclick={handleRemove}>{t('settings.pinRemove')}</button>
        {/if}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick={close}>{t('capture.cancel')}</button>
        {#if step === 1}
          <button class="btn btn-primary" onclick={handleNext}>{t('common.next')}</button>
        {:else}
          <button class="btn btn-primary" onclick={handleSave}>{t('common.done')}</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 14, 26, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }

  .modal {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 360px;
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    line-height: 1;
  }

  .modal-body {
    padding: 24px 20px;
    text-align: center;
  }

  .modal-desc {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin: 0 0 16px;
  }

  .pin-input {
    width: 160px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 1.5rem;
    text-align: center;
    letter-spacing: 0.5em;
    outline: none;
    font-family: monospace;
  }

  .pin-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(91, 78, 214, 0.1);
  }

  .error-text {
    font-size: 0.8125rem;
    color: var(--color-danger);
    margin: 12px 0 0;
  }

  .modal-footer {
    display: flex;
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
    gap: 8px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
    border: none;
    font-family: var(--font-sans);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-ghost {
    background: none;
    color: var(--color-text-secondary);
  }

  .btn-ghost:hover {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .btn-danger-ghost {
    background: none;
    color: var(--color-danger);
  }

  .btn-danger-ghost:hover {
    background: #fff1f2;
  }
</style>
