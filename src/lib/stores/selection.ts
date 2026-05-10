import { writable, get } from 'svelte/store';

export const selectedIds = writable<Set<string>>(new Set());
export const lastSelectedId = writable<string | null>(null);

export const isSelectionActive = writable(false);

selectedIds.subscribe(ids => {
  isSelectionActive.set(ids.size > 0);
});

export function toggleSelection(id: string) {
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
  const lastId = get(lastSelectedId);
  if (!lastId) {
    toggleSelection(id);
    return;
  }

  const startIdx = allVisibleIds.indexOf(lastId);
  const endIdx = allVisibleIds.indexOf(id);

  if (startIdx === -1 || endIdx === -1) {
    toggleSelection(id);
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
  selectedIds.set(new Set(ids));
  if (ids.length > 0) {
    lastSelectedId.set(ids[ids.length - 1]);
  }
}

export function clearSelection() {
  selectedIds.set(new Set());
  lastSelectedId.set(null);
}
