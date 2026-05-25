<script lang="ts">
  import { t } from '$lib/i18n';
  import { CHECKOUT_URLS, getCheckoutUrl } from '$lib/constants';
  import { settings, setAutoLockMinutes, setAutoOcr, setAutoFetchMetadata, setAutoArchiveArticles, setArchiveSizeLimit } from '$lib/stores/settings';
  import { db } from '$lib/db';
  import { runOcrOnCapture } from '$lib/stores/captures';
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
  import { requestProFeature } from '$lib/pro';
  import {
    sessionKey,
    rewriteTotal,
    rewriteDone,
    isRewriting,
    generateRecoveryPhrase,
    deriveKey,
    encryptText,
    decryptText,
    encryptCapture,
    createVerification,
    checkVerification
  } from '$lib/encryption';
  import { loadCaptures, captures, getArticleCacheSize, clearArticleCache } from '$lib/stores/captures';
  import {
    modelLoadingState,
    downloadProgress,
    isBackfilling,
    backfillProgress,
    initWorker,
    startBackfillQueue,
    cancelBackfill
  } from '$lib/stores/semanticSearch';
  import { setDbEncrypted, setAutoAiSearch } from '$lib/stores/settings';
  import { showToast } from '$lib/stores/toast';
  import { get } from 'svelte/store';

  let storageInfo = $state<StorageEstimate | null>(null);
  let articleCacheSize = $state(0);

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.log(bytes) <= 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function handleClearArticleCache() {
    const confirmClear = confirm("Are you sure you want to clear your offline article cache? Your saved links will be preserved, but their cached offline content will be removed. They will be re-downloaded when opened.");
    if (!confirmClear) return;

    try {
      await clearArticleCache();
      articleCacheSize = await getArticleCacheSize();
      storageInfo = await getStorageEstimate();
      showToast('✓ Offline article cache cleared');
    } catch (err) {
      console.error('Failed to clear article cache:', err);
      showToast('Failed to clear article cache');
    }
  }
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

  let skippedImagesCount = $state(0);
  let isScanningSkipped = $state(false);
  let scannedProgress = $state(0);

  // AI Search states & handlers
  async function handleAiSearchToggle(enabled: boolean) {
    if (enabled) {
      const allowed = await requestProFeature('aiSearch', 'AI Semantic Search');
      if (!allowed) {
        settings.update(s => ({ ...s }));
        return;
      }
      if (get(modelLoadingState) !== 'ready') {
        initWorker();
      }
      await setAutoAiSearch(true);
    } else {
      await setAutoAiSearch(false);
      if (get(isBackfilling)) {
        cancelBackfill();
      }
    }
  }

  async function handleReindex() {
    await startBackfillQueue(true);
  }

  // Encryption states & handlers
  let showEncryptSetupModal = $state(false);
  let showDecryptConfirmModal = $state(false);
  let showRecoveryPhraseModal = $state(false);

  let encryptPassword = $state('');
  let encryptConfirmPassword = $state('');
  let decryptPassword = $state('');
  let generatedPhrase = $state('');
  let phraseCopied = $state(false);
  let encryptionError = $state('');
  let decryptionError = $state('');

  function handleEncryptionToggleClick() {
    if ($settings.dbEncrypted) {
      showDecryptConfirmModal = true;
      decryptPassword = '';
      decryptionError = '';
    } else {
      showEncryptSetupModal = true;
      encryptPassword = '';
      encryptConfirmPassword = '';
      encryptionError = '';
    }
  }

  async function handleEnableEncryption() {
    encryptionError = '';
    const pwd = encryptPassword.trim();
    if (pwd.length < 8) {
      encryptionError = 'Password must be at least 8 characters long.';
      return;
    }
    if (pwd !== encryptConfirmPassword.trim()) {
      encryptionError = 'Passwords do not match.';
      return;
    }

    try {
      // 1. Generate phrase
      generatedPhrase = generateRecoveryPhrase();

      // 2. Generate master key
      const masterKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const rawMasterKey = await crypto.subtle.exportKey('raw', masterKey);
      const rawMasterKeyHex = Array.from(new Uint8Array(rawMasterKey))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // 3. Derive password key and encrypt master key
      const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
      const passwordSaltHex = Array.from(passwordSalt)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const passwordDerivationKey = await deriveKey(pwd, passwordSalt);
      const encryptedMasterKeyByPassword = await encryptText(rawMasterKeyHex, passwordDerivationKey);

      // 4. Derive recovery phrase key and encrypt master key
      const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
      const recoverySaltHex = Array.from(recoverySalt)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const recoveryDerivationKey = await deriveKey(generatedPhrase, recoverySalt);
      const encryptedMasterKeyByRecovery = await encryptText(rawMasterKeyHex, recoveryDerivationKey);

      // 5. Create verification
      const verification = await createVerification(masterKey);

      // 6. Rewrite database
      isRewriting.set(true);
      const capturesList = await db.captures.toArray();
      rewriteTotal.set(capturesList.length);
      rewriteDone.set(0);

      for (const capture of capturesList) {
        const encrypted = await encryptCapture(capture, masterKey);
        await db.captures.put(encrypted);
        rewriteDone.update(n => n + 1);
      }

      // 7. Save settings to DB
      await db.settings.put({ key: 'dbEncryptionSalt', value: passwordSaltHex });
      await db.settings.put({ key: 'dbRecoverySalt', value: recoverySaltHex });
      await db.settings.put({ key: 'encryptedMasterKeyByPassword', value: encryptedMasterKeyByPassword });
      await db.settings.put({ key: 'encryptedMasterKeyByRecovery', value: encryptedMasterKeyByRecovery });
      await db.settings.put({ key: 'encryptionVerification', value: verification });

      // 8. Update stores
      await setDbEncrypted(true);
      sessionKey.set(masterKey);
      await loadCaptures();

      // 9. Transition modals
      showEncryptSetupModal = false;
      showRecoveryPhraseModal = true;
      showToast('✓ Local encryption successfully enabled');
    } catch (err) {
      console.error('Failed to enable encryption:', err);
      encryptionError = 'An error occurred during database encryption.';
    } finally {
      isRewriting.set(false);
    }
  }

  async function handleDisableEncryption() {
    decryptionError = '';
    const pwd = decryptPassword.trim();
    if (!pwd) {
      decryptionError = 'Password is required.';
      return;
    }

    try {
      const saltRecord = await db.settings.get('dbEncryptionSalt');
      const verificationRecord = await db.settings.get('encryptionVerification');
      const encryptedMasterKeyByPassword = await db.settings.get('encryptedMasterKeyByPassword');

      if (!saltRecord || !verificationRecord || !encryptedMasterKeyByPassword) {
        decryptionError = 'Encryption metadata missing.';
        return;
      }

      const salt = new Uint8Array(saltRecord.value.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const derivationKey = await deriveKey(pwd, salt);
      const masterKeyHex = await decryptText(encryptedMasterKeyByPassword.value, derivationKey);

      // Verify masterKey
      const rawKeyBytes = new Uint8Array(masterKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const masterKey = await crypto.subtle.importKey(
        'raw',
        rawKeyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const isValid = await checkVerification(verificationRecord.value, masterKey);
      if (!isValid) {
        decryptionError = 'Incorrect password.';
        return;
      }

      // Rewrite database back to plaintext
      isRewriting.set(true);
      const plainCaptures = get(captures);
      rewriteTotal.set(plainCaptures.length);
      rewriteDone.set(0);

      for (const capture of plainCaptures) {
        await db.captures.put(capture);
        rewriteDone.update(n => n + 1);
      }

      // Clean up metadata
      await db.settings.delete('dbEncryptionSalt');
      await db.settings.delete('dbRecoverySalt');
      await db.settings.delete('encryptedMasterKeyByPassword');
      await db.settings.delete('encryptedMasterKeyByRecovery');
      await db.settings.delete('encryptionVerification');

      await setDbEncrypted(false);
      sessionKey.set(null);
      await loadCaptures();

      showDecryptConfirmModal = false;
      decryptPassword = '';
      showToast('✓ Local encryption successfully disabled');
    } catch (err) {
      console.error('Failed to disable encryption:', err);
      decryptionError = 'Incorrect password or decryption failure.';
    } finally {
      isRewriting.set(false);
    }
  }

  async function copyPhrase() {
    try {
      await navigator.clipboard.writeText(generatedPhrase);
      phraseCopied = true;
      setTimeout(() => { phraseCopied = false; }, 2000);
    } catch (err) {
      console.error('Failed to copy phrase:', err);
    }
  }

  async function countSkippedImages() {
    try {
      skippedImagesCount = await db.captures
        .filter(c => c.type === 'image' && (c.ocrStatus === 'skipped' || !c.ocrStatus))
        .count();
    } catch (err) {
      console.error('Failed to count skipped images:', err);
    }
  }

  async function handleAutoOcrToggle(enabled: boolean) {
    if (enabled) {
      const allowed = await requestProFeature('ocr', 'Local OCR');
      if (!allowed) {
        settings.update(s => ({ ...s }));
        return;
      }
    }
    await setAutoOcr(enabled);
  }

  async function handleAutoFetchMetadataToggle(enabled: boolean) {
    await setAutoFetchMetadata(enabled);
  }

  async function handleScanAllSkipped() {
    const allowed = await requestProFeature('ocr', 'Local OCR');
    if (!allowed) return;

    isScanningSkipped = true;
    scannedProgress = 0;
    try {
      const skipped = await db.captures
        .filter(c => c.type === 'image' && (c.ocrStatus === 'skipped' || !c.ocrStatus))
        .toArray();
      
      for (const capture of skipped) {
        await runOcrOnCapture(capture.id, capture.content, true);
        scannedProgress++;
      }
      await countSkippedImages();
    } catch (err) {
      console.error('Failed scanning skipped images:', err);
    } finally {
      isScanningSkipped = false;
    }
  }

  onMount(async () => {
    initInstallPrompt({ countVisit: false });
    storageInfo = await getStorageEstimate();
    await countSkippedImages();
    articleCacheSize = await getArticleCacheSize();
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

  function openCheckout(url: string, e: MouseEvent) {
    e.preventDefault();
    const targetUrl = getCheckoutUrl(url);

    if ((window as any).LemonSqueezy) {
      try {
        (window as any).LemonSqueezy.Url.Open(targetUrl);
        return;
      } catch (err) {
        console.error('Failed to open LemonSqueezy overlay:', err);
      }
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleExport() {
    const allowed = await requestProFeature('export', 'Export Backup');
    if (!allowed) return;

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

  async function openImportPicker() {
    const allowed = await requestProFeature('import', 'Import Backup');
    if (!allowed) return;
    fileInput.click();
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
          <a
            href={CHECKOUT_URLS.pro}
            target="_blank"
            rel="noopener"
            class="btn btn-primary account-buy-btn"
            onclick={(e) => openCheckout(CHECKOUT_URLS.pro, e)}
          >
            Get Lifetime Pro — $29
          </a>
        </p>
        <p class="launch-offer">
          Launch offer: Use code <strong>ILOVEMOTIF</strong> at checkout<br />
          to get $10 off. First 100 users only.
        </p>
        <p class="setting-hint seats-hint">
          Need more seats?
          <a
            href={CHECKOUT_URLS.family}
            target="_blank"
            rel="noopener"
            class="link-muted"
            onclick={(e) => openCheckout(CHECKOUT_URLS.family, e)}
          >Family (5 seats)</a>
          ·
          <a
            href={CHECKOUT_URLS.team}
            target="_blank"
            rel="noopener"
            class="link-muted"
            onclick={(e) => openCheckout(CHECKOUT_URLS.team, e)}
          >Team (10 seats)</a>
        </p>
        <p class="setting-hint" style="margin-bottom: 8px;">Already purchased? Enter license key</p>
        <div class="license-form">
          <input type="text" class="input" placeholder={t('pro.settings.activate.label')} bind:value={licenseKey} />
          <button class="btn-primary" onclick={handleActivate}>{t('pro.settings.activate.cta')}</button>
        </div>
        {#if licenseError}
          <div class="error-container" style="margin-top: 8px;">
            <p class="error-text" style="margin: 0; color: #ef4444; font-size: 0.875rem;">{licenseError}</p>
            {#if licenseError.toLowerCase().includes('limit') || licenseError.toLowerCase().includes('activation') || licenseError.toLowerCase().includes('slot') || licenseError.toLowerCase().includes('full')}
              <div class="activation-lost-record" style="margin-top: 12px; padding: 12px; border-radius: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15);">
                <p class="setting-hint" style="margin: 0; font-size: 0.875rem; line-height: 1.4; color: var(--color-muted);">
                  Can't find your activation record?<br />
                  To free up a device slot, visit your LemonSqueezy receipt email and deactivate from there.
                </p>
                <a
                  href="https://app.lemonsqueezy.com/my-orders"
                  target="_blank"
                  rel="noopener"
                  class="portal-link"
                  style="display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; color: var(--color-primary); font-size: 0.875rem; font-weight: 500; text-decoration: none;"
                >
                  Open LemonSqueezy Portal →
                </a>
              </div>
            {/if}
          </div>
        {/if}
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

  <!-- Local Database Encryption -->
  <section class="section">
    <h2 class="section-title">{t('settings.encryptionTitle') || 'AES-256 Database Encryption'}</h2>
    <div class="section-card">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Local Database Encryption</span>
          <p class="setting-hint">
            {#if $settings.dbEncrypted}
              Enabled. All text fields (titles, notes, quotes, tags) are encrypted with zero-knowledge AES-256-GCM.
            {:else}
              Disabled. Text fields are stored in plaintext in local IndexedDB.
            {/if}
          </p>
        </div>
        <button
          class="btn-outline"
          class:danger-outline={$settings.dbEncrypted}
          onclick={handleEncryptionToggleClick}
          disabled={$isRewriting}
        >
          {$settings.dbEncrypted ? t('settings.encryptionDisable') || 'Disable Encryption' : t('settings.encryptionEnable') || 'Enable Encryption'}
        </button>
      </div>
    </div>
  </section>

  <!-- Privacy Controls -->
  <section class="section">
    <h2 class="section-title">Privacy Controls</h2>
    <div class="section-card">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Auto-extract text from images (OCR)</span>
          <p class="setting-hint">Runs locally on your device. Never uploaded anywhere.</p>
        </div>
        <label class="switch">
          <input type="checkbox" checked={$settings.autoOcr} onchange={(e) => handleAutoOcrToggle((e.target as HTMLInputElement).checked)} />
          <span class="slider"></span>
        </label>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Auto-fetch link preview</span>
          <p class="setting-hint">Enriches saved links with page titles, descriptions, and thumbnails via jsonlink.io. Disable for absolute privacy.</p>
        </div>
        <label class="switch">
          <input type="checkbox" checked={$settings.autoFetchMetadata} onchange={(e) => handleAutoFetchMetadataToggle((e.target as HTMLInputElement).checked)} />
          <span class="slider"></span>
        </label>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Auto-archive articles for offline reading</span>
          <p class="setting-hint">Downloads and caches a clean, readable copy of articles locally when saved.</p>
        </div>
        <label class="switch">
          <input type="checkbox" checked={$settings.autoArchiveArticles} onchange={async (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            if (enabled) {
              const allowed = await requestProFeature('readingView', 'Reading View');
              if (!allowed) {
                (e.target as HTMLInputElement).checked = false;
                return;
              }
            }
            await setAutoArchiveArticles(enabled);
          }} />
          <span class="slider"></span>
        </label>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Article cache size limit</span>
          <p class="setting-hint">Caps the total local storage occupied by cached offline articles.</p>
        </div>
        <select class="select" value={$settings.archiveSizeLimit} onchange={async (e) => {
          const limit = (e.target as HTMLSelectElement).value as any;
          await setArchiveSizeLimit(limit);
        }}>
          <option value="unlimited">Unlimited</option>
          <option value="50mb">50 MB</option>
          <option value="100mb">100 MB</option>
          <option value="250mb">250 MB</option>
        </select>
      </div>

      {#if skippedImagesCount > 0}
        <div class="setting-divider"></div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Pending OCR Scans</span>
            <p class="setting-hint">
              {#if isScanningSkipped}
                Scanning: {scannedProgress} / {skippedImagesCount} completed...
              {:else}
                There are {skippedImagesCount} image captures without extracted text.
              {/if}
            </p>
          </div>
          <button class="btn-primary" onclick={handleScanAllSkipped} disabled={isScanningSkipped}>
            {isScanningSkipped ? 'Scanning...' : 'Scan all now'}
          </button>
        </div>
      {/if}
    </div>
  </section>

  <!-- AI Semantic Search -->
  <section class="section">
    <h2 class="section-title">{t('settings.aiSearchTitle') || 'AI Semantic Search'}</h2>
    <div class="section-card">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{t('settings.aiSearchEnable') || 'Enable AI Search'}</span>
          <p class="setting-hint">
            {#if $modelLoadingState === 'loading'}
              Downloading AI model... {$downloadProgress}%
            {:else if $modelLoadingState === 'ready'}
              Offline AI model loaded and ready.
            {:else if $modelLoadingState === 'error'}
              Failed to load AI model.
            {:else}
              Enables offline semantic search based on meaning and context.
            {/if}
          </p>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            checked={$settings.autoAiSearch}
            disabled={$modelLoadingState === 'loading'}
            onchange={(e) => handleAiSearchToggle((e.target as HTMLInputElement).checked)}
          />
          <span class="slider"></span>
        </label>
      </div>

      {#if $isBackfilling}
        <div class="setting-divider"></div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">AI Indexing Progress</span>
            <p class="setting-hint">
              Indexing captures: {$backfillProgress.done} / {$backfillProgress.total} ({$backfillProgress.percent}%)
            </p>
            <div class="progress-bar-container" style="margin-top: 8px;">
              <div class="progress-bar">
                <div class="progress-fill" style="width: {$backfillProgress.percent}%"></div>
              </div>
            </div>
          </div>
          <button class="btn-outline danger-outline" onclick={cancelBackfill}>
            Cancel
          </button>
        </div>
      {/if}

      {#if $settings.autoAiSearch && $modelLoadingState === 'ready'}
        <div class="setting-divider"></div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">{t('settings.aiSearchReindex') || 'Re-index all captures'}</span>
            <p class="setting-hint">{t('settings.aiSearchReindexDesc') || 'Regenerates AI search index for all captures.'}</p>
          </div>
          <button class="btn-outline" onclick={handleReindex} disabled={$isBackfilling}>
            {$isBackfilling ? 'Indexing...' : 'Re-index All'}
          </button>
        </div>
      {/if}
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

      <div class="setting-divider"></div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Offline article cache size</span>
          <p class="setting-hint">Currently occupying {formatBytes(articleCacheSize)} of IndexedDB storage.</p>
        </div>
        <button class="btn-outline danger-outline" onclick={handleClearArticleCache} disabled={articleCacheSize === 0}>
          Clear article cache
        </button>
      </div>
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
          <span class="setting-label">Import Backup or Pocket Export</span>
          <p class="setting-hint">Restore data from a Motif ZIP backup or import a Pocket HTML file</p>
        </div>
        <input type="file" accept=".zip,.html,.htm" bind:this={fileInput} onchange={handleFileSelect} hidden />
        <button class="btn-outline" onclick={openImportPicker}>
          Choose File
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

<!-- Encryption Setup Modal -->
{#if showEncryptSetupModal}
  <div class="modal-backdrop">
    <div class="modal-container glassmorphic">
      <h3 class="modal-title">{t('settings.encryptionTitle') || 'Enable Database Encryption'}</h3>
      <p class="modal-desc">
        Create a password to encrypt your database locally. This password is zero-knowledge: it is never uploaded and cannot be reset.
      </p>

      <div class="modal-form">
        <div class="form-group">
          <label class="form-label">{t('settings.encryptionPassword')}</label>
          <input
            type="password"
            class="input"
            placeholder={t('settings.encryptionPasswordPlaceholder') || 'Enter at least 8 characters...'}
            bind:value={encryptPassword}
          />
        </div>
        <div class="form-group">
          <label class="form-label">Confirm Password</label>
          <input
            type="password"
            class="input"
            placeholder="Confirm your password..."
            bind:value={encryptConfirmPassword}
          />
        </div>

        {#if encryptionError}
          <p class="error-text">{encryptionError}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn-outline" onclick={() => showEncryptSetupModal = false}>Cancel</button>
          <button class="btn-primary" onclick={handleEnableEncryption}>Enable Encryption</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Decrypt Confirmation Modal -->
{#if showDecryptConfirmModal}
  <div class="modal-backdrop">
    <div class="modal-container glassmorphic">
      <h3 class="modal-title">{t('settings.encryptionWarningTitle') || 'Disable encryption?'}</h3>
      <p class="modal-desc">
        {t('settings.encryptionWarningDesc') || 'This will decrypt all your captures and may take a moment for large libraries.'}
      </p>

      <div class="modal-form">
        <div class="form-group">
          <label class="form-label">Enter Password to Confirm</label>
          <input
            type="password"
            class="input"
            placeholder="Enter your database password..."
            bind:value={decryptPassword}
          />
        </div>

        {#if decryptionError}
          <p class="error-text">{decryptionError}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn-outline" onclick={() => showDecryptConfirmModal = false}>Cancel</button>
          <button class="btn-primary danger-btn" onclick={handleDisableEncryption}>
            {t('settings.encryptionWarningConfirm') || 'Disable Encryption'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Recovery Phrase Modal -->
{#if showRecoveryPhraseModal}
  <div class="modal-backdrop">
    <div class="modal-container glassmorphic phrase-modal-container">
      <h3 class="modal-title">{t('settings.encryptionRecoveryTitle') || 'Secure Recovery Phrase'}</h3>
      <p class="modal-desc">
        {t('settings.encryptionRecoveryDesc') || 'Please write down these 12 words on a piece of paper and keep them completely safe. If you lose your password AND this recovery phrase, your data is lost forever.'}
      </p>

      <div class="recovery-phrase-box">
        {#each generatedPhrase.split(' ') as word, i}
          <div class="recovery-word">
            <span class="word-number">{i + 1}</span>
            <span class="word-text">{word}</span>
          </div>
        {/each}
      </div>

      <div class="modal-actions phrase-actions">
        <button class="btn-outline" onclick={copyPhrase}>
          {phraseCopied ? (t('settings.encryptionRecoveryCopied') || 'Copied!') : (t('settings.encryptionRecoveryCopy') || 'Copy phrase')}
        </button>
        <button class="btn-primary" onclick={() => showRecoveryPhraseModal = false}>I've Written It Down</button>
      </div>
    </div>
  </div>
{/if}

<!-- Database Rewrite Progress Overlay -->
{#if $isRewriting}
  <div class="rewrite-overlay">
    <div class="rewrite-card glassmorphic">
      <div class="spinner"></div>
      <h3 class="rewrite-title">Rewriting Local Database...</h3>
      <p class="rewrite-desc">Encrypting or decrypting your captures on your device. Please do not close or reload the app.</p>
      <div class="progress-bar-container large-bar">
        <div class="progress-bar">
          <div class="progress-fill animate-pulse" style="width: {$rewriteTotal > 0 ? Math.round(($rewriteDone / $rewriteTotal) * 100) : 0}%"></div>
        </div>
      </div>
      <p class="rewrite-count">{$rewriteDone} / {$rewriteTotal} captures rewritten ({$rewriteTotal > 0 ? Math.round(($rewriteDone / $rewriteTotal) * 100) : 0}%)</p>
    </div>
  </div>
{/if}

<style>
  /* Modals */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn var(--duration-fast) ease-out;
  }
  .modal-container {
    width: 90%;
    max-width: 460px;
    padding: 24px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-xl);
    animation: scaleUp var(--duration-fast) ease-out;
  }
  .phrase-modal-container {
    max-width: 520px;
  }
  .glassmorphic {
    background: rgba(var(--color-surface-raw, 25, 25, 30), 0.85);
    backdrop-filter: blur(16px);
  }
  .modal-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 8px;
  }
  .modal-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0 0 20px;
  }
  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 12px;
  }
  .phrase-actions {
    justify-content: space-between;
    margin-top: 24px;
  }
  .danger-btn {
    background: var(--color-danger) !important;
  }
  .danger-btn:hover {
    background: color-mix(in srgb, var(--color-danger) 85%, black) !important;
  }

  /* Progress Bars */
  .progress-bar-container {
    width: 100%;
    margin: 4px 0;
  }
  .progress-bar {
    height: 6px;
    background: var(--color-border);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    transition: width var(--duration-normal) var(--ease-out);
  }
  .animate-pulse {
    animation: pulse 2s infinite ease-in-out;
  }

  /* Recovery Phrase Grid */
  .recovery-phrase-box {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 16px;
    margin: 16px 0;
  }
  @media (max-width: 480px) {
    .recovery-phrase-box {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .recovery-word {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: monospace;
    font-size: 14px;
    color: var(--color-text);
  }
  .word-number {
    color: var(--color-text-secondary);
    opacity: 0.5;
    font-size: 11px;
    width: 16px;
    text-align: right;
  }
  .word-text {
    font-weight: 600;
  }

  /* Rewrite Overlay */
  .rewrite-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }
  .rewrite-card {
    width: 90%;
    max-width: 440px;
    padding: 32px 24px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    text-align: center;
    box-shadow: var(--shadow-2xl);
  }
  .rewrite-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text);
    margin: 16px 0 8px;
  }
  .rewrite-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0 0 24px;
  }
  .large-bar .progress-bar {
    height: 10px;
  }
  .rewrite-count {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin: 12px 0 0;
    font-weight: 500;
  }
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    margin: 0 auto;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
  }
  @keyframes scaleUp {
    from { transform: scale(0.95); opacity: 0; }
  }

  .page-title { font-size:28px; font-weight:700; color:var(--color-text); margin:0 0 28px; }
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

  /* Switch / Toggle styles */
  .switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--color-border);
    transition: .3s;
    border-radius: 24px;
  }
  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
  }
  input:checked + .slider {
    background-color: var(--color-primary);
  }
  input:checked + .slider:before {
    transform: translateX(20px);
  }
</style>
