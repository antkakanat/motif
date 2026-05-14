import { writable, get } from 'svelte/store';

export const selectedIds = writable<Set<string>>(new Set());
export const lastSelectedId = writable<string | null>(null);
export const selectionMode = writable<'browse' | 'selection'>('browse');

export const isSelectionActive = writable(false);

selectedIds.subscribe(ids => {
  const active = ids.size > 0;
  isSelectionActive.set(active);
  if (!active) {
    selectionMode.set('browse');
  }
});

export function enterSelectionMode() {
  selectionMode.set('selection');
}

export function exitSelectionMode() {
  selectionMode.set('browse');
  selectedIds.set(new Set());
  lastSelectedId.set(null);
}

export function toggleSelection(id: string, opts?: { enterMode?: boolean }) {
  if (opts?.enterMode !== false) {
    enterSelectionMode();
  }

  selectedIds.update(ids => {
    const newIds = new Set(ids);
    if (newIds.has(id)) {
      newIds.delete(id);
    } else {
      newIds.add(id);
      lastSelectedId.set(id);
    }
    return newIds;
  });
}

export function rangeSelect(id: string, allVisibleIds: string[]) {
  enterSelectionMode();
  const lastId = get(lastSelectedId);
  if (!lastId) {
    // First shift-click behaves like a normal select and sets the anchor.
    selectedIds.set(new Set([id]));
    lastSelectedId.set(id);
    return;
  }

  const startIdx = allVisibleIds.indexOf(lastId);
  const endIdx = allVisibleIds.indexOf(id);

  if (startIdx === -1 || endIdx === -1) {
    selectedIds.set(new Set([id]));
    lastSelectedId.set(id);
    return;
  }

  const min = Math.min(startIdx, endIdx);
  const max = Math.max(startIdx, endIdx);
  const toAdd = allVisibleIds.slice(min, max + 1);

  selectedIds.update(ids => {
    const newIds = new Set(ids);
    toAdd.forEach(item => newIds.add(item));
    return newIds;
  });
  
  lastSelectedId.set(id);
}

export function selectAll(ids: string[]) {
  enterSelectionMode();
  selectedIds.set(new Set(ids));
  if (ids.length > 0) {
    lastSelectedId.set(ids[ids.length - 1]);
  }
}

export function clearSelection() {
  exitSelectionMode();
}
