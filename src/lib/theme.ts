// ────────────────────────────────────────────────
// Theme Store — light / dark / system
// ────────────────────────────────────────────────

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'motif_theme';

function getInitialTheme(): ThemeMode {
  if (!browser) return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (!browser) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export const themeMode = writable<ThemeMode>(getInitialTheme());
export const resolvedTheme = writable<'light' | 'dark'>(
  getResolvedTheme(getInitialTheme())
);

// Apply theme to <html> element
function applyTheme(resolved: 'light' | 'dark') {
  if (!browser) return;
  const html = document.documentElement;
  html.classList.toggle('dark', resolved === 'dark');
}

// Subscribe to changes
themeMode.subscribe((mode) => {
  if (browser) {
    localStorage.setItem(STORAGE_KEY, mode);
  }
  const resolved = getResolvedTheme(mode);
  resolvedTheme.set(resolved);
  applyTheme(resolved);
});

// Listen for OS theme changes when in 'system' mode
if (browser) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = get(themeMode);
    if (current === 'system') {
      const resolved = getResolvedTheme('system');
      resolvedTheme.set(resolved);
      applyTheme(resolved);
    }
  });

  // Apply on initial load
  applyTheme(getResolvedTheme(getInitialTheme()));
}

// Toggle function for quick switch
export function toggleTheme() {
  themeMode.update((current) => {
    const resolved = getResolvedTheme(current);
    return resolved === 'dark' ? 'light' : 'dark';
  });
}

export function setTheme(mode: ThemeMode) {
  themeMode.set(mode);
}
