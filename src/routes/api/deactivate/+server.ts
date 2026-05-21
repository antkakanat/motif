// ────────────────────────────────────────────────
// POST /api/deactivate — LemonSqueezy Integration with Slot Release
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
      error: 'Invalid license key format.'
    }, { status: 422 });
  }

  const kvKey = `license:${normalized}`;

  try {
    // 1. Fetch allocations from KV
    let allocations = (await kvGet<DeviceAllocation[]>(kvKey)) || [];

    // 2. Find matching device
    const deviceIndex = allocations.findIndex(a => a.deviceId === deviceId);

    if (deviceIndex === -1) {
      // Already deactivated or never existed
      return json({ success: true, message: 'Device was not active.' });
    }

    const targetAllocation = allocations[deviceIndex];

    // 3. Mock key handling bypasses real LemonSqueezy deactivation call
    if (normalized.startsWith('MOTIF-TEST-')) {
      // Just filter it out of KV
      allocations.splice(deviceIndex, 1);
      await kvSet(kvKey, allocations);
      return json({ success: true });
    }

    // 4. Call LemonSqueezy deactivation API for real keys
    const lsResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        license_key: normalized,
        instance_id: targetAllocation.instanceId
      })
    });

    const lsData = await lsResponse.json();

    // Note: If LemonSqueezy deactivation returns a failure but the instance is already gone
    // or key is inactive, we should still clean it up in our local tracking.
    const isSuccess = lsResponse.ok || lsData.error === 'Instance not found' || lsData.deactivated === true;

    if (!isSuccess) {
      return json({
        success: false,
        error: lsData.error || 'Failed to deactivate license key on LemonSqueezy.'
      }, { status: 400 });
    }

    // 5. Save updated allocations list in KV
    allocations.splice(deviceIndex, 1);
    await kvSet(kvKey, allocations);

    return json({ success: true });
  } catch (err) {
    console.error('License deactivation endpoint error:', err);
    return json({
      success: false,
      error: 'Communication with deactivation server failed. Please try again later.'
    }, { status: 500 });
  }
};
