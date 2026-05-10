import { unzip, strFromU8 } from 'fflate';
import { db, type Capture, type Collection, type Tag } from '$lib/db';
import { loadCaptures } from '$lib/stores/captures';
import { loadCollections } from '$lib/stores/collections';

export interface ImportAnalysis {
  envelope: any;
  images: Record<string, Uint8Array>;
  stats: {
    totalCaptures: number;
    totalCollections: number;
    totalTags: number;
    duplicateCaptures: number;
    newCaptures: number;
  };
}

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif'
};

export async function analyzeImport(file: File): Promise<ImportAnalysis> {
  return new Promise((resolve, reject) => {
    file.arrayBuffer().then(buffer => {
      unzip(new Uint8Array(buffer), async (err, unzipped) => {
        if (err) return reject(new Error('Failed to unzip file. It may be corrupted.'));

        try {
          const dataJsonU8 = unzipped['data.json'];
          if (!dataJsonU8) return reject(new Error('Invalid backup: data.json is missing.'));

        let envelope;
        try {
          envelope = JSON.parse(strFromU8(dataJsonU8));
        } catch (e) {
          return reject(new Error('Invalid backup: data.json is corrupted.'));
        }

        // Schema version check
        const currentVersion = 1;
        const backupVersion = parseInt(envelope.version, 10);
        if (isNaN(backupVersion) || backupVersion > currentVersion) {
          return reject(new Error('This backup was made with a newer version of Motif. Please update the app first.'));
        }

        // Extract images
        const images: Record<string, Uint8Array> = {};
        for (const [path, data] of Object.entries(unzipped)) {
          if (path.startsWith('images/') && data.length > 0) {
            const fileName = path.split('/')[1];
            images[fileName] = data;
          }
        }

        // Calculate overlap
        const existingKeys = new Set(await db.captures.toCollection().primaryKeys());
        let duplicates = 0;
        const incomingCaptures = envelope.captures || [];
        
        for (const c of incomingCaptures) {
          if (existingKeys.has(c.id)) {
            duplicates++;
          }
        }

          resolve({
            envelope,
            images,
            stats: {
              totalCaptures: incomingCaptures.length,
              totalCollections: (envelope.collections || []).length,
              totalTags: (envelope.tags || []).length,
              duplicateCaptures: duplicates,
              newCaptures: incomingCaptures.length - duplicates
            }
          });
        } catch (e: any) {
          reject(new Error(e.message || 'An unexpected error occurred during analysis.'));
        }
      });
    }).catch(reject);
  });
}

export async function executeImport(
  analysis: ImportAnalysis,
  strategy: 'merge' | 'replace'
): Promise<void> {
  const { envelope, images } = analysis;
  const captures: Capture[] = envelope.captures || [];
  const collections: Collection[] = envelope.collections || [];
  const tags: Tag[] = envelope.tags || [];

  // Reconstruct images
  for (const capture of captures) {
    if (capture.type === 'image' && (capture as any).imageFile) {
      const fileName = (capture as any).imageFile;
      const extMatch = fileName.match(/\.([^.]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : '';
      
      const mime = MIME_MAP[ext];
      if (!mime) {
        console.warn(`Skipping image reconstruction for ${capture.id}: unknown extension "${ext}"`);
        continue;
      }

      const u8 = images[fileName];
      if (u8) {
        capture.content = `data:${mime};base64,${u8ToBase64(u8)}`;
        delete (capture as any).imageFile;
      } else {
        console.warn(`Missing image binary for ${fileName}`);
      }
    }
  }

  // Database Transaction
  await db.transaction('rw', db.captures, db.collections, db.tags, async () => {
    // Tags and Collections are always upserted (they merge cleanly by ID)
    if (tags.length > 0) await db.tags.bulkPut(tags);
    if (collections.length > 0) await db.collections.bulkPut(collections);

    if (captures.length > 0) {
      if (strategy === 'replace') {
        // Upsert: Overwrites existing matching IDs, adds new ones.
        await db.captures.bulkPut(captures);
      } else {
        // Merge: Skip existing IDs
        const existingKeys = new Set(await db.captures.toCollection().primaryKeys());
        const newCaptures = captures.filter(c => !existingKeys.has(c.id));
        if (newCaptures.length > 0) {
          await db.captures.bulkAdd(newCaptures);
        }
      }
    }
  });

  // Reactive Reload
  await loadCollections();
  await loadCaptures();
}

function u8ToBase64(u8: Uint8Array): string {
  let binaryString = '';
  const len = u8.byteLength;
  for (let i = 0; i < len; i++) {
    binaryString += String.fromCharCode(u8[i]);
  }
  return window.btoa(binaryString);
}
