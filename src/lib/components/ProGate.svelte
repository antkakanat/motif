<script lang="ts">
  import { t } from '$lib/i18n';
  import { isProUnlocked, type ProFeature } from '$lib/pro';
  import { CHECKOUT_URLS } from '$lib/constants';

  let {
    feature,
    featureLabel,
    children
  }: {
    feature: ProFeature;
    featureLabel?: string;
    children: import('svelte').Snippet;
  } = $props();

  // Reactively check Pro status
  let unlocked = $derived(isProUnlocked());
</script>

{#if unlocked}
  {@render children()}
{:else}
  <div class="pro-gate">
    <div class="gate-icon">🔒</div>
    <h3 class="gate-title">{t('pro.gate.title', { feature: featureLabel || feature })}</h3>
    <p class="gate-desc">{t('pro.gate.body')}</p>
    <a href={CHECKOUT_URLS.pro} target="_blank" rel="noopener" class="gate-btn">
      {t('pro.gate.cta')}
    </a>
  </div>
{/if}

<style>
  .pro-gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 24px;
    text-align: center;
    background: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
    gap: 8px;
  }

  .gate-icon { font-size: 40px; margin-bottom: 4px; }

  .gate-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }



  .gate-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0 0 8px;
  }

  .gate-btn {
    display: inline-block;
    padding: 10px 24px;
    background: var(--color-primary);
    color: white;
    text-decoration: none;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 600;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .gate-btn:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
</style>
