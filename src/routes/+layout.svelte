<script lang="ts">
  import './layout.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import BackupReminderBanner from '$lib/components/BackupReminderBanner.svelte';
  import InstallPromptBanner from '$lib/components/InstallPromptBanner.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import ProActionGateModal from '$lib/components/ProActionGateModal.svelte';
  import { initI18n } from '$lib/i18n';
  import { loadCaptures, purgeOldTrash } from '$lib/stores/captures';
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

  let { children } = $props();
  let ready = $state(false);
  let showUpdateToast = $state(false);
  let swRegistration = $state<ServiceWorkerRegistration | undefined>(undefined);
  let forceFreeMode = $derived(isForceFreeMode());

  // Auto-lock idle timer
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    const autoLockMinutes = $settings.autoLockMinutes;
    if (autoLockMinutes === 0 || !$settings.pinHash) return; // Never or no PIN set
    idleTimer = setTimeout(() => {
      const isOnLock = $page.url.pathname === '/lock';
      if (!isOnLock) {
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

    // Redirect to lock if PIN is set and we're not already on the lock route
    const hasPIN = $settings.pinHash;
    const isLock = $page.url.pathname === '/lock';
    if (hasPIN && !isLock) {
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
    handleKeydown(e);
    handleUserActivity();
  }
</script>

<svelte:head>
  <title>Motif - Capture every note.</title>
  <meta name="description" content="No cloud. No subscription. No noise. Just your links, quotes, notes, and images - private, offline, and always yours." />
  <meta name="theme-color" content="#5B4ED6" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
