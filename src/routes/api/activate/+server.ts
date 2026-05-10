// ────────────────────────────────────────────────
// POST /api/activate — LemonSqueezy Integration
// ────────────────────────────────────────────────

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const KEY_REGEX = /^(MOTIF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12})$/;

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
    // ── Call LemonSqueezy License Activation API ──
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
      // LemonSqueezy returns license_key info in the response
      slotsUsed: lsData.license_key.activation_usage,
      slotsTotal: lsData.license_key.activation_limit
    });
  } catch (err) {
    console.error('LemonSqueezy activation error:', err);
    return json({
      success: false,
      error: 'Communication with activation server failed. Please try again later.'
    }, { status: 500 });
  }
};
