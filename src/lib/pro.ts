// localStorage override for testing Free tier behavior in development:
// set localStorage.motif_force_free = "true" to force Free mode locally.

import { get } from 'svelte/store';
import { settings } from '$lib/stores/settings';
import { hasTranslationKey } from '$lib/i18n';
import { openProGateModal } from '$lib/stores/proGate';
import { browser, dev } from '$app/environment';

export const PRO_FEATURES = [
  'collections',
  'export',
  'import',
  'readingView',
  'ocr',
  'aiSearch',
  'earlyAccess'
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

const PRO_FEATURE_SET = new Set<ProFeature>(PRO_FEATURES);
let didRunDevI18nAssertion = false;

function runDevI18nAssertion(): void {
  if (!dev || didRunDevI18nAssertion) return;
  didRunDevI18nAssertion = true;

  for (const feature of PRO_FEATURES) {
    const key = `pro.gate.feature.${feature}`;
    if (!hasTranslationKey(key)) {
      console.error(`[Motif] Missing i18n key: ${key}`);
    }
  }
}

export function assertProFeature(feature: ProFeature): void {
  if (!PRO_FEATURE_SET.has(feature)) {
    throw new Error(`[Motif] Unknown Pro feature: ${feature}`);
  }
}

export function isForceFreeMode(): boolean {
  if (!browser) return false;
  return localStorage.getItem('motif_force_free') === 'true';
}

export function isProUnlocked(): boolean {
  if (isForceFreeMode()) {
    return false;
  }

  if (browser && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    return true;
  }

  const state = get(settings);
  return state.proActive;
}

export function isFreeUser(): boolean {
  return !isProUnlocked();
}

const KEY_REGEX = /^(MOTIF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12})$/;

export function validateKeyFormat(key: string): boolean {
  return KEY_REGEX.test(key.toUpperCase().trim());
}

export function isFeatureAvailable(feature: ProFeature): boolean {
  assertProFeature(feature);
  runDevI18nAssertion();
  return isProUnlocked();
}

export async function requestProFeature(feature: ProFeature, featureLabel: string): Promise<boolean> {
  if (isFeatureAvailable(feature)) {
    return true;
  }

  return openProGateModal(feature, featureLabel);
}
