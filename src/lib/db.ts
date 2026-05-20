import Dexie, { type EntityTable } from 'dexie';

// ────────────────────────────────────────────────
// Type Definitions
// ────────────────────────────────────────────────

export type CaptureType = 'link' | 'quote' | 'note' | 'image';
export type CaptureStatus = 'unread' | 'saved' | 'archived';

export interface Capture {
  id: string;
  type: CaptureType;
  status: CaptureStatus;
  title: string;
  content: string; // URL for links, quote text, Tiptap JSON for notes, blob ref for images
  ogImage: string | null;
  ogTitle: string | null;
  tags: string[];
  collectionId: string | null;
  isTrashed: boolean;
  trashedAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  ocrText: string | null;
  ocrStatus?: 'pending' | 'processing' | 'done' | 'failed' | 'skipped';
  ocrError?: string;
  ocrUpdatedAt?: string;
  sourceUrl: string | null;
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface AppSettings {
  key: string; // primary key — e.g. 'theme', 'pinHash', 'autoLockMinutes'
  value: string;
}

export interface CaptureEmbedding {
  captureId: string;
  embedding: number[];
  model: string;        // 'Xenova/all-MiniLM-L6-v2' — full ID required
  textHash: string;     // hash of the text that was embedded
  updatedAt: string;
}

// ────────────────────────────────────────────────
// Database Definition
// ────────────────────────────────────────────────

export class MotifDB extends Dexie {
  captures!: EntityTable<Capture, 'id'>;
  collections!: EntityTable<Collection, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  settings!: EntityTable<AppSettings, 'key'>;
  embeddings!: EntityTable<CaptureEmbedding, 'captureId'>;

  constructor() {
    super('motif');

    // Schema v1
    this.version(1).stores({
      captures: 'id, type, status, *tags, collectionId, isTrashed, createdAt, updatedAt',
      collections: 'id, name, createdAt',
      tags: 'id, name',
      settings: 'key'
    });

    // Schema v2 — added sourceUrl index for duplicate detection
    this.version(2).stores({
      captures: 'id, type, status, *tags, collectionId, isTrashed, createdAt, updatedAt, sourceUrl',
    });

    // Schema v3 — added embeddings table for Phase D Local AI Search
    this.version(3).stores({
      embeddings: 'captureId',
    });
  }
}

// Singleton instance
export const db = new MotifDB();

// ────────────────────────────────────────────────
// Helper: Generate ID
// ────────────────────────────────────────────────

export function generateId(): string {
  // Use crypto.randomUUID if available, fallback to timestamp + random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ────────────────────────────────────────────────
// Helper: ISO timestamp
// ────────────────────────────────────────────────

export function now(): string {
  return new Date().toISOString();
}
