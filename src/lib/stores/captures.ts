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

export const activeCaptures = derived(captures, ($captures) =>
  $captures.filter((c) => !c.isTrashed).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
);

export const trashedCaptures = derived(captures, ($captures) =>
  $captures.filter((c) => c.isTrashed).sort((a, b) => (b.trashedAt ?? '').localeCompare(a.trashedAt ?? ''))
);

export function capturesByType(type: CaptureType) {
  return derived(activeCaptures, ($active) => $active.filter((c) => c.type === type));
}

export function capturesByStatus(status: CaptureStatus) {
  return derived(activeCaptures, ($active) => $active.filter((c) => c.status === status));
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
    collectionId: null,
    isTrashed: false,
    trashedAt: null,
    createdAt: now(),
    updatedAt: now(),
    ocrText: null,
    sourceUrl: input.sourceUrl ?? null
  };

  // Auto-fetch metadata for links if missing
  if (capture.type === 'link' && !capture.ogTitle && !capture.ogImage) {
    void fetchMetadata(capture.id, capture.content);
  }

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
  const all = get(captures);
  return all.find(
    (c) => c.type === 'link' && !c.isTrashed && normalizeUrl(c.content) === normalized
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

async function fetchMetadata(id: string, url: string) {
  try {
    const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
    if (!res.ok) return;
    const data = await res.json();
    
    if (data.title || data.image) {
      await updateCapture(id, {
        ogTitle: data.title,
        ogImage: data.image,
        // If the user didn't provide a title, use the fetched one
        title: get(captures).find(c => c.id === id)?.title === url ? (data.title || url) : undefined
      });
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
