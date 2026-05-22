// ────────────────────────────────────────────────
// POST /api/deactivate — LemonSqueezy Integration with Dynamic Proxying
// ────────────────────────────────────────────────

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const KEY_REGEX = /^[A-Z0-9-]{10,64}$/;

export const POST: RequestHandler = async ({ request }) => {
  let body: { licenseKey?: string; instanceId?: string };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { licenseKey, instanceId } = body;

  // Validate inputs
  if (!licenseKey || typeof licenseKey !== 'string') {
    throw error(400, 'licenseKey is required');
  }

  const normalized = licenseKey.toUpperCase().trim();

  if (!KEY_REGEX.test(normalized)) {
    return json({
      success: false,
      error: 'Invalid license key format.'
    }, { status: 422 });
  }

  try {
    // 1. Mock key handling bypasses real LemonSqueezy deactivation call
    if (normalized.startsWith('MOTIF-TEST-')) {
      return json({ success: true });
    }

    // 2. If instanceId is missing (e.g. localStorage cleared), we return success to allow local cleanup
    if (!instanceId || typeof instanceId !== 'string') {
      return json({ 
        success: true, 
        message: 'No instance ID found locally. Device reset completed.' 
      });
    }

    // 3. Call LemonSqueezy deactivation API for real keys
    const lsResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        license_key: normalized,
        instance_id: instanceId
      })
    });

    const lsData = await lsResponse.json();

    // If LemonSqueezy deactivation returns a failure but the instance is already gone
    // or key is inactive, we should still return success to let the client clean up.
    const isSuccess = lsResponse.ok || lsData.error === 'Instance not found' || lsData.deactivated === true;

    if (!isSuccess) {
      return json({
        success: false,
        error: lsData.error || 'Failed to deactivate license key on LemonSqueezy.'
      }, { status: 400 });
    }

    return json({ success: true });
  } catch (err) {
    console.error('License deactivation endpoint error:', err);
    return json({
      success: false,
      error: 'Communication with deactivation server failed. Please try again later.'
    }, { status: 500 });
  }
};
