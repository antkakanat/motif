// ────────────────────────────────────────────────
// Settings Store — theme, PIN, trial, license, backup
// ────────────────────────────────────────────────

import { writable, get } from 'svelte/store';
import { db, type AppSettings } from '$lib/db';
import { browser } from '$app/environment';

// ── Settings keys ──
const KEYS = {
  PIN_HASH: 'pinHash',
  AUTO_LOCK_MINUTES: 'autoLockMinutes',
  LAST_BACKUP_AT: 'lastBackupAt',
  LICENSE_KEY: 'licenseKey',
  PRO_ACTIVE: 'proActive',
  ONBOARDING_DONE: 'onboardingDone',
  PIN_LENGTH: 'pinLength',
  AUTO_OCR: 'autoOcr',
  AUTO_AI_SEARCH: 'autoAiSearch',
  DB_ENCRYPTED: 'dbEncrypted',
  AUTO_FETCH_METADATA: 'autoFetchMetadata'
} as const;

// ── Settings store ──

interface SettingsState {
  pinHash: string | null;
  autoLockMinutes: number; // 0 = never
  lastBackupAt: string | null;
  licenseKey: string | null;
  proActive: boolean;
  onboardingDone: boolean;
  pinLength: number;
  autoOcr: boolean;
  autoAiSearch: boolean;
  dbEncrypted: boolean;
  autoFetchMetadata: boolean;
}

const defaultSettings: SettingsState = {
  pinHash: null,
  autoLockMinutes: 5,
  lastBackupAt: null,
  licenseKey: null,
  proActive: false,
  onboardingDone: false,
  pinLength: 4,
  autoOcr: true,
  autoAiSearch: false,
  dbEncrypted: false,
  autoFetchMetadata: true
};

export const settings = writable<SettingsState>({ ...defaultSettings });

// ── Load from DB ──

export async function loadSettings(): Promise<void> {
  const rows = await db.settings.toArray();
  const state = { ...defaultSettings };

  for (const row of rows) {
    switch (row.key) {
      case KEYS.PIN_HASH:
        state.pinHash = row.value;
        break;
      case KEYS.AUTO_LOCK_MINUTES: {
        const mins = parseInt(row.value, 10);
        state.autoLockMinutes = isNaN(mins) ? 0 : mins;
        break;
      }
      case KEYS.LAST_BACKUP_AT:
        state.lastBackupAt = row.value;
        break;
      case KEYS.LICENSE_KEY:
        state.licenseKey = row.value;
        break;
      case KEYS.PRO_ACTIVE:
        state.proActive = row.value === 'true';
        break;
      case KEYS.ONBOARDING_DONE:
        state.onboardingDone = row.value === 'true';
        break;
      case KEYS.PIN_LENGTH:
        state.pinLength = parseInt(row.value, 10) || 4;
        break;
      case KEYS.AUTO_OCR:
        state.autoOcr = row.value === 'true';
        break;
      case KEYS.AUTO_AI_SEARCH:
        state.autoAiSearch = row.value === 'true';
        break;
      case KEYS.DB_ENCRYPTED:
        state.dbEncrypted = row.value === 'true';
        break;
      case KEYS.AUTO_FETCH_METADATA:
        state.autoFetchMetadata = row.value === 'true';
        break;
    }
  }

  settings.set(state);
}

// ── Save individual setting ──

async function saveSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

// ── PIN ──

export async function setPin(hash: string, length: number): Promise<void> {
  await saveSetting(KEYS.PIN_HASH, hash);
  await saveSetting(KEYS.PIN_LENGTH, String(length));
  settings.update((s) => ({ ...s, pinHash: hash, pinLength: length }));
}

export async function clearPin(): Promise<void> {
  await db.settings.delete(KEYS.PIN_HASH);
  await db.settings.delete(KEYS.PIN_LENGTH);
  settings.update((s) => ({ ...s, pinHash: null, pinLength: 4 }));
}

export async function hashPin(pin: string): Promise<string> {
  // Use Web Crypto API for PIN hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'motif-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Auto-lock ──

export async function setAutoLockMinutes(minutes: number): Promise<void> {
  await saveSetting(KEYS.AUTO_LOCK_MINUTES, String(minutes));
  settings.update((s) => ({ ...s, autoLockMinutes: minutes }));
}

// ── Backup ──

export async function markBackupDone(): Promise<void> {
  const timestamp = new Date().toISOString();
  await saveSetting(KEYS.LAST_BACKUP_AT, timestamp);
  settings.update((s) => ({ ...s, lastBackupAt: timestamp }));
}

export function shouldShowBackupReminder(): boolean {
  const state = get(settings);
  if (!state.lastBackupAt) return true; // Never backed up
  const lastBackup = new Date(state.lastBackupAt).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - lastBackup > thirtyDays;
}

// ── License ──

export async function activateLicense(key: string): Promise<void> {
  await saveSetting(KEYS.LICENSE_KEY, key);
  await saveSetting(KEYS.PRO_ACTIVE, 'true');
  settings.update((s) => ({ ...s, licenseKey: key, proActive: true }));
}

export async function deactivateLicense(): Promise<void> {
  await db.settings.delete(KEYS.LICENSE_KEY);
  await saveSetting(KEYS.PRO_ACTIVE, 'false');
  settings.update((s) => ({ ...s, licenseKey: null, proActive: false }));
}

export async function setAutoOcr(enabled: boolean): Promise<void> {
  await saveSetting(KEYS.AUTO_OCR, String(enabled));
  settings.update((s) => ({ ...s, autoOcr: enabled }));
}

export async function setAutoAiSearch(enabled: boolean): Promise<void> {
  await saveSetting(KEYS.AUTO_AI_SEARCH, String(enabled));
  settings.update((s) => ({ ...s, autoAiSearch: enabled }));
}

export async function setDbEncrypted(enabled: boolean): Promise<void> {
  await saveSetting(KEYS.DB_ENCRYPTED, String(enabled));
  settings.update((s) => ({ ...s, dbEncrypted: enabled }));
}

export async function setAutoFetchMetadata(enabled: boolean): Promise<void> {
  await saveSetting(KEYS.AUTO_FETCH_METADATA, String(enabled));
  settings.update((s) => ({ ...s, autoFetchMetadata: enabled }));
}

// ── Onboarding ──

export async function markOnboardingDone(): Promise<void> {
  await saveSetting(KEYS.ONBOARDING_DONE, 'true');
  settings.update((s) => ({ ...s, onboardingDone: true }));
}

// ── Factory Reset ──

export async function factoryReset(): Promise<void> {
  await db.delete();
  if (browser) {
    localStorage.clear();
    window.location.reload();
  }
}
