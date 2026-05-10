// ────────────────────────────────────────────────
// Changelog — static version history
// ────────────────────────────────────────────────

export interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

export const changelog: ChangelogEntry[] = [
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
      '14-day Pro trial included',
      'Zero data collection — everything stays on your device'
    ]
  }
];
