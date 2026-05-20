import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';
import { db, type Capture } from '$lib/db';
import { settings, setAutoAiSearch } from '$lib/stores/settings';
import { nonTrashedCaptures } from '$lib/stores/captures';
import { showToast } from '$lib/stores/toast';

// ── State Stores ──

export const modelLoadingState = writable<'unloaded' | 'loading' | 'ready' | 'error'>('unloaded');
export const downloadProgress = writable<number>(0);
export const activeEmbeddingRuns = writable<Set<string>>(new Set());

// Backfill queue progress tracking
export const totalCapturesNeedingEmbedding = writable<number>(0);
export const embeddedSoFar = writable<number>(0);
export const isBackfilling = writable<boolean>(false);

// Derived backfill progress
export const backfillProgress = derived(
  [totalCapturesNeedingEmbedding, embeddedSoFar],
  ([$total, $done]) => {
    return {
      total: $total,
      done: $done,
      percent: $total > 0 ? Math.round(($done / $total) * 100) : 0
    };
  }
);

// ── Named Threshold ──
export const SEMANTIC_SIMILARITY_THRESHOLD = 0.35;
export const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

// ── Worker References ──
let worker: Worker | null = null;
const workerResolvers = new Map<string, (embedding: number[]) => void>();
let stopBackfillFlag = false;

// Initialize worker when settings indicate AI search is enabled
if (browser) {
  settings.subscribe((s) => {
    if (s.autoAiSearch && !worker && get(modelLoadingState) === 'unloaded') {
      initWorker();
    }
  });
}

export function initWorker(): void {
  if (!browser) return;
  modelLoadingState.set('loading');
  downloadProgress.set(0);

  try {
    // Standard Vite Worker dynamic instantiation
    worker = new Worker(new URL('../workers/semantic.worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.addEventListener('message', async (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === 'PROGRESS') {
        downloadProgress.set(Math.round(payload.progress));
      } else if (type === 'READY') {
        modelLoadingState.set('ready');
        downloadProgress.set(100);
        showToast('✓ AI Search model ready');
        // Trigger background indexer on completion
        void startBackfillQueue();
      } else if (type === 'EMBEDDING_RESULT') {
        const { captureId, embedding } = payload;
        const resolve = workerResolvers.get(captureId);
        if (resolve) {
          resolve(embedding);
          workerResolvers.delete(captureId);
        }
      } else if (type === 'ERROR') {
        modelLoadingState.set('error');
        showToast(`AI Search error: ${payload}`);
        console.error('Worker error:', payload);
      }
    });

    worker.postMessage({ type: 'LOAD_MODEL' });
  } catch (err: any) {
    modelLoadingState.set('error');
    console.error('Failed to initialize AI search worker:', err);
  }
}

// ── Embedding calculation ──

export function computeEmbedding(text: string, captureId: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('AI Search worker not initialized'));
      return;
    }
    workerResolvers.set(captureId, resolve);
    worker.postMessage({
      type: 'GET_EMBEDDING',
      payload: { text, captureId }
    });
  });
}

// ── Synchronous DJB2 Hash Utility ──

export function hashCode(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ── Rich Text extractor ──

export function getCaptureIndexText(c: Capture): string {
  const parts: string[] = [c.title];

  if (c.type === 'note') {
    try {
      const parsed = JSON.parse(c.content);
      parts.push(extractPlainTextFromTiptap(parsed));
    } catch {
      parts.push(c.content);
    }
  } else {
    parts.push(c.content);
  }

  if (c.ogTitle) parts.push(c.ogTitle);
  if (c.ocrText) parts.push(c.ocrText);
  if (c.tags && c.tags.length > 0) parts.push(c.tags.join(' '));

  return parts.filter(Boolean).join(' ').trim();
}

function extractPlainTextFromTiptap(node: any): string {
  const parts: string[] = [];
  if (!node) return '';
  if (node.text && typeof node.text === 'string') {
    parts.push(node.text);
  }
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      parts.push(extractPlainTextFromTiptap(child));
    }
  }
  return parts.join(' ');
}

// ── Background Queue Orchestration ──

export function cancelBackfill(): void {
  stopBackfillFlag = true;
  isBackfilling.set(false);
  showToast('AI indexing paused');
}

export async function startBackfillQueue(forceReindex = false): Promise<void> {
  if (get(modelLoadingState) !== 'ready') return;
  if (get(isBackfilling)) return;

  stopBackfillFlag = false;
  isBackfilling.set(true);

  try {
    const all = get(nonTrashedCaptures);
    const queue: Capture[] = [];

    for (const c of all) {
      const existing = await db.embeddings.get(c.id);
      const text = getCaptureIndexText(c);
      const textHash = hashCode(text);

      const needsEmbedding =
        forceReindex ||
        !existing ||
        existing.model !== MODEL_NAME ||
        existing.textHash !== textHash;

      if (needsEmbedding) {
        queue.push(c);
      }
    }

    if (queue.length === 0) {
      isBackfilling.set(false);
      return;
    }

    totalCapturesNeedingEmbedding.set(queue.length);
    embeddedSoFar.set(0);

    for (let i = 0; i < queue.length; i++) {
      if (stopBackfillFlag) break;

      const capture = queue[i];
      activeEmbeddingRuns.update((set) => {
        set.add(capture.id);
        return set;
      });

      try {
        const text = getCaptureIndexText(capture);
        const textHash = hashCode(text);

        const embedding = await computeEmbedding(text, capture.id);

        await db.embeddings.put({
          captureId: capture.id,
          embedding,
          model: MODEL_NAME,
          textHash,
          updatedAt: new Date().toISOString()
        });

        embeddedSoFar.update((n) => n + 1);
      } catch (err) {
        console.error(`Failed to index capture ${capture.id}:`, err);
      } finally {
        activeEmbeddingRuns.update((set) => {
          set.delete(capture.id);
          return set;
        });
      }
    }
  } catch (err) {
    console.error('AI indexing backfill failed:', err);
  } finally {
    isBackfilling.set(false);
    totalCapturesNeedingEmbedding.set(0);
    embeddedSoFar.set(0);
  }
}

// ── Single Capture update hook ──

export async function indexCaptureSingle(c: Capture, force = false): Promise<void> {
  if (get(modelLoadingState) !== 'ready') return;

  const text = getCaptureIndexText(c);
  const textHash = hashCode(text);

  const existing = await db.embeddings.get(c.id);
  if (!force && existing && existing.model === MODEL_NAME && existing.textHash === textHash) {
    return;
  }

  activeEmbeddingRuns.update((set) => {
    set.add(c.id);
    return set;
  });

  try {
    const embedding = await computeEmbedding(text, c.id);
    await db.embeddings.put({
      captureId: c.id,
      embedding,
      model: MODEL_NAME,
      textHash,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`Failed to index single capture ${c.id}:`, err);
  } finally {
    activeEmbeddingRuns.update((set) => {
      set.delete(c.id);
      return set;
    });
  }
}

// ── Semantic Similarity search ──

export interface SemanticSearchResult {
  id: string;
  score: number;
}

export async function semanticSearchQuery(query: string): Promise<SemanticSearchResult[]> {
  if (!query.trim()) return [];
  if (get(modelLoadingState) !== 'ready') return [];

  try {
    const queryId = `query-${Date.now()}`;
    const queryVector = await computeEmbedding(query, queryId);

    const allEmbeddings = await db.embeddings.toArray();
    const results: SemanticSearchResult[] = [];

    for (const item of allEmbeddings) {
      const similarity = cosineSimilarity(queryVector, item.embedding);
      if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
        results.push({ id: item.captureId, score: similarity });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  } catch (err) {
    console.error('Semantic search query execution failed:', err);
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
