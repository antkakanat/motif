// ────────────────────────────────────────────────
// Reminders — Phase G
// Uses Notification API + IndexedDB for local scheduled reminders
// No server required — works entirely on-device
// ────────────────────────────────────────────────

import { browser } from '$app/environment';
import { db } from '$lib/db';
import { updateCapture } from '$lib/stores/captures';

export type ReminderPermission = 'granted' | 'denied' | 'default' | 'unsupported';

/** Check or request Notification permission */
export async function checkNotificationPermission(): Promise<ReminderPermission> {
  if (!browser || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

/** Get current permission without requesting */
export function getNotificationPermission(): ReminderPermission {
  if (!browser || !('Notification' in window)) return 'unsupported';
  return Notification.permission as ReminderPermission;
}

/**
 * Schedule a reminder for a capture.
 * Persists `reminderAt` to DB and sets up an in-tab timer.
 * For installed PWA, the service worker will also check on background sync.
 */
export async function scheduleReminder(captureId: string, reminderAt: string): Promise<void> {
  await updateCapture(captureId, { reminderAt, reminderDone: false });
  _scheduleInTabTimer(captureId, reminderAt);
}

/** Cancel an existing reminder */
export async function cancelReminder(captureId: string): Promise<void> {
  await updateCapture(captureId, { reminderAt: null, reminderDone: false });
  _clearInTabTimer(captureId);
}

/** Mark a reminder as dismissed (fired + acknowledged) */
export async function markReminderDone(captureId: string): Promise<void> {
  await updateCapture(captureId, { reminderDone: true });
}

/** Get all captures with active (non-done) reminders, sorted by date */
export async function getUpcomingReminders() {
  const all = await db.captures
    .filter((c) => !c.isTrashed && !!c.reminderAt && !c.reminderDone)
    .toArray();
  return all.sort((a, b) => {
    const ta = new Date(a.reminderAt!).getTime();
    const tb = new Date(b.reminderAt!).getTime();
    return ta - tb;
  });
}

/** Get count of overdue reminders (past reminderAt, not done) */
export async function getOverdueCount(): Promise<number> {
  const now = new Date().toISOString();
  return db.captures
    .filter((c) => !c.isTrashed && !!c.reminderAt && !c.reminderDone && c.reminderAt < now)
    .count();
}

/** Fire a browser notification for a capture */
function fireNotification(captureId: string, title: string) {
  if (!browser || Notification.permission !== 'granted') return;
  const n = new Notification(`🔔 ${title}`, {
    body: 'Tap to open your reminder in Motif.',
    icon: '/icons/icon-192.png',
    tag: `motif-reminder-${captureId}`,
    requireInteraction: false
  });
  n.onclick = () => {
    window.focus();
    n.close();
  };
  markReminderDone(captureId);
}

// ── In-tab timer registry ──
const _timers = new Map<string, ReturnType<typeof setTimeout>>();

function _scheduleInTabTimer(captureId: string, reminderAt: string) {
  _clearInTabTimer(captureId);
  const delay = new Date(reminderAt).getTime() - Date.now();
  if (delay <= 0) return; // Already past, will show as overdue in UI
  const timer = setTimeout(async () => {
    const cap = await db.captures.get(captureId);
    if (cap && !cap.reminderDone) {
      fireNotification(captureId, cap.title || 'Reminder');
    }
  }, delay);
  _timers.set(captureId, timer);
}

function _clearInTabTimer(captureId: string) {
  const existing = _timers.get(captureId);
  if (existing) {
    clearTimeout(existing);
    _timers.delete(captureId);
  }
}

/** Call once on app boot to re-register timers for persisted reminders */
export async function restoreReminderTimers(): Promise<void> {
  if (!browser) return;
  const reminders = await getUpcomingReminders();
  for (const cap of reminders) {
    if (cap.reminderAt) {
      _scheduleInTabTimer(cap.id, cap.reminderAt);
    }
  }
}

/** Format a reminder date for display */
export function formatReminderDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  const isPast = diff < 0;
  const prefix = isPast ? '' : 'in ';
  const suffix = isPast ? ' ago' : '';

  if (minutes < 1) return isPast ? 'just now' : 'in a moment';
  if (hours < 1) return `${prefix}${minutes}m${suffix}`;
  if (days < 1) return `${prefix}${hours}h${suffix}`;
  if (days === 1) return isPast ? 'yesterday' : 'tomorrow';
  if (days < 7) return `${prefix}${days}d${suffix}`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
