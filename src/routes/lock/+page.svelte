<script lang="ts">
  import { t } from '$lib/i18n';
  import { settings, hashPin, clearPin, setPin } from '$lib/stores/settings';
  import { resolvedTheme } from '$lib/theme';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { db } from '$lib/db';
  import {
    sessionKey,
    isLocked,
    deriveKey,
    checkVerification,
    decryptText
  } from '$lib/encryption';
  import { loadCaptures } from '$lib/stores/captures';

  // Mode: 'unlock' | 'set' | 'change' | 'confirm'
  let mode = $state<'unlock' | 'set' | 'change' | 'confirm'>('unlock');
  let pin = $state('');
  let pendingPin = $state(''); // for confirm step during set/change
  let error = $state('');
  let shake = $state(false);
  let isProcessing = $state(false);

  // DB Encryption States
  let dbPassword = $state('');
  let showPassword = $state(false);

  const MAX_DIGITS = 6;
  const MIN_DIGITS = 4;

  // Derive mode from URL param
  $effect(() => {
    const m = $page.url.searchParams.get('mode');
    if (m === 'set') mode = 'set';
    else if (m === 'change') mode = 'change';
    else mode = 'unlock';
  });

  function addDigit(d: string) {
    if (pin.length >= $settings.pinLength) return;
    pin += d;
    if (pin.length === $settings.pinLength) void handleSubmit();
  }

  function deleteDigit() {
    pin = pin.slice(0, -1);
    error = '';
  }

  async function handleSubmit() {
    if (pin.length < MIN_DIGITS) {
      triggerError('Enter at least 4 digits');
      return;
    }

    isProcessing = true;

    try {
      if (mode === 'unlock') {
        await verifyPin();
      } else if (mode === 'set' || mode === 'change') {
        // First entry — store as pending, move to confirm step
        pendingPin = pin;
        pin = '';
        mode = 'confirm';
      } else if (mode === 'confirm') {
        if (pin === pendingPin) {
          const hash = await hashPin(pin);
          await setPin(hash, pin.length);
          pin = '';
          pendingPin = '';
          const redirect = $page.url.searchParams.get('redirect') ?? '/';
          await goto(redirect);
        } else {
          triggerError(t('settings.pinMismatch'));
          pendingPin = '';
          mode = $page.url.searchParams.get('mode') === 'change' ? 'change' : 'set';
        }
      }
    } finally {
      isProcessing = false;
    }
  }

  async function verifyPin() {
    const hash = await hashPin(pin);
    if (hash === $settings.pinHash) {
      pin = '';
      error = '';
      const redirect = $page.url.searchParams.get('redirect') ?? '/';
      await goto(redirect);
    } else {
      triggerError(t('settings.pinWrong'));
    }
  }

  async function handleDbUnlock() {
    if (!dbPassword.trim()) {
      triggerError('Please enter your password or recovery phrase');
      return;
    }

    isProcessing = true;
    error = '';

    try {
      const saltRecord = await db.settings.get('dbEncryptionSalt');
      const recoverySaltRecord = await db.settings.get('dbRecoverySalt');
      const encryptedMasterKeyByPassword = await db.settings.get('encryptedMasterKeyByPassword');
      const encryptedMasterKeyByRecovery = await db.settings.get('encryptedMasterKeyByRecovery');
      const verificationRecord = await db.settings.get('encryptionVerification');

      if (!saltRecord || !verificationRecord || !encryptedMasterKeyByPassword) {
        triggerError('Database encryption metadata missing. Reset is required.');
        return;
      }

      const cleanInput = dbPassword.trim();
      const isRecovery = cleanInput.split(/\s+/).length === 12;

      let masterKeyHex = '';
      if (isRecovery) {
        if (!recoverySaltRecord || !encryptedMasterKeyByRecovery) {
          triggerError('Recovery phrase is not supported or missing metadata.');
          return;
        }
        const recoverySalt = new Uint8Array(recoverySaltRecord.value.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const derivationKey = await deriveKey(cleanInput.toLowerCase(), recoverySalt);
        masterKeyHex = await decryptText(encryptedMasterKeyByRecovery.value, derivationKey);
      } else {
        const salt = new Uint8Array(saltRecord.value.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const derivationKey = await deriveKey(cleanInput, salt);
        masterKeyHex = await decryptText(encryptedMasterKeyByPassword.value, derivationKey);
      }

      // Convert masterKeyHex to raw CryptoKey
      const rawKeyBytes = new Uint8Array(masterKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const masterKey = await crypto.subtle.importKey(
        'raw',
        rawKeyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const isValid = await checkVerification(verificationRecord.value, masterKey);
      if (isValid) {
        sessionKey.set(masterKey);
        isLocked.set(false);
        await loadCaptures();
        
        dbPassword = '';
        const redirect = $page.url.searchParams.get('redirect') ?? '/';
        await goto(redirect);
      } else {
        triggerError(isRecovery ? 'Invalid recovery phrase' : 'Incorrect database password');
      }
    } catch (err) {
      console.error('Db unlock failed:', err);
      triggerError('Incorrect password or recovery phrase');
    } finally {
      isProcessing = false;
    }
  }

  function triggerError(msg: string) {
    error = msg;
    pin = '';
    shake = true;
    setTimeout(() => { shake = false; }, 600);
  }

  function handleKeypad(e: KeyboardEvent) {
    if ($settings.dbEncrypted && !$sessionKey && mode === 'unlock') return; // Handled by standard input form
    if (e.key >= '0' && e.key <= '9') addDigit(e.key);
    else if (e.key === 'Backspace') deleteDigit();
    else if (e.key === 'Enter' && pin.length >= MIN_DIGITS) void handleSubmit();
  }

  const digits = ['1','2','3','4','5','6','7','8','9','✓','0','⌫'];

  function getTitle(): string {
    if ($settings.dbEncrypted && !$sessionKey && mode === 'unlock') {
      return t('settings.encryptionTitle') || 'Database Locked';
    }
    if (mode === 'set') return t('settings.pinSet');
    if (mode === 'change') return 'Enter new PIN';
    if (mode === 'confirm') return t('settings.pinConfirm');
    return t('lock.title');
  }

  function getSubtitle(): string {
    if ($settings.dbEncrypted && !$sessionKey && mode === 'unlock') {
      return 'Enter your master password or 12-word recovery phrase';
    }
    if (mode === 'set' || mode === 'change') return 'Enter a 4–6 digit PIN';
    if (mode === 'confirm') return 'Enter your PIN again to confirm';
    return t('lock.subtitle');
  }
</script>

<svelte:window onkeydown={handleKeypad} />
<svelte:head><title>Locked — Motif</title></svelte:head>

<div class="lock-screen">
  <!-- Logo -->
  <div class="lock-logo">
    <img src={$resolvedTheme === 'dark' ? '/logo-dark.png' : '/logo-light.png'} alt="Motif Logo" class="lock-logo-img" />
  </div>

  <!-- Title -->
  <h1 class="lock-title">{getTitle()}</h1>
  <p class="lock-subtitle">{getSubtitle()}</p>

  {#if $settings.dbEncrypted && !$sessionKey && mode === 'unlock'}
    <!-- Password Unlock Form -->
    <form onsubmit={(e) => { e.preventDefault(); void handleDbUnlock(); }} class="db-unlock-form" class:shake>
      <div class="password-input-wrapper">
        <input
          type={showPassword ? "text" : "password"}
          class="input db-password-input"
          placeholder={t('settings.encryptionPasswordPlaceholder') || 'Enter password or 12-word phrase...'}
          bind:value={dbPassword}
          disabled={isProcessing}
        />
        <button
          type="button"
          class="password-toggle-btn"
          onclick={() => showPassword = !showPassword}
          aria-label="Toggle password visibility"
        >
          {showPassword ? '👁' : '👁‍🗨'}
        </button>
      </div>

      <!-- Error message -->
      {#if error}
        <p class="error-msg fade-in">{error}</p>
      {:else}
        <p class="error-msg"></p>
      {/if}

      <button type="submit" class="btn-primary db-unlock-btn" disabled={isProcessing}>
        {isProcessing ? 'Decrypting...' : 'Unlock Database'}
      </button>
    </form>
  {:else}
    <!-- PIN dots -->
    <div class="pin-dots" class:shake>
      {#each Array($settings.pinLength) as _, i}
        <div
          class="dot"
          class:filled={i < pin.length}
          class:error={!!error}
        ></div>
      {/each}
    </div>

    <!-- Error message -->
    {#if error}
      <p class="error-msg fade-in">{error}</p>
    {:else}
      <p class="error-msg"></p>
    {/if}

    <!-- Numeric keypad -->
    <div class="keypad" role="group" aria-label="PIN keypad">
      {#each digits as digit}
        {#if digit === ''}
          <div class="key-spacer"></div>
        {:else if digit === '⌫'}
          <button
            class="key key-delete"
            onclick={deleteDigit}
            aria-label="Delete"
            disabled={isProcessing}
          >
            ⌫
          </button>
        {:else if digit === '✓'}
          <button
            class="key key-submit"
            onclick={handleSubmit}
            aria-label="Submit"
            disabled={isProcessing || pin.length < MIN_DIGITS}
          >
            ✓
          </button>
        {:else}
          <button
            class="key"
            onclick={() => addDigit(digit)}
            disabled={isProcessing}
            aria-label={digit}
          >
            {digit}
          </button>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Forgot PIN (unlock mode only) -->
  {#if mode === 'unlock'}
    <div class="lock-footer">
      <a href="/settings" class="forgot-link">{t('lock.forgot')}</a>
      <p class="forgot-hint">{t('lock.forgotHint')}</p>
    </div>
  {/if}
</div>

<style>
  .lock-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--color-bg);
    gap: 0;
  }

  .lock-logo {
    width: 72px;
    height: 72px;
    background: var(--color-primary-subtle);
    border-radius: var(--radius-xl);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
  }

  .lock-logo-img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .lock-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 6px;
    text-align: center;
  }

  .lock-subtitle {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin: 0 0 32px;
    text-align: center;
    max-width: 320px;
    line-height: 1.4;
  }

  /* PIN dot indicators */
  .pin-dots {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
  }

  .pin-dots.shake, .db-unlock-form.shake {
    animation: shake 0.5s var(--ease-out);
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    15% { transform: translateX(-8px); }
    30% { transform: translateX(8px); }
    45% { transform: translateX(-6px); }
    60% { transform: translateX(6px); }
    75% { transform: translateX(-4px); }
    90% { transform: translateX(4px); }
  }

  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    background: transparent;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .dot.filled {
    background: var(--color-primary);
    border-color: var(--color-primary);
    transform: scale(1.1);
  }

  .dot.error {
    border-color: var(--color-danger);
  }

  .dot.filled.error {
    background: var(--color-danger);
  }

  .error-msg {
    font-size: 13px;
    color: var(--color-danger);
    text-align: center;
    min-height: 20px;
    margin: 0 0 24px;
  }

  /* Keypad */
  .keypad {
    display: grid;
    grid-template-columns: repeat(3, 72px);
    gap: 12px;
  }

  .key {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: none;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 22px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font-sans);
    transition: all var(--duration-fast) var(--ease-out);
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  }

  .key:hover:not(:disabled) {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    transform: scale(1.05);
  }

  .key:active:not(:disabled) {
    transform: scale(0.95);
    background: var(--color-primary);
    color: white;
  }

  .key:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .key-delete {
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 20px;
  }

  .key-submit {
    background: transparent;
    color: var(--color-primary);
    font-size: 24px;
    font-weight: 700;
  }

  .key-spacer {
    width: 72px;
    height: 72px;
  }

  /* DB Unlock Form Styles */
  .db-unlock-form {
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .password-input-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
  }

  .db-password-input {
    width: 100%;
    padding: 14px 44px 14px 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text);
    font-size: 14px;
    outline: none;
    transition: all var(--duration-fast) var(--ease-out);
    font-family: var(--font-sans);
  }

  .db-password-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  .password-toggle-btn {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: opacity var(--duration-fast);
  }

  .password-toggle-btn:hover {
    opacity: 1;
  }

  .db-unlock-btn {
    width: 100%;
    padding: 14px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-lg);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    font-family: var(--font-sans);
  }

  .db-unlock-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 85%, black);
    transform: translateY(-1px);
  }

  .db-unlock-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .db-unlock-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Footer */
  .lock-footer {
    margin-top: 40px;
    text-align: center;
  }

  .forgot-link {
    font-size: 14px;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .forgot-link:hover { text-decoration: underline; }

  .forgot-hint {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin: 8px 0 0;
    max-width: 280px;
    line-height: 1.5;
  }
</style>

