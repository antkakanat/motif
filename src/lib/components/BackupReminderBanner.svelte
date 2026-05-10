<script lang="ts">
  import { t } from '$lib/i18n';
  import { settings, shouldShowBackupReminder } from '$lib/stores/settings';

  let dismissed = $state(false);

  // Reactively derive visibility from the settings store.
  // Shows when:
  //   - lastBackupAt is null AND install is older than 30 days, OR
  //   - lastBackupAt is set and more than 30 days ago
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  let visible = $derived.by(() => {
    if (dismissed) return false;
    return shouldShowBackupReminder();
  });
</script>

{#if visible}
  <div class="banner fade-in" role="alert">
    <span class="banner-icon">💾</span>
    <p class="banner-text">{t('settings.backupReminder')}</p>
    <div class="banner-actions">
      <button class="banner-btn" disabled title="Export coming in Phase 2">
        {t('settings.backupNow')}
      </button>
      <button class="banner-close" onclick={() => dismissed = true} aria-label="Dismiss">✕</button>
    </div>
  </div>
{/if}

<style>
  .banner { display:flex; align-items:center; gap:12px; padding:12px 16px; background:var(--color-primary-subtle); border:1px solid var(--color-border); border-radius:var(--radius-md); margin:0 0 16px; }
  .banner-icon { font-size:20px; flex-shrink:0; }
  .banner-text { flex:1; font-size:13px; color:var(--color-text); margin:0; }
  .banner-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .banner-btn { padding:6px 14px; background:var(--color-primary); color:white; border:none; border-radius:var(--radius-md); font-size:12px; font-weight:500; cursor:pointer; font-family:var(--font-sans); }
  .banner-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .banner-close { background:none; border:none; cursor:pointer; color:var(--color-text-secondary); font-size:16px; padding:4px; }
</style>
