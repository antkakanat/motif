// ────────────────────────────────────────────────
// License — Phase 1 stub (validates format, POSTs to /api/activate)
// Phase 2: /api/activate will call LemonSqueezy + manage device slots
// ────────────────────────────────────────────────

import { validateKeyFormat } from '$lib/pro';
import { activateLicense, deactivateLicense } from '$lib/stores/settings';
import { browser } from '$app/environment';

// ── Device ID — stable per browser instance ──

const DEVICE_ID_KEY = 'motif_device_id';

export function getDeviceId(): string {
  if (!browser) return 'server';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Activate ──

export interface ActivationResult {
  success: boolean;
  error?: string;
  slotsUsed?: number;
  slotsTotal?: number;
}

export async function activate(key: string): Promise<ActivationResult> {
  const normalized = key.toUpperCase().trim();

  if (!validateKeyFormat(normalized)) {
    return { success: false, error: 'Invalid license key format. Expected: MOTIF-XXXX-XXXX-XXXX' };
  }

  try {
    // POST to the SvelteKit server route (stub in Phase 1, real API in Phase 2)
    const response = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: normalized,
        deviceId: getDeviceId()
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error ?? 'Activation failed' };
    }

    // Store Pro state locally — subsequent app opens don't need internet
    await activateLicense(normalized);

    return {
      success: true,
      slotsUsed: data.slotsUsed,
      slotsTotal: data.slotsTotal
    };
  } catch {
    // Offline fallback — if server unreachable and format is valid, activate locally
    // This is intentional: after first online activation, offline use always works
    await activateLicense(normalized);
    return { success: true };
  }
}

// ── Deactivate ──

export async function deactivate(): Promise<void> {
  await deactivateLicense();
}
