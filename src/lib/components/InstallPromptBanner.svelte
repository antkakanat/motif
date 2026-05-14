<script lang="ts">
  import { onMount } from 'svelte';

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }

  const DISMISSED_TS_KEY = 'motif_install_dismissed_ts';
  const INSTALLED_KEY = 'motif_installed';
  const VISIT_COUNT_KEY = 'motif_install_visit_count';
  const REAPPEAR_HOURS = 72;

  let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
  let isVisible = $state(false);
  let isIos = $state(false);
  let isAndroid = $state(false);
  let isHuawei = $state(false);
  let isStandalone = $state(false);

  function checkEligibility() {
    // 1. If already installed, don't show
    if (localStorage.getItem(INSTALLED_KEY) === 'true') return;
    
    // 2. Check if currently in standalone mode
    isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                   (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      localStorage.setItem(INSTALLED_KEY, 'true');
      return;
    }

    // 3. Check dismissal timestamp
    const dismissedTs = localStorage.getItem(DISMISSED_TS_KEY);
    if (dismissedTs) {
      const hoursSinceDismissal = (Date.now() - parseInt(dismissedTs)) / (1000 * 60 * 60);
      if (hoursSinceDismissal < REAPPEAR_HOURS) return;
    }

    const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    if (visits < 2) return;

    // 4. Detect OS
    const ua = navigator.userAgent.toLowerCase();
    isIos = /iphone|ipad|ipod/i.test(ua);
    isAndroid = /android/i.test(ua);
    isHuawei = /huawei|harmonyos/i.test(ua);

    // 5. Final visibility check
    // Show if:
    // - We have the automatic prompt (Android/Desktop)
    // - OR it's a mobile device (iOS/Android/Huawei) and we're not in standalone mode
    isVisible = Boolean(deferredPrompt) || ((isIos || isAndroid || isHuawei) && !isStandalone);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_TS_KEY, Date.now().toString());
    isVisible = false;
  }

  async function handleInstall() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, 'true');
      isVisible = false;
    }
  }

  onMount(() => {
    const previousVisits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    localStorage.setItem(VISIT_COUNT_KEY, String(previousVisits + 1));

    checkEligibility();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      checkEligibility();
    };

    const onAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, 'true');
      isVisible = false;
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  });
</script>

{#if isVisible}
  <div class="install-card" role="dialog" aria-labelledby="install-title">
    <div class="card-header">
      <div class="logo-mini">
        <img src="/logo-light.png" alt="Motif" />
      </div>
      <div class="header-text">
        <h4 id="install-title">Install Motif</h4>
        <p>Works offline & launches in full-screen</p>
      </div>
      <button class="close-btn" onclick={handleDismiss} aria-label="Dismiss">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <div class="card-content">
      {#if isIos}
        <div class="mobile-steps">
          <div class="step">
            <span class="step-num">1</span>
            <span class="step-text">Tap the Share button</span>
            <div class="step-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </div>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <span class="step-text">Tap "Add to Home Screen"</span>
            <div class="step-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </div>
          </div>
        </div>
      {:else if deferredPrompt}
        <button class="install-btn primary" onclick={handleInstall}>
          Install App
        </button>
      {:else if isAndroid || isHuawei}
        <div class="mobile-steps">
          <div class="step">
            <span class="step-num">1</span>
            <span class="step-text">Tap the menu (three dots)</span>
            <div class="step-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
            </div>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <span class="step-text">Tap "Install app" or "Add to home screen"</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .install-card {
    position: fixed;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    left: 20px;
    right: 20px;
    max-width: 400px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    padding: 16px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: slideUp 0.4s var(--ease-out);
  }

  @keyframes slideUp {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-mini {
    width: 40px;
    height: 40px;
    background: var(--color-primary-subtle);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .logo-mini img { width: 28px; height: 28px; object-fit: contain; }

  .header-text { flex: 1; }
  .header-text h4 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-text); }
  .header-text p { margin: 2px 0 0; font-size: 0.81rem; color: var(--color-text-secondary); }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    transition: background 0.2s;
  }

  .close-btn:hover { background: var(--color-bg-hover); color: var(--color-text); }

  .card-content { display: flex; flex-direction: column; }

  .install-btn {
    width: 100%;
    padding: 10px;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    transition: all 0.2s;
  }

  .install-btn.primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .install-btn.primary:hover { filter: brightness(1.1); transform: translateY(-1px); }

  .mobile-steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--color-bg);
    padding: 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .step {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .step-num {
    width: 20px;
    height: 20px;
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .step-text { font-size: 0.81rem; color: var(--color-text-secondary); flex: 1; }

  .step-icon {
    color: var(--color-primary);
    display: flex;
    align-items: center;
  }

  @media (min-width: 769px) {
    .install-card { left: 24px; bottom: 24px; }
  }
</style>
