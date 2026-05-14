import { derived, get, writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallPlatform = 'ios' | 'android' | 'huawei' | 'desktop' | 'other';

interface InstallPromptState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  dismissedUntil: number | null;
  initialized: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  platform: InstallPlatform;
  visitCount: number;
}

const DISMISSED_TS_KEY = 'motif_install_dismissed_ts';
const INSTALLED_KEY = 'motif_installed';
const VISIT_COUNT_KEY = 'motif_install_visit_count';
const REAPPEAR_HOURS = 72;

const defaultState: InstallPromptState = {
  deferredPrompt: null,
  dismissedUntil: null,
  initialized: false,
  isInstalled: false,
  isStandalone: false,
  platform: 'other',
  visitCount: 0
};

let initialized = false;

export const installPrompt = writable<InstallPromptState>({ ...defaultState });

export const installBannerVisible = derived(installPrompt, ($prompt) => {
  if ($prompt.isInstalled || $prompt.isStandalone) return false;
  if ($prompt.visitCount < 2) return false;
  if ($prompt.dismissedUntil && Date.now() < $prompt.dismissedUntil) return false;

  return Boolean($prompt.deferredPrompt) || ['ios', 'android', 'huawei'].includes($prompt.platform);
});

export const nativeInstallReady = derived(
  installPrompt,
  ($prompt) => Boolean($prompt.deferredPrompt) && !$prompt.isInstalled && !$prompt.isStandalone
);

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent.toLowerCase();

  if (/huawei|huaweibrowser|harmonyos/.test(ua)) return 'huawei';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/chrome|chromium|crios|edg|brave|opr/.test(ua)) return 'desktop';

  return 'other';
}

function getDismissedUntil(): number | null {
  const dismissedTs = Number(localStorage.getItem(DISMISSED_TS_KEY));
  if (!Number.isFinite(dismissedTs) || dismissedTs <= 0) return null;
  return dismissedTs + REAPPEAR_HOURS * 60 * 60 * 1000;
}

function getStandaloneStatus(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function refreshInstallState() {
  const isStandalone = getStandaloneStatus();
  const isInstalled = localStorage.getItem(INSTALLED_KEY) === 'true' || isStandalone;

  if (isStandalone) {
    localStorage.setItem(INSTALLED_KEY, 'true');
  }

  installPrompt.update((state) => ({
    ...state,
    dismissedUntil: getDismissedUntil(),
    initialized: true,
    isInstalled,
    isStandalone,
    platform: detectPlatform(),
    visitCount: Number(localStorage.getItem(VISIT_COUNT_KEY) || '0')
  }));
}

export function initInstallPrompt(options: { countVisit?: boolean } = {}) {
  if (!browser) return;

  if (options.countVisit) {
    const previousVisits = Number(localStorage.getItem(VISIT_COUNT_KEY) || '0');
    localStorage.setItem(VISIT_COUNT_KEY, String(previousVisits + 1));
  }

  if (initialized) {
    refreshInstallState();
    return;
  }

  initialized = true;
  refreshInstallState();

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    installPrompt.update((state) => ({
      ...state,
      deferredPrompt: event as BeforeInstallPromptEvent
    }));
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(INSTALLED_KEY, 'true');
    installPrompt.update((state) => ({
      ...state,
      deferredPrompt: null,
      isInstalled: true,
      isStandalone: true
    }));
  });
}

export function dismissInstallBanner() {
  if (!browser) return;

  const dismissedTs = Date.now();
  localStorage.setItem(DISMISSED_TS_KEY, String(dismissedTs));
  installPrompt.update((state) => ({
    ...state,
    dismissedUntil: dismissedTs + REAPPEAR_HOURS * 60 * 60 * 1000
  }));
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const promptEvent = get(installPrompt).deferredPrompt;
  if (!promptEvent) return 'unavailable';

  installPrompt.update((state) => ({
    ...state,
    deferredPrompt: null
  }));

  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;

  if (choice.outcome === 'accepted') {
    localStorage.setItem(INSTALLED_KEY, 'true');
    installPrompt.update((state) => ({
      ...state,
      isInstalled: true
    }));
  } else {
    dismissInstallBanner();
  }

  return choice.outcome;
}
