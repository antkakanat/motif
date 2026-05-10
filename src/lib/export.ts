import { zip, strToU8 } from 'fflate';
import { db } from '$lib/db';
import { markBackupDone } from '$lib/stores/settings';

export type ExportScope = 'all' | 'view' | 'selection';

export async function exportData(scope: ExportScope, targetIds?: string[]): Promise<void> {
  try {
    // 1. Fetch requested captures
    let captures;
    if (scope === 'all') {
      captures = await db.captures.toArray();
    } else if (targetIds && targetIds.length > 0) {
      captures = await db.captures.where('id').anyOf(targetIds).toArray();
    } else {
      console.warn('Export triggered with selection/view scope but no IDs provided.');
      return;
    }

    // 2. Fetch metadata (always full for integrity)
    const collections = await db.collections.toArray();
    const tags = await db.tags.toArray();

    // 3. Prepare ZIP structure
    const files: Record<string, Uint8Array> = {};
    const imageCaptures = captures.filter(c => c.type === 'image' && c.content.startsWith('data:image'));
    
    // Process images
    for (const capture of imageCaptures) {
      try {
        const parts = capture.content.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const extension = mimeType.split('/')[1] || 'jpg';
        const base64 = parts[1];
        
        const fileName = `${capture.id}.${extension}`;
        files[`images/${fileName}`] = base64ToU8(base64);
        
        // Update capture object to reference file
        (capture as any).imageFile = fileName;
        capture.content = ''; // Clear heavy base64
      } catch (err) {
        console.error(`Failed to extract image for capture ${capture.id}:`, err);
      }
    }

    // 4. Create data.json
    const envelope = {
      version: '1',
      app: 'motif',
      exportedAt: new Date().toISOString(),
      exportScope: scope,
      captureCount: captures.length,
      captures,
      collections,
      tags
    };

    files['data.json'] = strToU8(JSON.stringify(envelope, null, 2));

    // 5. Generate ZIP
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `motif-backup-${timestamp}.zip`;

    return new Promise((resolve, reject) => {
      zip(files, (err, data) => {
        if (err) {
          console.error('Failed to create ZIP', err);
          return reject(err);
        }
        
        downloadBlob(data, fileName);
        
        // Update backup reminder setting
        markBackupDone();
        resolve();
      });
    });
  } catch (err) {
    console.error('Export failed:', err);
  }
}

function base64ToU8(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function downloadBlob(data: Uint8Array, fileName: string) {
  const blob = new Blob([data as any], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
