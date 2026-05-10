// ────────────────────────────────────────────────
// Search — MiniSearch fuzzy full-text
// ────────────────────────────────────────────────

import MiniSearch from 'minisearch';
import type { Capture } from '$lib/db';

let miniSearch: MiniSearch<Capture>;

function createIndex(): MiniSearch<Capture> {
  return new MiniSearch<Capture>({
    fields: ['title', 'content', 'ogTitle', 'ocrText'],
    storeFields: ['id'],
    searchOptions: {
      fuzzy: 0.2,
      prefix: true,
      boost: {
        title: 3,
        ogTitle: 2,
        content: 1,
        ocrText: 1
      }
    },
    // Extract tags as additional searchable text
    extractField: (doc, fieldName) => {
      if (fieldName === 'content' && doc.type === 'note') {
        // For notes, strip Tiptap JSON to plain text for searching
        try {
          const parsed = JSON.parse(doc.content);
          return extractTextFromTiptap(parsed);
        } catch {
          return doc.content;
        }
      }
      const value = doc[fieldName as keyof Capture];
      if (Array.isArray(value)) return value.join(' ');
      return value ?? '';
    }
  });
}

// Initialize
miniSearch = createIndex();

// ── Rebuild from full capture list ──

export function rebuildSearchIndex(captures: Capture[]): void {
  miniSearch = createIndex();
  const searchable = captures.filter((c) => !c.isTrashed);
  miniSearch.addAll(searchable);
}

// ── Search ──

export interface SearchResult {
  id: string;
  score: number;
}

export function search(query: string): SearchResult[] {
  if (!query.trim()) return [];
  return miniSearch.search(query).map((r) => ({
    id: r.id as string,
    score: r.score
  }));
}

// ── Suggest (autocomplete) ──

export function suggest(query: string): string[] {
  if (!query.trim()) return [];
  return miniSearch.autoSuggest(query, { fuzzy: 0.2 }).map((s) => s.suggestion);
}

// ── Extract plain text from Tiptap JSON ──

function extractTextFromTiptap(node: Record<string, unknown>): string {
  const parts: string[] = [];

  if (node.text && typeof node.text === 'string') {
    parts.push(node.text);
  }

  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      parts.push(extractTextFromTiptap(child as Record<string, unknown>));
    }
  }

  return parts.join(' ');
}
