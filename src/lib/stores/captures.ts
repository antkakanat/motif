// ────────────────────────────────────────────────
// Captures Store — CRUD, soft delete, restore, auto-purge
// ────────────────────────────────────────────────

import { writable, derived, get } from 'svelte/store';
import { db, generateId, now, type Capture, type CaptureType, type CaptureStatus } from '$lib/db';
import { rebuildSearchIndex } from '$lib/search';
import { isOnboardingDone, completeOnboarding } from '$lib/onboarding';

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
    captures.set(all);
    rebuildSearchIndex(all);
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
  ogImage?: string;
  ogTitle?: string;
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
    tags: input.tags ?? [],
    collectionId: input.collectionId ?? null,
    isTrashed: false,
    trashedAt: null,
    createdAt: now(),
    updatedAt: now(),
    ocrText: null,
    sourceUrl: input.sourceUrl ?? null
  };

  await db.captures.add(capture);

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

  // Save first, enrich in background.
  if (capture.type === 'link' && !capture.ogTitle && !capture.ogImage) {
    void fetchMetadata(capture.id, capture.content);
  }

  return capture;
}

// ── Update ──

export async function updateCapture(id: string, changes: Partial<Capture>): Promise<void> {
  const updates = { ...changes, updatedAt: now() };
  await db.captures.update(id, updates);

  captures.update((list) =>
    list.map((c) => (c.id === id ? { ...c, ...updates } : c))
  );
  rebuildSearchIndex(get(captures));
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
}

// ── Permanent Delete ──

export async function permanentDeleteCapture(id: string): Promise<void> {
  await db.captures.delete(id);
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

async function fetchMetadata(id: string, url: string) {
  try {
    const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
    if (!res.ok) return;

    const data = await res.json();
    const current = get(captures).find((capture) => capture.id === id);
    if (!current) return;

    const updates: Partial<Capture> = {};
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const image = typeof data.image === 'string' ? data.image.trim() : '';
    const description = typeof data.description === 'string' ? data.description.trim() : '';

    if (title) updates.ogTitle = title;
    if (image) updates.ogImage = image;

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
  await db.transaction('rw', db.captures, db.tags, async () => {
    const items = await db.captures.where('id').anyOf(ids).toArray();
    
    for (const item of items) {
      let tags: string[];
      if (additive) {
        tags = [...new Set([...item.tags, ...newTags])];
      } else {
        tags = [...new Set(newTags)];
      }
      
      await db.captures.update(item.id, { tags, updatedAt: t });
      
      // Ensure tags exist
      for (const tag of newTags) {
        await ensureTag(tag);
      }
    }
  });

  await loadCaptures(); // Easiest way to sync complex tag updates
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
