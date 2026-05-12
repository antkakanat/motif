// ────────────────────────────────────────────────
// Pro Gate — trial + license checks
// ────────────────────────────────────────────────

import { get } from 'svelte/store';
import { pwaInfo } from 'virtual:pwa-info';
import { settings } from '$lib/stores/settings';

import { browser } from '$app/environment';

export function isProUnlocked(): boolean {
  if (browser && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    return true;
  }
  const state = get(settings);
  return state.proActive;
}

export function isFreeUser(): boolean {
  const state = get(settings);
  return !state.proActive;
}

// ── License key format validation (Phase 1 stub) ──

// Matches either MOTIF-XXXX-XXXX-XXXX or standard UUID format (Lemon Squeezy default)
const KEY_REGEX = /^(MOTIF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12})$/;

export function validateKeyFormat(key: string): boolean {
  return KEY_REGEX.test(key.toUpperCase().trim());
}

// ── Features that require Pro ──

export const PRO_FEATURES = [
  'collections',
  'export',
  'import',
  'ocr',
  'aiSearch',
  'encryption',
  'bulkActions',
  'readingView'
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export function isFeatureAvailable(feature: ProFeature): boolean {
  return isProUnlocked();
}
