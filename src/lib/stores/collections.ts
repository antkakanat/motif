// ────────────────────────────────────────────────
// Collections Store — CRUD & Transactional Deletion
// ────────────────────────────────────────────────

import { writable, get } from 'svelte/store';
import { db, generateId, now, type Collection } from '$lib/db';

export const collections = writable<Collection[]>([]);
export const isCollectionsLoading = writable(true);

// ── Load from DB ──

export async function loadCollections() {
  isCollectionsLoading.set(true);
  try {
    const all = await db.collections.toArray();
    collections.set(all.sort((a, b) => a.name.localeCompare(b.name)));
  } finally {
    isCollectionsLoading.set(false);
  }
}

// ── Create ──

export async function addCollection(name: string): Promise<Collection> {
  const collection: Collection = {
    id: generateId(),
    name: name.trim(),
    color: getRandomColor(),
    createdAt: now(),
    updatedAt: now()
  };

  await db.collections.add(collection);
  collections.update((list) => [...list, collection].sort((a, b) => a.name.localeCompare(b.name)));

  return collection;
}

// ── Update ──

export async function updateCollection(id: string, changes: Partial<Collection>): Promise<void> {
  const updates = { ...changes, updatedAt: now() };
  await db.collections.update(id, updates);

  collections.update((list) =>
    list.map((c) => (c.id === id ? { ...c, ...updates } : c)).sort((a, b) => a.name.localeCompare(b.name))
  );
}

// ── Delete (Transactional) ──

export async function deleteCollection(id: string): Promise<void> {
  // Use a Dexie transaction to ensure atomicity
  // 1. Delete the collection
  // 2. Set collectionId to null for all associated captures
  await db.transaction('rw', db.collections, db.captures, async () => {
    await db.collections.delete(id);
    await db.captures.where('collectionId').equals(id).modify({ collectionId: null });
  });

  collections.update((list) => list.filter((c) => c.id !== id));
}

// ── Helpers ──

function getRandomColor(): string {
  const colors = [
    '#5B4ED6', // Motif Primary
    '#E91E63', // Pink
    '#9C27B0', // Purple
    '#2196F3', // Blue
    '#00BCD4', // Cyan
    '#4CAF50', // Green
    '#FFC107', // Amber
    '#FF5722'  // Deep Orange
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
