// ────────────────────────────────────────────────
// Storage — IndexedDB usage estimate
// ────────────────────────────────────────────────

export interface StorageEstimate {
  usedBytes: number;
  quotaBytes: number;
  usedFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
}

export async function getStorageEstimate(): Promise<StorageEstimate> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return {
      usedBytes: 0,
      quotaBytes: 0,
      usedFormatted: 'Unknown',
      quotaFormatted: 'Unknown',
      percentUsed: 0
    };
  }

  const estimate = await navigator.storage.estimate();
  const used = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;

  return {
    usedBytes: used,
    quotaBytes: quota,
    usedFormatted: formatBytes(used),
    quotaFormatted: formatBytes(quota),
    percentUsed: quota > 0 ? Math.round((used / quota) * 10000) / 100 : 0
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
