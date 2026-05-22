<script lang="ts">
  import { t } from '$lib/i18n';
  import { isProUnlocked, type ProFeature } from '$lib/pro';
  import { CHECKOUT_URLS, getCheckoutUrl } from '$lib/constants';

  let {
    feature,
    featureLabel,
    children
  }: {
    feature: ProFeature;
    featureLabel?: string;
    children: import('svelte').Snippet;
  } = $props();

  let unlocked = $derived(isProUnlocked());

  function getFeatureLabel(): string {
    const key = `pro.gate.feature.${feature}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return featureLabel || feature;
  }
</script>

{#if unlocked}
  {@render children()}
{:else}
  <div class="pro-gate">
    <div class="gate-icon">PRO</div>
    <h3 class="gate-title">{t('pro.gate.title', { feature: getFeatureLabel() })}</h3>
    <p class="gate-desc">{t('pro.gate.body')}</p>
    <button
      class="gate-btn"
      onclick={(e) => {
        e.preventDefault();
        const targetUrl = getCheckoutUrl(CHECKOUT_URLS.pro);
        if ((window as any).LemonSqueezy) {
          try {
            (window as any).LemonSqueezy.Url.Open(targetUrl);
            return;
          } catch (err) {
            console.error('Failed to open LemonSqueezy overlay:', err);
          }
        }
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }}
    >
      {t('pro.gate.cta')}
    </button>
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

  .gate-icon {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-primary);
    padding: 6px 10px;
    border-radius: var(--radius-full);
    background: var(--color-primary-subtle);
    margin-bottom: 4px;
  }

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
