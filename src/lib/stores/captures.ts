// ────────────────────────────────────────────────
// Captures Store — CRUD, soft delete, restore, auto-purge
// ────────────────────────────────────────────────

import { writable, derived, get } from 'svelte/store';
import { db, generateId, now, type Capture, type CaptureType, type CaptureStatus } from '$lib/db';
import { rebuildSearchIndex } from '$lib/search';
import { isOnboardingDone, completeOnboarding } from '$lib/onboarding';
import { isProUnlocked } from '$lib/pro';
import { settings } from '$lib/stores/settings';
import { activeOcrRuns } from '$lib/ocr';
import { showToast } from '$lib/stores/toast';
import { indexCaptureSingle } from '$lib/stores/semanticSearch';
import { fetchLinkMetadata } from '$lib/metadata';
import {
  sessionKey,
  isLocked,
  encryptCapture,
  decryptCapturesList,
  encryptText
} from '$lib/encryption';

// ── Reactive store ──

export const captures = writable<Capture[]>([]);
export const isLoading = writable(true);

// ── Derived stores for filtered views ──

export const nonTrashedCaptures = derived(captures, ($captures) =>
  $captures.filter((c) => !c.isTrashed).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
);

export const activeCaptures = derived(nonTrashedCaptures, ($captures) =>
  $captures.filter((c) => c.status !== 'archived')
);

export const archivedCaptures = derived(nonTrashedCaptures, ($captures) =>
  $captures.filter((c) => c.status === 'archived')
);

export const trashedCaptures = derived(captures, ($captures) =>
  $captures.filter((c) => c.isTrashed).sort((a, b) => (b.trashedAt ?? '').localeCompare(a.trashedAt ?? ''))
);

export function capturesByType(type: CaptureType) {
  return derived(activeCaptures, ($active) => $active.filter((c) => c.type === type));
}

export function capturesByStatus(status: CaptureStatus) {
  return derived(nonTrashedCaptures, ($active) => $active.filter((c) => c.status === status));
}

export function capturesByTag(tag: string) {
  return derived(activeCaptures, ($active) => $active.filter((c) => c.tags.includes(tag)));
}

// ── Load from DB ──

export async function loadCaptures() {
  isLoading.set(true);
  try {
    const all = await db.captures.toArray();
    const settingsState = get(settings);

    if (settingsState.dbEncrypted) {
      const key = get(sessionKey);
      if (!key) {
        // App database is encrypted but locked!
        isLocked.set(true);
        captures.set([]);
        rebuildSearchIndex([]);
      } else {
        // Decrypt on the fly into RAM
        const decrypted = await decryptCapturesList(all, key);
        captures.set(decrypted);
        rebuildSearchIndex(decrypted);
        isLocked.set(false);
      }
    } else {
      captures.set(all);
      rebuildSearchIndex(all);
      isLocked.set(false);
    }
  } catch (err) {
    console.error('Failed to load captures:', err);
  } finally {
    isLoading.set(false);
  }
}

// ── Create ──

export interface CreateCaptureInput {
  type: CaptureType;
  title: string;
  content: string;
  tags?: string[];
  sourceUrl?: string;
  ogImage?: string | null;
  ogTitle?: string | null;
  favicon?: string | null;
  description?: string | null;
  reminderAt?: string | null;
  status?: CaptureStatus;
  collectionId?: string | null;
}

export async function addCapture(input: CreateCaptureInput): Promise<Capture> {
  const capture: Capture = {
    id: generateId(),
    type: input.type,
    status: input.status ?? 'unread',
    title: input.title,
    content: input.content,
    ogImage: input.ogImage ?? null,
    ogTitle: input.ogTitle ?? null,
    favicon: input.favicon ?? null,
    description: input.description ?? null,
    tags: input.tags ?? [],
    collectionId: input.collectionId ?? null,
    isTrashed: false,
    trashedAt: null,
    createdAt: now(),
    updatedAt: now(),
    ocrText: null,
    ocrStatus: input.type === 'image' ? 'pending' : undefined,
    sourceUrl: input.sourceUrl ?? null,
    reminderAt: input.reminderAt ?? null,
    reminderDone: false
  };

  // Encrypt record if database is encrypted
  let dbRecord = { ...capture };
  if (get(settings).dbEncrypted) {
    const key = get(sessionKey);
    if (key) {
      dbRecord = await encryptCapture(capture, key);
    }
  }
  await db.captures.add(dbRecord);

  // Ensure tags exist in tags table
  for (const tagName of capture.tags) {
    await ensureTag(tagName);
  }

  captures.update((list) => [...list, capture]);
  rebuildSearchIndex(get(captures));

  // Dismiss onboarding permanently on first real capture
  if (!isOnboardingDone()) {
    await completeOnboarding();
  }

  // Save first, enrich in background (respects autoFetchMetadata privacy setting).
  if (capture.type === 'link' && get(settings).autoFetchMetadata) {
    void fetchMetadataForCapture(capture.id, capture.content);
  }

  // Trigger OCR in background for images
  if (capture.type === 'image') {
    void runOcrOnCapture(capture.id, capture.content);
  }

  // Trigger Semantic Search indexing if enabled
  if (get(settings).autoAiSearch) {
    void indexCaptureSingle(capture);
  }

  return capture;
}

// ── Update ──

export async function updateCapture(id: string, changes: Partial<Capture>): Promise<void> {
  const updates = { ...changes, updatedAt: now() };
  
  let dbUpdates: Partial<Capture> = { ...updates };
  if (get(settings).dbEncrypted) {
    const key = get(sessionKey);
    if (key) {
      const encryptedUpdates: Partial<Capture> = { ...updates };
      if (updates.title) encryptedUpdates.title = 'enc:' + await encryptText(updates.title, key);
      if (updates.content) encryptedUpdates.content = 'enc:' + await encryptText(updates.content, key);
      if (updates.ocrText) encryptedUpdates.ocrText = 'enc:' + await encryptText(updates.ocrText, key);
      if (updates.tags) {
        const serializedTags = JSON.stringify(updates.tags);
        encryptedUpdates.tags = ['enc_json:' + await encryptText(serializedTags, key)];
      }
      dbUpdates = encryptedUpdates;
    }
  }
  await db.captures.update(id, dbUpdates);

  captures.update((list) =>
    list.map((c) => (c.id === id ? { ...c, ...updates } : c))
  );
  rebuildSearchIndex(get(captures));

  // Rerun OCR if the image content itself is updated
  if (changes.content) {
    const updated = get(captures).find((c) => c.id === id);
    if (updated && updated.type === 'image') {
      void runOcrOnCapture(id, changes.content, true); // Force rerun on direct updates
    }
  }

  // Re-index for semantic search if AI search is active
  if (get(settings).autoAiSearch) {
    const updated = get(captures).find((c) => c.id === id);
    if (updated) {
      void indexCaptureSingle(updated);
    }
  }
}

// ── Run OCR ──

export async function runOcrOnCapture(id: string, imageSrc: string, force = false): Promise<void> {
  const isPro = isProUnlocked();
  const autoOcrEnabled = get(settings).autoOcr;

  if (!isPro) {
    await updateCapture(id, { ocrStatus: 'skipped' });
    return;
  }

  if (!autoOcrEnabled && !force) {
    await updateCapture(id, { ocrStatus: 'skipped' });
    return;
  }

  // Update in-memory set for loading animation
  activeOcrRuns.update((set) => {
    const next = new Set(set);
    next.add(id);
    return next;
  });

  // Mark as processing in IndexedDB
  await updateCapture(id, { ocrStatus: 'processing', ocrError: undefined });

  try {
    const { performOCR } = await import('$lib/ocr');
    const text = await performOCR(imageSrc);

    await updateCapture(id, {
      ocrText: text || null,
      ocrStatus: 'done',
      ocrUpdatedAt: now(),
      ocrError: undefined
    });

    if (text && text.trim()) {
      showToast('Text successfully extracted from image!');
    }
  } catch (err: any) {
    console.error('Failed to run OCR on capture:', err);
    await updateCapture(id, {
      ocrStatus: 'failed',
      ocrError: err?.message || String(err)
    });
    showToast('Image text extraction failed.');
  } finally {
    activeOcrRuns.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }
}

// ── Soft Delete (Trash) ──

export async function softDeleteCapture(id: string): Promise<void> {
  const updates = { isTrashed: true, trashedAt: now(), updatedAt: now() };
  await db.captures.update(id, updates);
  captures.update((list) =>
    list.map((c) => (c.id === id ? { ...c, ...updates } : c))
  );
}

// ── Restore from Trash ──

export async function restoreCapture(id: string): Promise<void> {
  const updates = { isTrashed: false, trashedAt: null, updatedAt: now() };
  await db.captures.update(id, updates);
  captures.update((list) =>
    list.map((c) => (c.id === id ? { ...c, ...updates } : c))
  );

  if (get(settings).autoAiSearch) {
    const updated = get(captures).find((c) => c.id === id);
    if (updated) {
      void indexCaptureSingle(updated);
    }
  }
}

// ── Permanent Delete ──

export async function permanentDeleteCapture(id: string): Promise<void> {
  await db.captures.delete(id);
  await db.embeddings.delete(id);
  captures.update((list) => list.filter((c) => c.id !== id));
  rebuildSearchIndex(get(captures));
}

// ── Auto-purge Trash (30 days) ──

export async function purgeOldTrash(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const stale = await db.captures
    .where('isTrashed')
    .equals(1) // Dexie stores booleans as 0/1 in IndexedDB
    .filter((c) => c.trashedAt !== null && c.trashedAt < thirtyDaysAgo)
    .toArray();

  if (stale.length === 0) return 0;

  const ids = stale.map((c) => c.id);
  await db.captures.bulkDelete(ids);
  await db.embeddings.bulkDelete(ids);
  captures.update((list) => list.filter((c) => !ids.includes(c.id)));
  rebuildSearchIndex(get(captures));
  return ids.length;
}

// ── Duplicate URL Detection ──

export async function findDuplicateUrl(url: string): Promise<Capture | undefined> {
  const normalized = normalizeUrl(url);
  
  // Only deduplicate links. Quotes, notes, and images allow duplicates.
  // We check both content (where links store their URL) and sourceUrl.
  const all = await db.captures
    .where('type')
    .equals('link')
    .filter(c => !c.isTrashed)
    .toArray();

  return all.find(c => 
    normalizeUrl(c.content) === normalized || 
    (c.sourceUrl && normalizeUrl(c.sourceUrl) === normalized)
  );
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slash, lowercase hostname
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, '')}${u.search}`;
  } catch {
    return url.toLowerCase().trim();
  }
}

// ── Tag helper ──

async function ensureTag(name: string): Promise<void> {
  const existing = await db.tags.where('name').equals(name).first();
  if (!existing) {
    await db.tags.add({
      id: generateId(),
      name,
      createdAt: now()
    });
  }
}

// ── Get all tags ──

export async function getAllTags(): Promise<string[]> {
  const tags = await db.tags.toArray();
  return tags.map((t) => t.name).sort();
}

// ── Metadata fetching ──

const COMMON_TAG_THRESHOLD = 5;
const AUTO_TAG_LIMIT = 4;
const TAG_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'under', 'your',
  'you', 'our', 'their', 'about', 'after', 'before', 'while', 'when', 'where', 'which',
  'have', 'has', 'had', 'are', 'was', 'were', 'will', 'would', 'could', 'should',
  'not', 'but', 'all', 'any', 'can', 'more', 'less', 'new', 'news', 'update', 'updates',
  'site', 'blog', 'home', 'page', 'www', 'http', 'https', 'html', 'php', 'com', 'org',
  'net', 'dev', 'app', 'co', 'io'
]);
const DOMAIN_NOISE = new Set(['www', 'com', 'org', 'net', 'dev', 'app', 'co', 'io', 'ph']);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token));
}

function getDomainTokens(url: string): Set<string> {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const tokens = tokenize(hostname.replace(/\./g, ' '));
    return new Set(tokens.filter((token) => !DOMAIN_NOISE.has(token)));
  } catch {
    return new Set<string>();
  }
}

function looksLikeUrl(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (!value) return false;
  if (/^https?:\/\//.test(value)) return true;
  return /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/.test(value);
}

function normalizeUrlLike(text: string): string {
  try {
    const u = new URL(text);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, '')}${u.search}`;
  } catch {
    return text.trim().toLowerCase().replace(/\/$/, '');
  }
}

function shouldAutoReplaceTitle(existingTitle: string, url: string): boolean {
  const current = existingTitle.trim();
  if (!current) return true;

  const lower = current.toLowerCase();
  if (lower === 'untitled') return true;
  if (looksLikeUrl(current)) return true;
  if (normalizeUrlLike(current) === normalizeUrlLike(url)) return true;

  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (lower === host) return true;
  } catch {
    // Ignore parse errors.
  }

  return false;
}

function getTagFrequencyMap(allCaptures: Capture[]): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const item of allCaptures) {
    const unique = new Set(item.tags.map((tag) => tag.toLowerCase()));
    for (const tag of unique) {
      frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
    }
  }
  return frequency;
}

function suggestAutoTags(params: {
  title: string;
  description?: string | null;
  url: string;
  allCaptures: Capture[];
  existingTags: string[];
}): string[] {
  const titleTokens = new Set(tokenize(params.title));
  const descriptionTokens = new Set(tokenize(params.description ?? ''));
  const domainTokens = getDomainTokens(params.url);
  const existing = new Set(params.existingTags.map((tag) => tag.toLowerCase()));
  const frequency = getTagFrequencyMap(params.allCaptures);
  const scores = new Map<string, number>();

  const addScore = (token: string, score: number) => {
    if (TAG_STOPWORDS.has(token)) return;
    if (existing.has(token)) return;
    if ((frequency.get(token) ?? 0) >= COMMON_TAG_THRESHOLD) return;
    scores.set(token, (scores.get(token) ?? 0) + score);
  };

  for (const token of titleTokens) addScore(token, 3);
  for (const token of descriptionTokens) addScore(token, 2);
  for (const token of domainTokens) {
    // Skip pure site tokens unless they also exist in title/description.
    if (!titleTokens.has(token) && !descriptionTokens.has(token)) continue;
    addScore(token, 1);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, AUTO_TAG_LIMIT)
    .map(([token]) => token);
}

async function fetchMetadataForCapture(id: string, url: string) {
  try {
    const data = await fetchLinkMetadata(url);
    const current = get(captures).find((capture) => capture.id === id);
    if (!current) return;

    const updates: Partial<Capture> = {};
    const title = data.title?.trim() ?? '';
    const description = data.description?.trim() ?? '';

    if (title) updates.ogTitle = title;
    if (data.ogImage) updates.ogImage = data.ogImage;
    if (data.favicon) updates.favicon = data.favicon;
    if (description) updates.description = description;

    if (title && shouldAutoReplaceTitle(current.title, url)) {
      updates.title = title;
    }

    if (current.tags.length === 0) {
      const autoTags = suggestAutoTags({
        title: title || current.title,
        description,
        url,
        allCaptures: get(captures),
        existingTags: current.tags
      });
      if (autoTags.length > 0) {
        updates.tags = autoTags;
        for (const tag of autoTags) {
          await ensureTag(tag);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateCapture(id, updates);
    }
  } catch (err) {
    console.error('Failed to fetch metadata:', err);
  }
}

// ── Bulk Actions ──

export async function bulkSoftDelete(ids: string[]): Promise<void> {
  const t = now();
  await db.transaction('rw', db.captures, async () => {
    await db.captures.where('id').anyOf(ids).modify({ 
      isTrashed: true, 
      trashedAt: t, 
      updatedAt: t 
    });
  });

  captures.update((list) =>
    list.map((c) => ids.includes(c.id) ? { ...c, isTrashed: true, trashedAt: t, updatedAt: t } : c)
  );
}

export async function bulkUpdateTags(ids: string[], newTags: string[], additive = true): Promise<void> {
  const t = now();
  const allCaptures = get(captures);
  const key = get(sessionKey);
  const isEncrypted = get(settings).dbEncrypted;

  await db.transaction('rw', db.captures, db.tags, async () => {
    for (const id of ids) {
      const item = allCaptures.find(c => c.id === id);
      if (!item) continue;

      let tags: string[];
      if (additive) {
        tags = [...new Set([...item.tags, ...newTags])];
      } else {
        tags = [...new Set(newTags)];
      }

      let dbTags = tags;
      if (isEncrypted && key) {
        const serializedTags = JSON.stringify(tags);
        dbTags = ['enc_json:' + await encryptText(serializedTags, key)];
      }

      await db.captures.update(id, { tags: dbTags, updatedAt: t });

      // Ensure tags exist
      for (const tag of newTags) {
        await ensureTag(tag);
      }
    }
  });

  // Apply updates to the Svelte memory store
  captures.update((list) =>
    list.map((c) => {
      if (ids.includes(c.id)) {
        const tags = additive ? [...new Set([...c.tags, ...newTags])] : [...new Set(newTags)];
        return { ...c, tags, updatedAt: t };
      }
      return c;
    })
  );
  
  rebuildSearchIndex(get(captures));
}

export async function bulkMoveToCollection(ids: string[], collectionId: string | null): Promise<void> {
  const t = now();
  await db.transaction('rw', db.captures, async () => {
    await db.captures.where('id').anyOf(ids).modify({ 
      collectionId, 
      updatedAt: t 
    });
  });

  captures.update((list) =>
    list.map((c) => ids.includes(c.id) ? { ...c, collectionId, updatedAt: t } : c)
  );
}
