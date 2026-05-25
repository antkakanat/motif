import { unzip, strFromU8 } from 'fflate';
import { db, generateId, now, type Capture, type Collection, type Tag } from '$lib/db';
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

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let hostname = u.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    let pathname = u.pathname;
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${hostname}${pathname}${u.search}`;
  } catch {
    return url.toLowerCase().trim().replace(/\/$/, '');
  }
}

export async function analyzePocketImport(file: File): Promise<ImportAnalysis> {
  const htmlText = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  const uls = doc.querySelectorAll('ul');
  if (uls.length === 0) {
    throw new Error('Invalid file format. No link lists found in the HTML.');
  }

  // Load existing links for deduplication
  const existingLinks = await db.captures.where('type').equals('link').toArray();
  const existingNormalized = new Set(existingLinks.map(c => normalizeUrl(c.content)));

  const incomingCaptures: Capture[] = [];
  const incomingNormalized = new Set<string>();
  let duplicates = 0;
  const tagSet = new Set<string>();

  for (const ul of uls) {
    let prev = ul.previousElementSibling;
    while (prev && !['H1', 'H2', 'H3', 'H4'].includes(prev.tagName)) {
      prev = prev.previousElementSibling;
    }
    const headingTextClean = prev ? prev.textContent?.trim().toLowerCase() : '';
    const isArchived = (headingTextClean.includes('archive') || headingTextClean.includes('read')) && !headingTextClean.includes('unread');
    const status = isArchived ? 'archived' : 'unread'; // 'unread' maps to Inbox/Unread

    const links = ul.querySelectorAll('a');
    for (const a of links) {
      const href = a.getAttribute('href');
      if (!href) continue;

      const norm = normalizeUrl(href);
      if (existingNormalized.has(norm) || incomingNormalized.has(norm)) {
        duplicates++;
        continue;
      }

      incomingNormalized.add(norm);

      const timeAddedAttr = a.getAttribute('time_added');
      let createdAt = now();
      if (timeAddedAttr) {
        const secs = parseInt(timeAddedAttr, 10);
        if (!isNaN(secs)) {
          createdAt = new Date(secs * 1000).toISOString();
        }
      }

      const tagsAttr = a.getAttribute('tags');
      const tags = tagsAttr ? tagsAttr.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0) : [];
      for (const t of tags) tagSet.add(t);

      const capture: Capture = {
        id: generateId(),
        type: 'link',
        status: status as any,
        title: a.textContent?.trim() || 'Untitled Link',
        content: href,
        ogImage: null,
        ogTitle: null,
        favicon: null,
        description: null,
        tags: tags,
        collectionId: null,
        isTrashed: false,
        trashedAt: null,
        createdAt: createdAt,
        updatedAt: createdAt,
        ocrText: null,
        sourceUrl: null,
        reminderAt: null,
        reminderDone: false,
        archiveStatus: 'none'
      };

      incomingCaptures.push(capture);
    }
  }

  // Create Tag entities
  const incomingTags: Tag[] = Array.from(tagSet).map(name => ({
    id: generateId(),
    name,
    createdAt: now()
  }));

  const envelope = {
    version: '1',
    captures: incomingCaptures,
    collections: [],
    tags: incomingTags,
    isPocketImport: true
  };

  return {
    envelope,
    images: {},
    stats: {
      totalCaptures: incomingCaptures.length + duplicates,
      totalCollections: 0,
      totalTags: incomingTags.length,
      duplicateCaptures: duplicates,
      newCaptures: incomingCaptures.length
    }
  };
}

export async function analyzeImport(file: File): Promise<ImportAnalysis> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return analyzePocketImport(file);
  }

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
  await db.transaction('rw', db.captures, db.collections, db.tags, db.settings, async () => {
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

    if (envelope.isPocketImport) {
      // Initialize libraryStartedAt to prevent immediate backup prompt only if not already set
      const existing = await db.settings.get('libraryStartedAt');
      if (!existing) {
        await db.settings.put({ key: 'libraryStartedAt', value: now() });
      }
    }
  });

  // Reactive Reload
  const { loadSettings } = await import('$lib/stores/settings');
  await loadSettings();
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
