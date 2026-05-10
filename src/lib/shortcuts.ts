// ────────────────────────────────────────────────
// Keyboard Shortcuts
// ────────────────────────────────────────────────

export type Shortcut = {
  key: string;
  label: string;
  description: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  handler: () => void;
};

const isMac =
  typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac');

export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

let shortcuts: Shortcut[] = [];

export function registerShortcuts(defs: Shortcut[]): void {
  shortcuts = defs;
}

export function getShortcuts(): Shortcut[] {
  return shortcuts;
}

export function handleKeydown(event: KeyboardEvent): void {
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const shift = event.shiftKey;

  for (const shortcut of shortcuts) {
    const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
    const modMatch = shortcut.ctrlOrCmd ? mod : !mod;
    const shiftMatch = !!shortcut.shift === shift;

    if (keyMatch && modMatch && shiftMatch) {
      event.preventDefault();
      shortcut.handler();
      return;
    }
  }
}

// Format shortcut for display
export function formatShortcut(shortcut: Shortcut): string {
  let parts = [];
  if (shortcut.ctrlOrCmd) parts.push(MOD_KEY);
  if (shortcut.shift) parts.push('Shift');
  parts.push(shortcut.key.toUpperCase());
  return parts.join('+');
}
