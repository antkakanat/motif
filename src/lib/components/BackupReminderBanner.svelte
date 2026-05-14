<script lang="ts">
  import { t } from '$lib/i18n';
  import { shouldShowBackupReminder } from '$lib/stores/settings';
  import { goto } from '$app/navigation';

  let dismissed = $state(false);

  let visible = $derived.by(() => {
    if (dismissed) return false;
    return shouldShowBackupReminder();
  });
</script>

{#if visible}
  <div class="banner fade-in" role="alert">
    <span class="banner-icon" aria-hidden="true">*</span>
    <p class="banner-text">{t('settings.backupReminder')}</p>
    <button class="banner-link" onclick={() => goto('/settings')}>
      {t('settings.backupNow')}
    </button>
    <button class="banner-close" onclick={() => dismissed = true} aria-label="Dismiss">x</button>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    margin: 0 0 14px;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
    background: color-mix(in srgb, var(--color-primary-subtle) 74%, transparent);
  }

  .banner-icon {
    font-size: 13px;
    opacity: 0.75;
    flex-shrink: 0;
  }

  .banner-text {
    flex: 1;
    margin: 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.35;
  }

  .banner-link {
    background: none;
    border: none;
    color: var(--color-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    white-space: nowrap;
  }

  .banner-link:hover {
    background: var(--color-primary-subtle);
  }

  .banner-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1;
    padding: 2px 4px;
  }

  @media (max-width: 768px) {
    .banner {
      gap: 8px;
      padding: 8px 10px;
    }

    .banner-text {
      font-size: 11px;
    }
  }
</style>
