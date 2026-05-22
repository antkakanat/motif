// ────────────────────────────────────────────────
// License — Production Implementation with server-side validation
// ────────────────────────────────────────────────

import { get } from 'svelte/store';
import { validateKeyFormat } from '$lib/pro';
import { settings, activateLicense, deactivateLicense } from '$lib/stores/settings';
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
    return { success: false, error: 'Invalid license key format. Please check your key and try again.' };
  }

  try {
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

    // Persist LemonSqueezy instance.id in localStorage for slot tracking/deactivation
    if (browser && data.instanceId) {
      localStorage.setItem('motif_license_instance_id', data.instanceId);
    }

    // Store Pro state locally — subsequent app opens don't need internet
    await activateLicense(normalized);

    return {
      success: true,
      slotsUsed: data.slotsUsed,
      slotsTotal: data.slotsTotal
    };
  } catch (err) {
    // Offline verification fails explicitly on first activation
    console.error('License activation client error:', err);
    return {
      success: false,
      error: 'Network connection error. Please connect to the internet to activate your license.'
    };
  }
}

// ── Deactivate ──

export async function deactivate(): Promise<void> {
  const key = get(settings).licenseKey;

  if (key) {
    try {
      const instanceId = browser ? localStorage.getItem('motif_license_instance_id') : null;
      
      // Call SvelteKit API endpoint to release the device slot on LemonSqueezy
      await fetch('/api/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: key,
          instanceId: instanceId || ''
        })
      });
    } catch (err) {
      console.warn('Deactivation server sync failed (will still clean up locally):', err);
    }
  }

  if (browser) {
    localStorage.removeItem('motif_license_instance_id');
  }

  // Deactivate locally anyway to ensure user is logged out of local Pro
  await deactivateLicense();
}
