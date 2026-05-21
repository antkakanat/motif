// ────────────────────────────────────────────────
// POST /api/activate — LemonSqueezy Integration with Slot Tracking
// ────────────────────────────────────────────────

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { kvGet, kvSet } from '$lib/server/kv';

const KEY_REGEX = /^(MOTIF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12})$/;

interface DeviceAllocation {
  deviceId: string;
  instanceId: string;
  activatedAt: number;
}

export const POST: RequestHandler = async ({ request }) => {
  let body: { licenseKey?: string; deviceId?: string };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { licenseKey, deviceId } = body;

  // Validate inputs
  if (!licenseKey || typeof licenseKey !== 'string') {
    throw error(400, 'licenseKey is required');
  }

  if (!deviceId || typeof deviceId !== 'string') {
    throw error(400, 'deviceId is required');
  }

  const normalized = licenseKey.toUpperCase().trim();

  if (!KEY_REGEX.test(normalized)) {
    return json({
      success: false,
      error: 'Invalid license key format. Please check your key.'
    }, { status: 422 });
  }

  const kvKey = `license:${normalized}`;

  try {
    // 1. Fetch current device allocations from KV
    let allocations = (await kvGet<DeviceAllocation[]>(kvKey)) || [];

    // 2. Idempotency Check: If device is already registered, return success immediately
    const existingIndex = allocations.findIndex(a => a.deviceId === deviceId);
    if (existingIndex !== -1) {
      return json({
        success: true,
        license: normalized,
        device: deviceId,
        slotsUsed: allocations.length,
        slotsTotal: 2
      });
    }

    // 3. Slot Capacity Check (max 2 devices)
    if (allocations.length >= 2) {
      return json({
        success: false,
        error: 'Activation limit reached. Please deactivate another device first.'
      }, { status: 400 });
    }

    // 4. Mock key handling for local testing (starts with MOTIF-TEST-)
    if (normalized.startsWith('MOTIF-TEST-')) {
      const mockInstanceId = `mock-instance-${crypto.randomUUID().slice(0, 8)}`;
      const newAllocation: DeviceAllocation = {
        deviceId,
        instanceId: mockInstanceId,
        activatedAt: Date.now()
      };
      allocations.push(newAllocation);
      await kvSet(kvKey, allocations);

      return json({
        success: true,
        license: normalized,
        device: deviceId,
        slotsUsed: allocations.length,
        slotsTotal: 2
      });
    }

    // 5. Call LemonSqueezy License Activation API for real keys
    const lsResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        license_key: normalized,
        instance_name: deviceId
      })
    });

    const lsData = await lsResponse.json();

    if (!lsResponse.ok || !lsData.activated) {
      return json({
        success: false,
        error: lsData.error || 'License activation failed. Please check your key.'
      }, { status: 400 });
    }

    // 6. Save allocation in KV
    const newAllocation: DeviceAllocation = {
      deviceId,
      instanceId: String(lsData.instance.id),
      activatedAt: Date.now()
    };
    allocations.push(newAllocation);
    await kvSet(kvKey, allocations);

    return json({
      success: true,
      license: normalized,
      device: deviceId,
      slotsUsed: allocations.length,
      slotsTotal: lsData.license_key.activation_limit || 2
    });
  } catch (err) {
    console.error('License activation endpoint error:', err);
    return json({
      success: false,
      error: 'Communication with activation server failed. Please try again later.'
    }, { status: 500 });
  }
};
