<script lang="ts">
  import { t } from '$lib/i18n';
  import { CHECKOUT_URLS } from '$lib/constants';
  import { proGateModal, resolveProGateModal } from '$lib/stores/proGate';
  import { goto } from '$app/navigation';

  function getFeatureLabel(): string {
    if (!$proGateModal.feature) return '';
    const key = `pro.gate.feature.${$proGateModal.feature}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return $proGateModal.featureLabel || $proGateModal.feature;
  }

  function closeModal() {
    resolveProGateModal(false);
  }

  function handleUpgradeClick() {
    resolveProGateModal(false);
  }

  function openSettings() {
    resolveProGateModal(false);
    void goto('/settings');
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }
</script>

{#if $proGateModal.open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
    <div
      class="modal scale-in"
      role="dialog"
      aria-modal="true"
      aria-label={t('pro.gate.title', { feature: getFeatureLabel() })}
    >
      <div class="modal-header">
        <h2 class="modal-title">{t('pro.gate.title', { feature: getFeatureLabel() })}</h2>
        <button class="btn-close" onclick={closeModal} aria-label={t('common.close')}>×</button>
      </div>

      <div class="modal-body">
        <p class="modal-desc">{t('pro.gate.body')}</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick={openSettings}>Settings</button>
        <button
          class="btn btn-primary"
          onclick={(e) => {
            handleUpgradeClick();
            if ((window as any).LemonSqueezy) {
              try {
                (window as any).LemonSqueezy.Url.Open(CHECKOUT_URLS.pro);
                return;
              } catch (err) {
                console.error('Failed to open LemonSqueezy overlay:', err);
              }
            }
            window.open(CHECKOUT_URLS.pro, '_blank', 'noopener,noreferrer');
          }}
        >
          {t('pro.gate.cta')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15, 14, 26, 0.5);
    backdrop-filter: blur(4px);
  }

  .modal {
    width: 100%;
    max-width: 440px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 650;
    color: var(--color-text);
  }

  .btn-close {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-secondary);
    font-size: 1.2rem;
    cursor: pointer;
    line-height: 1;
  }

  .btn-close:hover {
    color: var(--color-text);
    background: var(--color-surface);
  }

  .modal-body {
    padding: 16px 18px 4px;
  }

  .modal-desc {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 18px 18px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-sans);
    transition: all var(--duration-fast) var(--ease-out);
  }

  .btn-ghost {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text-secondary);
  }

  .btn-ghost:hover {
    color: var(--color-text);
    border-color: var(--color-primary);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }
</style>
