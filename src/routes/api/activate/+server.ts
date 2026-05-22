// ────────────────────────────────────────────────
// POST /api/activate — LemonSqueezy Integration with Dynamic Proxying
// ────────────────────────────────────────────────

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const KEY_REGEX = /^[A-Z0-9-]{10,64}$/;

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

  try {
    // 1. Mock key handling for local testing (starts with MOTIF-TEST-)
    if (normalized.startsWith('MOTIF-TEST-')) {
      const mockInstanceId = `mock-instance-${crypto.randomUUID().slice(0, 8)}`;
      return json({
        success: true,
        license: normalized,
        device: deviceId,
        instanceId: mockInstanceId,
        slotsUsed: 1,
        slotsTotal: 2
      });
    }

    // 2. Call LemonSqueezy License Activation API for real keys
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

    return json({
      success: true,
      license: normalized,
      device: deviceId,
      instanceId: String(lsData.instance.id),
      slotsUsed: lsData.license_key.activation_usage || 1,
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
