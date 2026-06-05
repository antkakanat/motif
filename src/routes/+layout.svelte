<script lang="ts">
  import './layout.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import BackupReminderBanner from '$lib/components/BackupReminderBanner.svelte';
  import InstallPromptBanner from '$lib/components/InstallPromptBanner.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import ProActionGateModal from '$lib/components/ProActionGateModal.svelte';
  import WhatsNew from '$lib/components/WhatsNew.svelte';
  import ShortcutCheatsheet from '$lib/components/ShortcutCheatsheet.svelte';
  import { initI18n } from '$lib/i18n';
  import { get } from 'svelte/store';
  import { captures, loadCaptures, purgeOldTrash } from '$lib/stores/captures';
  import { loadCollections } from '$lib/stores/collections';
  import { loadSettings, settings } from '$lib/stores/settings';
  import { registerShortcuts, handleKeydown } from '$lib/shortcuts';
  import { onMount } from 'svelte';
  import '$lib/theme';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import UpdateToast from '$lib/components/UpdateToast.svelte';
  import OnlineStatusToast from '$lib/components/OnlineStatusToast.svelte';
  import { initInstallPrompt } from '$lib/stores/installPrompt';
  import { pwaInfo } from 'virtual:pwa-info';
  import { isForceFreeMode } from '$lib/pro';
  import { sessionKey } from '$lib/encryption';
  import { restoreReminderTimers } from '$lib/reminders';
  import { browser } from '$app/environment';

  import { showToast } from '$lib/stores/toast';

  const WHATS_NEW_KEY = 'motif_last_seen_version';
  const CURRENT_VERSION = '1.2.0';


  let { children } = $props();
  let ready = $state(false);
  let showUpdateToast = $state(false);
  let showWhatsNew = $state(false);
  let showShortcuts = $state(false);
  let swRegistration = $state<ServiceWorkerRegistration | undefined>(undefined);
  let forceFreeMode = $derived(isForceFreeMode());

  // SEO variables
  const noindexRoutes = [
    '/links',
    '/quotes',
    '/notes',
    '/images',
    '/archived',
    '/trash',
    '/reminders',
    '/settings',
    '/lock'
  ];

  const isNoindexRoute = $derived.by(() => {
    const path = $page.url.pathname;
    return noindexRoutes.includes(path) || path.startsWith('/read/');
  });

  const canonicalUrl = $derived.by(() => {
    if ($page.url.pathname === '/') {
      return 'https://motif.byant.dev/';
    }
    return 'https://motif.byant.dev' + $page.url.pathname;
  });

  const pageTitle = $derived.by(() => {
    if ($page.url.pathname === '/') {
      return 'Motif - Capture every note, link, and quote privately.';
    }
    return 'Motif - Capture every note.';
  });

  const pageDescription = $derived.by(() => {
    if ($page.url.pathname === '/') {
      return 'No cloud. No subscription. No tracking. Just your private links, quotes, notes, and images - 100% offline and secured with AES-256 local database encryption.';
    }
    return 'No cloud. No subscription. No noise. Just your links, quotes, notes, and images - private, offline, and always yours.';
  });


  // Auto-lock idle timer
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    const autoLockMinutes = $settings.autoLockMinutes;
    if (autoLockMinutes === 0) return; // Never
    if (!$settings.pinHash && !$settings.dbEncrypted) return; // No locks active
    idleTimer = setTimeout(() => {
      const isOnLock = $page.url.pathname === '/lock';
      if (!isOnLock) {
        if ($settings.dbEncrypted) {
          sessionKey.set(null);
          void loadCaptures();
        }
        goto(`/lock?redirect=${encodeURIComponent($page.url.pathname)}`);
      }
    }, autoLockMinutes * 60 * 1000);
  }

  function handleUserActivity() {
    resetIdleTimer();
  }

  $effect(() => {
    // Re-run whenever settings change or app is ready
    if (ready) {
      resetIdleTimer();
    }
  });

  onMount(async () => {
    initInstallPrompt({ countVisit: true });
    await initI18n();
    await loadSettings();
    await loadCaptures();
    await loadCollections();
    await purgeOldTrash();
    // Register PWA/service worker on supported browsers.
    if (pwaInfo) {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({
        immediate: true,
        onNeedRefresh: () => {
          showUpdateToast = true;
        },
        onRegistered: (registration: ServiceWorkerRegistration | undefined) => {
          swRegistration = registration;
          console.log('Motif Service Worker Registered');
        },
        onRegisterError: (error: unknown) => {
          console.error('Service Worker Registration Error:', error);
        }
      } as any);
    }

    ready = true;

    // Check if What's New should auto-show
    if (browser) {
      const storedVersion = localStorage.getItem(WHATS_NEW_KEY);
      const currentVersion = CURRENT_VERSION;
      const shouldShowWhatsNew = 
        get(captures).length > 0 && 
        storedVersion !== currentVersion &&
        currentVersion !== null;

      if (shouldShowWhatsNew) {
        setTimeout(() => { showWhatsNew = true; }, 1200);
      }

      // Initialize LemonSqueezy overlay checkout
      const initLemon = () => {
        if ((window as any).LemonSqueezy) {
          try {
            (window as any).LemonSqueezy.Setup({
              eventHandler: (event: any) => {
                console.log('LemonSqueezy Event:', event);
                if (event.event === 'Checkout.Success') {
                  showToast('🎉 Purchase successful! Enter your license key to activate Pro.');
                  void goto('/settings?activate=1');
                }
              }
            });
          } catch (e) {
            console.error('Failed to setup LemonSqueezy event handler:', e);
          }
        } else {
          setTimeout(initLemon, 500);
        }
      };
      setTimeout(initLemon, 1000);
    }

    // Restore in-tab reminder timers
    await restoreReminderTimers();

    // Redirect to lock if PIN is set or database is encrypted and locked, and we're not already on the lock route
    const hasPIN = $settings.pinHash;
    const isDbLocked = $settings.dbEncrypted && !$sessionKey;
    const isLock = $page.url.pathname === '/lock';
    if ((hasPIN || isDbLocked) && !isLock) {
      await goto(`/lock?redirect=${encodeURIComponent($page.url.pathname)}`);
    }
  });

  function handleUpdate() {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  }

  function onKeydown(e: KeyboardEvent) {
    // ? opens shortcuts cheatsheet (when not typing in an input)
    if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
      e.preventDefault();
      showShortcuts = true;
      return;
    }
    handleKeydown(e);
    handleUserActivity();
  }

  /** Trigger haptic feedback on mobile PWA */
  function vibrate(pattern: number | number[]) {
    if (browser && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // Expose vibrate globally so child components can call it
  if (browser) {
    (window as any).__motifVibrate = vibrate;
  }
</script>

<svelte:head>
  {#if isNoindexRoute}
    <meta name="robots" content="noindex, follow" />
  {/if}
  <title>{pageTitle}</title>
  <meta name="description" content={pageDescription} />
  <meta name="theme-color" content="#5B4ED6" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="canonical" href={canonicalUrl} />
  {@html pwaInfo ? pwaInfo.webManifest.linkTag : ''}
  <script src="https://assets.lemonsqueezy.com/lemon.js" defer></script>
</svelte:head>

<!-- Track user activity to reset idle timer -->
<svelte:window
  onkeydown={onKeydown}
  onmousemove={handleUserActivity}
  onclick={handleUserActivity}
  ontouchstart={handleUserActivity}
/>

{#if ready}
  <!-- Lock screen gets its own full-page layout - no sidebar/nav -->
  {#if $page.url.pathname === '/lock'}
    {@render children()}
  {:else}
    <div class="app-shell">
      <Sidebar />
      <main class="main-content">
        <InstallPromptBanner />
        <BackupReminderBanner />
        {@render children()}
      </main>
      <BottomNav />
    </div>
  {/if}
  {:else}
  <div class="app-loading">
    <div class="loading-logo">
      <img src="/logo-light.png" alt="Motif Logo" class="loading-logo-img" />
    </div>
    <p class="loading-text">Motif</p>
  </div>
{/if}

<Toast />
<OnlineStatusToast />
<ProActionGateModal />
<WhatsNew bind:open={showWhatsNew} />
<ShortcutCheatsheet bind:open={showShortcuts} />

{#if showUpdateToast}
  <UpdateToast 
    onUpdate={handleUpdate} 
    onDismiss={() => showUpdateToast = false} 
  />
{/if}

{#if forceFreeMode}
  <div class="force-free-pill">FORCE FREE</div>
{/if}

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  .main-content {
    flex: 1;
    padding: 24px 32px;
    padding-top: calc(24px + env(safe-area-inset-top, 0px));
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding-bottom: 100px;
    /* Ensure content is scrollable on mobile */
    overflow-x: hidden;
  }

  @media (max-width: 768px) {
    .main-content {
      padding: 16px;
      padding-top: calc(16px + env(safe-area-inset-top, 0px));
      padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));
    }
  }

  .app-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 12px;
  }

  .loading-logo {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-subtle);
    border-radius: var(--radius-xl);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .loading-logo-img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
  }

  .loading-text {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .force-free-pill {
    position: fixed;
    right: 12px;
    bottom: calc(68px + env(safe-area-inset-bottom, 0px));
    z-index: 9999;
    padding: 3px 8px;
    border-radius: 4px;
    background: #e24b4a;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  @media (min-width: 769px) {
    .force-free-pill {
      bottom: 12px;
    }
  }
</style>
