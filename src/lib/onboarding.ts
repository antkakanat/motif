// ────────────────────────────────────────────────
// Onboarding tour — Driver.js, 4 steps
// Dismissed permanently on first real capture save
// ────────────────────────────────────────────────

import { browser } from '$app/environment';
import { markOnboardingDone } from '$lib/stores/settings';

const ONBOARDING_KEY = 'motif_onboarding_done';

export function isOnboardingDone(): boolean {
  if (!browser) return true;
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export async function completeOnboarding(): Promise<void> {
  if (!browser) return;
  localStorage.setItem(ONBOARDING_KEY, 'true');
  await markOnboardingDone();
}

export async function startOnboarding(): Promise<void> {
  if (!browser || isOnboardingDone()) return;

  // Dynamically import Driver.js to keep initial bundle small
  const { driver } = await import('driver.js');
  await import('driver.js/dist/driver.css');

  const driverObj = driver({
    showProgress: true,
    animate: true,
    overlayColor: 'rgba(15, 14, 26, 0.7)',
    smoothScroll: true,
    allowClose: true,
    onDestroyed: () => {
      // Mark done when dismissed at any step (they've seen the tour)
      localStorage.setItem(ONBOARDING_KEY, 'true');
    },
    steps: [
      {
        element: '#page-title',
        popover: {
          title: '👋 Welcome to Motif!',
          description: 'Your private, offline-first capture tool. Save anything here — links, quotes, notes, or images.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#search-input',
        popover: {
          title: '🔍 Find anything instantly',
          description: 'Fuzzy full-text search across all your captures. Try typing a keyword — results appear as you type.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#nav-settings',
        popover: {
          title: '⚙ Settings & Security',
          description: 'Set a PIN lock, choose your theme, manage your Pro license, and view your storage usage.',
          side: 'right',
          align: 'center'
        }
      },
      {
        popover: {
          title: '🛡 Everything stays private',
          description: 'Motif stores <strong>everything on your device</strong>. No cloud. No accounts. No tracking. Your captures are always yours.',
          align: 'center'
        }
      }
    ]
  });

  driverObj.drive();
}
