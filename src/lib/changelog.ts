// ------------------------------------------------
// Changelog - static version history
// ------------------------------------------------

export interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-05-21',
    items: [
      'Local AI semantic search — find captures by meaning, not just keywords (23MB one-time download)',
      'AES-256 local encryption — protect all capture text with a password + 12-word recovery phrase',
      'Link metadata auto-fetch — titles, descriptions and favicons filled in automatically on save',
      'Reminders — attach a due date to any capture and get a local notification',
      'Keyboard shortcut cheatsheet — press ? anywhere to see all shortcuts',
      'Empty states — helpful prompts when no captures match a filter',
      'What\'s New modal — see what changed on every update',
      'Haptic feedback on mobile PWA saves and lock interactions'
    ]
  },
  {
    version: '1.1.0',
    date: '2026-05-13',
    items: [
      'Collections — organize captures into named boards',
      'Bulk actions — select, tag, move, or delete multiple captures',
      'Export ZIP — backup all captures including images',
      'Import ZIP — restore from any Motif backup',
      'Reading view — distraction-free article reading (Pro)',
      'Browser extension — save links and quotes from any page',
      'Option C monetization — free forever + Lifetime Pro',
      'Duplicate URL detection fix',
      'Removed 14-day trial — free tier is now permanent'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-05-08',
    items: [
      'Initial release',
      '4 capture types: links, quotes, notes, images',
      'Full-text fuzzy search',
      'Tags and status tracking (Unread / Saved / Archived)',
      'Trash with 30-day auto-purge',
      'Duplicate URL detection',
      'PWA installable — works offline',
      'Share Target API — share to Motif from any app',
      'App lock with PIN',
      'Dark mode',
      'Zero data collection — everything stays on your device'
    ]
  }
];
