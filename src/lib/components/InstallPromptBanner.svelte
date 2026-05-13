<script lang="ts">
  import { onMount } from 'svelte';

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }

  const VISITS_KEY = 'motif_visits';
  const DISMISSED_KEY = 'motif_install_dismissed';
  const REQUIRED_VISITS = 2;

  let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
  let isVisible = $state(false);
  let isIosSafari = $state(false);

  function isStandaloneMode(): boolean {
    const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
    const standaloneNavigator = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    return standaloneMedia || standaloneNavigator;
  }

  function detectIosSafari(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    return isIOS && isSafari;
  }

  function showIfEligible() {
    if (isStandaloneMode()) {
      isVisible = false;
      return;
    }

    const visits = Number(localStorage.getItem(VISITS_KEY) ?? '0');
    const dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
    const canInstall = Boolean(deferredPrompt) || isIosSafari;
    isVisible = visits >= REQUIRED_VISITS && !dismissed && canInstall;
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    isVisible = false;
  }

  async function handleInstall() {
    if (isIosSafari || !deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      localStorage.setItem(DISMISSED_KEY, '1');
      isVisible = false;
    }
  }

  onMount(() => {
    const nextVisits = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1;
    localStorage.setItem(VISITS_KEY, String(nextVisits));
    isIosSafari = detectIosSafari();
    showIfEligible();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      showIfEligible();
    };

    const onAppInstalled = () => {
      localStorage.setItem(DISMISSED_KEY, '1');
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
  <div class="install-banner" role="status">
    <p class="install-text">
      Install Motif for faster access
      {#if isIosSafari}
        <span class="ios-hint">Tap Share -> Add to Home Screen</span>
      {/if}
    </p>
    <div class="install-actions">
      {#if !isIosSafari}
        <button class="install-btn primary" onclick={handleInstall}>Install</button>
      {/if}
      <button class="install-btn" onclick={handleDismiss}>Not now</button>
    </div>
  </div>
{/if}

<style>
  .install-banner {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    border:1px solid var(--color-border);
    background:var(--color-surface);
    border-radius:var(--radius-md);
    padding:10px 12px;
    margin-bottom:12px;
  }

  .install-text {
    margin:0;
    color:var(--color-text);
    font-size:0.875rem;
    font-weight:500;
  }

  .ios-hint {
    display:block;
    font-size:0.75rem;
    color:var(--color-text-secondary);
    margin-top:4px;
    font-weight:400;
  }

  .install-actions {
    display:flex;
    align-items:center;
    gap:8px;
    flex-shrink:0;
  }

  .install-btn {
    border:1px solid var(--color-border);
    border-radius:var(--radius-sm);
    background:var(--color-bg);
    color:var(--color-text-secondary);
    padding:6px 10px;
    font-size:0.75rem;
    font-family:var(--font-sans);
    cursor:pointer;
  }

  .install-btn.primary {
    color:#fff;
    border-color:var(--color-primary);
    background:var(--color-primary);
  }

  @media (max-width: 768px) {
    .install-banner {
      flex-direction:column;
      align-items:flex-start;
    }
  }
</style>
