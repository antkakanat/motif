<script lang="ts">
  import { t } from '$lib/i18n';
  import { CHECKOUT_URLS } from '$lib/constants';
  import { settings, setAutoLockMinutes } from '$lib/stores/settings';
  import { themeMode, setTheme, type ThemeMode } from '$lib/theme';
  import { getStorageEstimate, type StorageEstimate } from '$lib/storage';
  import { changelog } from '$lib/changelog';
  import { activate, deactivate } from '$lib/license';
  import { getShortcuts, formatShortcut } from '$lib/shortcuts';
  import DangerZone from '$lib/components/DangerZone.svelte';
  import PinModal from '$lib/components/PinModal.svelte';
  import ImportModal from '$lib/components/ImportModal.svelte';
  import { exportData } from '$lib/export';
  import { installPrompt, nativeInstallReady, initInstallPrompt, promptInstall } from '$lib/stores/installPrompt';
  import { onMount } from 'svelte';

  let storageInfo = $state<StorageEstimate | null>(null);
  let licenseKey = $state('');
  let licenseError = $state('');
  let licenseSuccess = $state(false);
  let showDangerZone = $state(false);
  let showPinModal = $state(false);
  let showImportModal = $state(false);
  let importFile = $state<File | null>(null);
  let fileInput: HTMLInputElement;
  let isExporting = $state(false);
  let isInstalling = $state(false);
  let installMessage = $state('');

  onMount(async () => {
    initInstallPrompt({ countVisit: false });
    storageInfo = await getStorageEstimate();
  });

  async function handleThemeChange(mode: ThemeMode) {
    setTheme(mode);
  }

  async function handleAutoLock(minutes: number) {
    await setAutoLockMinutes(minutes);
  }

  async function handleActivate() {
    licenseError = '';
    licenseSuccess = false;
    const result = await activate(licenseKey);
    if (result.success) {
      licenseSuccess = true;
      licenseKey = '';
    } else {
      licenseError = result.error ?? t('common.error');
    }
  }

  async function handleDeactivate() {
    await deactivate();
    licenseSuccess = false;
  }

  async function handleExport() {
    isExporting = true;
    try {
      await exportData('all');
    } finally {
      isExporting = false;
    }
  }

  async function handleInstallApp() {
    isInstalling = true;
    installMessage = '';

    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        installMessage = 'Install started. Motif should appear in your app launcher shortly.';
      } else if (outcome === 'dismissed') {
        installMessage = 'Install dismissed. You can try again later from the browser menu.';
      } else {
        installMessage = getManualInstallHint();
      }
    } finally {
      isInstalling = false;
    }
  }

  function getManualInstallHint(): string {
    if ($installPrompt.platform === 'ios') {
      return 'Open Safari Share, then choose Add to Home Screen.';
    }

    if ($installPrompt.platform === 'android' || $installPrompt.platform === 'huawei') {
      return 'Open the browser menu, then choose Install app or Add to home screen.';
    }

    if ($installPrompt.platform === 'desktop') {
      return 'Use the install icon in the address bar, or the browser menu install option.';
    }

    return 'Use your browser menu to add Motif to this device.';
  }

  let installDescription = $derived.by(() => {
    if ($installPrompt.isInstalled || $installPrompt.isStandalone) {
      return 'Motif is installed on this device.';
    }

    if ($nativeInstallReady) {
      return 'Install Motif for faster access and offline launch.';
    }

    return getManualInstallHint();
  });

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      importFile = target.files[0];
      showImportModal = true;
      target.value = ''; // Reset input so same file can be selected again
    }
  }

  const shortcuts = getShortcuts();
  const CHANGELOG_PREVIEW_ITEMS = 3;
  const changelogPreview = changelog.slice(0, 2);
  const autoLockOptions = [
    { value: 0, label: t('settings.autoLockNever') },
    { value: 1, label: t('settings.autoLock1') },
    { value: 5, label: t('settings.autoLock5') },
    { value: 15, label: t('settings.autoLock15') },
    { value: 60, label: t('settings.autoLock60') }
  ];
</script>

<svelte:head><title>Settings - Motif</title></svelte:head>

<div class="page fade-in">
  <h1 class="page-title">{t('settings.title')}</h1>

  <!-- Account / License -->
  <section class="section">
    <h2 class="section-title">{t('settings.account')}</h2>
    <div class="section-card">
      {#if $settings.proActive}
        <div class="pro-badge">{t('pro.settings.status.pro')}</div>
        <p class="section-desc">Licensed to this device.</p>
        <button class="btn-outline danger-outline" onclick={handleDeactivate}>{t('pro.settings.deactivate.cta')}</button>
      {:else}
        <div class="pro-badge free-badge">{t('pro.settings.status.free')}</div>
        <p class="section-desc">
          <a href={CHECKOUT_URLS.pro} target="_blank" rel="noopener" class="btn btn-primary account-buy-btn">
            Get Lifetime Pro — $29
          </a>
        </p>
        <p class="launch-offer">
          Launch offer: Use code <strong>ILOVEMOTIF</strong> at checkout<br />
          to get $10 off. First 100 users only.
        </p>
        <p class="setting-hint seats-hint">
          Need more seats?
          <a href={CHECKOUT_URLS.family} target="_blank" rel="noopener" class="link-muted">Family (5 seats)</a>
          ·
          <a href={CHECKOUT_URLS.team} target="_blank" rel="noopener" class="link-muted">Team (10 seats)</a>
        </p>
        <p class="setting-hint" style="margin-bottom: 8px;">Already purchased? Enter license key</p>
        <div class="license-form">
          <input type="text" class="input" placeholder={t('pro.settings.activate.label')} bind:value={licenseKey} />
          <button class="btn-primary" onclick={handleActivate}>{t('pro.settings.activate.cta')}</button>
        </div>
        {#if licenseError}<p class="error-text">{licenseError}</p>{/if}
        {#if licenseSuccess}<p class="success-text">{t('pro.settings.activate.success')}</p>{/if}
      {/if}
    </div>
  </section>

  <!-- Install App -->
  <section class="section">
    <h2 class="section-title">Install App</h2>
    <div class="section-card">
      <div class="setting-row install-row">
        <div class="setting-info">
          <span class="setting-label">Install Motif on this device</span>
          <p class="setting-hint">{installDescription}</p>
        </div>

        {#if $installPrompt.isInstalled || $installPrompt.isStandalone}
          <span class="status-badge installed-badge">Installed</span>
        {:else if $nativeInstallReady}
          <button class="btn-primary" onclick={handleInstallApp} disabled={isInstalling}>
            {isInstalling ? 'Opening...' : 'Install Motif'}
          </button>
        {:else}
          <span class="status-badge manual-badge">Manual install</span>
        {/if}
      </div>

      {#if installMessage}
        <p class="install-message">{installMessage}</p>
      {/if}
    </div>
  </section>

  <!-- Appearance -->
  <section class="section">
    <h2 class="section-title">{t('settings.appearance')}</h2>
    <div class="section-card">
      <span class="setting-label">{t('settings.theme')}</span>
      <div class="theme-switcher">
        {#each (['light', 'dark', 'system'] as ThemeMode[]) as mode}
          <button class="theme-btn" class:active={$themeMode === mode} onclick={() => handleThemeChange(mode)}>
            {mode === 'light' ? '☀' : mode === 'dark' ? '◐' : '🖥'}
            {t(`settings.theme${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
          </button>
        {/each}
      </div>
    </div>
  </section>

  <!-- Security -->
  <section class="section">
    <h2 class="section-title">{t('settings.security')}</h2>
    <div class="section-card">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{t('settings.pinLock')}</span>
          <p class="setting-hint">{$settings.pinHash ? 'Active' : 'Not set'}</p>
        </div>
        <button class="btn-outline" onclick={() => showPinModal = true}>
          {$settings.pinHash ? t('settings.pinChange') : t('settings.pinSet')}
        </button>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <label class="setting-label" for="auto-lock-select">{t('settings.autoLock')}</label>
          <p class="setting-hint">{t('settings.autoLockHint') || 'Hides app after inactivity'}</p>
        </div>
        <select id="auto-lock-select" class="select" value={$settings.autoLockMinutes} onchange={(e) => handleAutoLock(Number((e.target as HTMLSelectElement).value))}>
          {#each autoLockOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </section>

  <!-- Storage -->
  <section class="section">
    <h2 class="section-title">{t('settings.storage')}</h2>
    <div class="section-card">
      {#if storageInfo}
        <div class="storage-bar-container">
          <div class="storage-bar">
            <div class="storage-fill" style="width:{Math.min(storageInfo.percentUsed, 100)}%"></div>
          </div>
          <div class="storage-labels">
            <span>{t('settings.storageUsed')}: {storageInfo.usedFormatted}</span>
            <span>{t('settings.storageAvailable')}: {storageInfo.quotaFormatted}</span>
          </div>
        </div>
      {:else}
        <p class="skeleton" style="height:40px; width:100%;">&nbsp;</p>
      {/if}
    </div>
  </section>

  <!-- Keyboard Shortcuts -->
  {#if shortcuts.length > 0}
    <section class="section">
      <h2 class="section-title">{t('settings.keyboardShortcuts')}</h2>
      <div class="section-card">
        {#each shortcuts as s}
          <div class="shortcut-row">
            <span class="shortcut-desc">{s.description}</span>
            <kbd class="shortcut-key">{formatShortcut(s)}</kbd>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Data -->
  <section class="section">
    <h2 class="section-title">{t('settings.data')}</h2>
    <div class="section-card">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{t('settings.exportData') || 'Export Backup'}</span>
          <p class="setting-hint">Download a ZIP backup of all your captures</p>
        </div>
        <button class="btn-primary" onclick={handleExport} disabled={isExporting}>
          {isExporting ? 'Preparing...' : 'Export All'}
        </button>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{t('settings.importData') || 'Import Backup'}</span>
          <p class="setting-hint">Restore data from a Motif ZIP file</p>
        </div>
        <input type="file" accept=".zip" bind:this={fileInput} onchange={handleFileSelect} hidden />
        <button class="btn-outline" onclick={() => fileInput.click()}>
          Import ZIP
        </button>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{t('settings.dangerZone') || 'Danger Zone'}</span>
          <p class="setting-hint">Careful - these actions are permanent</p>
        </div>
        <button class="btn-outline danger-outline" onclick={() => showDangerZone = true}>
          {t('settings.clearData')}
        </button>
      </div>
    </div>
  </section>

  <!-- Changelog -->
  <section class="section">
    <h2 class="section-title">{t('settings.changelog')}</h2>
    <div class="section-card">
      {#each changelogPreview as entry}
        <div class="changelog-entry">
          <div class="changelog-header">
            <span class="changelog-version">v{entry.version}</span>
            <span class="changelog-date">{entry.date}</span>
          </div>
          <ul class="changelog-list">
            {#each entry.items.slice(0, CHANGELOG_PREVIEW_ITEMS) as item}
              <li>{item}</li>
            {/each}
            {#if entry.items.length > CHANGELOG_PREVIEW_ITEMS}
              <li class="changelog-more">+{entry.items.length - CHANGELOG_PREVIEW_ITEMS} more in full changelog</li>
            {/if}
          </ul>
        </div>
      {/each}
      <a class="changelog-link" href="https://byant.dev/motif/changelog" target="_blank" rel="noopener">
        Read full changelog
      </a>
    </div>
  </section>

  <!-- Privacy -->
  <section class="section">
    <h2 class="section-title">{t('settings.privacy')}</h2>
    <div class="section-card">
      <p class="privacy-statement">{t('settings.privacyStatement')}</p>
      <div class="privacy-links">
        <a href="https://byant.dev/motif/privacy" target="_blank" rel="noopener">{t('settings.privacyLink')}</a>
        <span class="separator">|</span>
        <a href="https://byant.dev/motif/terms" target="_blank" rel="noopener">{t('settings.termsLink')}</a>
      </div>
      <p class="version-info">{t('settings.version')}: 1.1.0</p>
    </div>
  </section>
</div>

<DangerZone bind:open={showDangerZone} />
<PinModal bind:open={showPinModal} />
<ImportModal bind:open={showImportModal} bind:file={importFile} />

<style>
  .page-title { font-size:28px; font-weight:700; color:var(--color-text); margin:0 0 28px; }
  .section { margin-bottom:28px; }
  .section-title { font-size:16px; font-weight:600; color:var(--color-text); margin:0 0 10px; }
  .section-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:20px; }
  .section-desc { font-size:14px; color:var(--color-text-secondary); margin:0 0 12px; }

  .setting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .setting-info { flex: 1; }
  .setting-label { font-size:13px; font-weight:500; color:var(--color-text-secondary); display:block; margin-bottom:2px; }
  .setting-hint { font-size: 12px; color: var(--color-text-secondary); margin: 0; opacity: 0.7; }
  .setting-divider { height: 1px; background: var(--color-border); margin: 16px 0; }
  .status-badge { display:inline-flex; align-items:center; justify-content:center; padding:6px 12px; border-radius:var(--radius-full); font-size:12px; font-weight:700; white-space:nowrap; }
  .installed-badge { color:var(--color-accent); background:color-mix(in srgb, var(--color-accent) 14%, transparent); }
  .manual-badge { color:var(--color-text-secondary); background:color-mix(in srgb, var(--color-text-secondary) 12%, transparent); border:1px solid color-mix(in srgb, var(--color-text-secondary) 18%, transparent); }
  .install-message { margin:12px 0 0; font-size:12px; color:var(--color-text-secondary); }
  @media (max-width: 640px) {
    .install-row { align-items:flex-start; flex-direction:column; }
    .install-row .btn-primary { width:100%; }
  }

  .pro-badge { display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:var(--color-primary-subtle); color:var(--color-primary); border-radius:var(--radius-md); font-size:14px; font-weight:600; margin-bottom:12px; }
  .free-badge { background:var(--color-surface); color:var(--color-text-secondary); border: 1px solid var(--color-border); }
  .account-buy-btn { text-decoration:none; }
  .launch-offer { font-size:13px; color:var(--color-text-secondary); line-height:1.5; margin:0 0 12px; }
  .seats-hint { margin-bottom:8px; }

  .license-form { display:flex; gap:8px; }
  @media (max-width: 480px) {
    .license-form { flex-direction: column; align-items: stretch; }
    .license-form .btn-primary { width: 100%; }
  }
  .input { flex:1; padding:10px 14px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); color:var(--color-text); font-size:14px; font-family:var(--font-sans); outline:none; }
  .input:focus { border-color:var(--color-primary); }

  .btn-primary { padding:10px 20px; background:var(--color-primary); color:white; border:none; border-radius:var(--radius-md); font-size:14px; font-weight:500; cursor:pointer; font-family:var(--font-sans); white-space:nowrap; }
  .btn-outline { padding:8px 16px; background:none; border:1px solid var(--color-border); border-radius:var(--radius-md); color:var(--color-text); font-size:13px; cursor:pointer; font-family:var(--font-sans); }
  .danger-outline { border-color:var(--color-danger); color:var(--color-danger); }

  .error-text { font-size:13px; color:var(--color-danger); margin:8px 0 0; }
  .success-text { font-size:13px; color:var(--color-accent); margin:8px 0 0; }

  .theme-switcher { display:flex; gap:8px; flex-wrap: wrap; }
  .theme-btn { padding:8px 16px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:var(--radius-md); font-size:13px; cursor:pointer; color:var(--color-text-secondary); transition:all var(--duration-fast); font-family:var(--font-sans); display:flex; align-items:center; gap:6px; flex: 1; min-width: fit-content; justify-content: center; }
  .theme-btn:hover { border-color:var(--color-primary); }
  .theme-btn.active { background:var(--color-primary-subtle); border-color:var(--color-primary); color:var(--color-primary); font-weight:500; }

  .select { padding:8px 12px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-bg); color:var(--color-text); font-size:13px; cursor:pointer; font-family:var(--font-sans); }

  .storage-bar-container { display:flex; flex-direction:column; gap:8px; }
  .storage-bar { height:8px; background:var(--color-border); border-radius:var(--radius-full); overflow:hidden; }
  .storage-fill { height:100%; background:var(--color-primary); border-radius:var(--radius-full); transition:width var(--duration-normal); }
  .storage-labels { display:flex; justify-content:space-between; font-size:12px; color:var(--color-text-secondary); }

  .shortcut-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--color-border); }
  .shortcut-row:last-child { border-bottom:none; }
  .shortcut-desc { font-size:13px; color:var(--color-text); }
  .shortcut-key { padding:3px 8px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:var(--radius-sm); font-size:12px; font-family:var(--font-sans); color:var(--color-text-secondary); }

  .changelog-entry { margin-bottom:16px; }
  .changelog-entry:last-child { margin-bottom:0; }
  .changelog-header { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .changelog-version { font-weight:600; color:var(--color-primary); font-size:14px; }
  .changelog-date { font-size:12px; color:var(--color-text-secondary); }
  .changelog-list { margin:0; padding-left:20px; }
  .changelog-list li { font-size:13px; color:var(--color-text-secondary); line-height:1.8; }
  .changelog-more { font-weight:600; color:var(--color-primary); }
  .changelog-link { display:inline-block; margin-top:8px; font-size:13px; color:var(--color-primary); text-decoration:none; }
  .changelog-link:hover { text-decoration:underline; }

  .privacy-statement { font-size:14px; color:var(--color-text); margin:0 0 12px; }
  .privacy-links { display:flex; align-items:center; gap:8px; }
  .privacy-links a { font-size:13px; color:var(--color-primary); text-decoration:none; }
  .privacy-links a:hover { text-decoration:underline; }
  .separator { color:var(--color-text-secondary); }
  .version-info { font-size:12px; color:var(--color-text-secondary); margin:12px 0 0; }

  .link-muted {
    color: var(--color-text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color var(--duration-fast);
  }

  .link-muted:hover {
    color: var(--color-primary);
  }
</style>
