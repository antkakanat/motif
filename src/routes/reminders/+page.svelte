<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    getUpcomingReminders,
    cancelReminder,
    markReminderDone,
    formatReminderDate,
    checkNotificationPermission,
    type ReminderPermission
  } from '$lib/reminders';
  import type { Capture } from '$lib/db';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import CaptureCard from '$lib/components/CaptureCard.svelte';
  import CaptureModal from '$lib/components/CaptureModal.svelte';
  import { updateCapture } from '$lib/stores/captures';

  let reminders = $state<Capture[]>([]);
  let loading = $state(true);
  let permission = $state<ReminderPermission>('default');
  let showModal = $state(false);
  let editingCapture = $state<Capture | null>(null);

  const now = new Date().toISOString();

  const overdueReminders = $derived(reminders.filter(c => c.reminderAt! < now));
  const upcomingReminders = $derived(reminders.filter(c => c.reminderAt! >= now));

  async function loadReminders() {
    loading = true;
    reminders = await getUpcomingReminders();
    loading = false;
  }

  async function requestPermission() {
    permission = await checkNotificationPermission();
  }

  async function handleCancel(id: string) {
    await cancelReminder(id);
    await loadReminders();
  }

  async function handleDismiss(id: string) {
    await markReminderDone(id);
    await loadReminders();
  }

  function openEdit(capture: Capture) {
    editingCapture = capture;
    showModal = true;
  }

  async function handleSave(data: any) {
    if (!editingCapture) return;
    await updateCapture(editingCapture.id, {
      title: data.title,
      content: data.content,
      tags: data.tags,
      sourceUrl: data.sourceUrl,
      collectionId: data.collectionId
    });
    await loadReminders();
  }

  onMount(async () => {
    await loadReminders();
    permission = 'granted'; // check silently
    try {
      if ('Notification' in window) {
        permission = Notification.permission as ReminderPermission;
      }
    } catch {}
  });
</script>

<svelte:head>
  <title>Reminders — Motif</title>
  <meta name="description" content="Captures with scheduled reminders" />
</svelte:head>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">🔔 Reminders</h1>
    <p class="page-sub">Captures with scheduled due dates</p>
  </div>

  {#if permission === 'denied'}
    <div class="permission-banner">
      <span class="perm-icon">⚠️</span>
      <div>
        <p class="perm-title">Notifications blocked</p>
        <p class="perm-hint">Enable notifications in your browser settings to receive reminder alerts.</p>
      </div>
    </div>
  {:else if permission === 'default'}
    <button class="perm-request-btn" onclick={requestPermission}>
      🔔 Enable notifications for reminder alerts
    </button>
  {/if}

  {#if loading}
    <div class="loading-row">
      <div class="spinner"></div>
      <span>Loading reminders...</span>
    </div>
  {:else if reminders.length === 0}
    <EmptyState
      icon="🔔"
      title="No active reminders"
      hint="Open any capture and set a reminder date to see it here."
      actionLabel="Browse all captures"
      onAction={() => goto('/')}
    />
  {:else}
    {#if overdueReminders.length > 0}
      <section class="section">
        <h2 class="section-title overdue">⚠ Overdue</h2>
        <div class="captures-grid">
          {#each overdueReminders as capture}
            <div class="reminder-wrapper overdue-card">
              <div class="reminder-meta">
                <span class="reminder-time overdue-time">
                  Due {formatReminderDate(capture.reminderAt!)}
                </span>
                <div class="reminder-actions">
                  <button class="action-btn dismiss" onclick={() => handleDismiss(capture.id)}>Dismiss</button>
                  <button class="action-btn cancel" onclick={() => handleCancel(capture.id)}>Remove</button>
                </div>
              </div>
              <CaptureCard
                {capture}
                onEdit={openEdit}
                onOpen={openEdit}
              />
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if upcomingReminders.length > 0}
      <section class="section">
        <h2 class="section-title">Upcoming</h2>
        <div class="captures-grid">
          {#each upcomingReminders as capture}
            <div class="reminder-wrapper">
              <div class="reminder-meta">
                <span class="reminder-time">
                  🔔 {formatReminderDate(capture.reminderAt!)}
                </span>
                <button class="action-btn cancel" onclick={() => handleCancel(capture.id)}>Remove</button>
              </div>
              <CaptureCard
                {capture}
                onEdit={openEdit}
                onOpen={openEdit}
              />
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

{#if showModal && editingCapture}
  <CaptureModal
    bind:open={showModal}
    onSave={handleSave}
    initialData={{
      id: editingCapture.id,
      type: editingCapture.type,
      title: editingCapture.title,
      content: editingCapture.content,
      sourceUrl: editingCapture.sourceUrl ?? '',
      collectionId: editingCapture.collectionId ?? null,
      tags: [...editingCapture.tags],
      ocrText: editingCapture.ocrText,
      ocrStatus: editingCapture.ocrStatus
    }}
  />
{/if}

<style>
  .page { max-width: 860px; margin: 0 auto; }

  .page-header { margin-bottom: 28px; }

  .page-title {
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--color-text);
    margin: 0 0 6px;
    letter-spacing: -0.02em;
  }

  .page-sub {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .permission-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 18px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, #f59e0b 10%, var(--color-bg));
    border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
    margin-bottom: 20px;
  }

  .perm-icon { font-size: 1.2rem; }
  .perm-title { margin: 0 0 2px; font-size: 0.875rem; font-weight: 600; color: var(--color-text); }
  .perm-hint { margin: 0; font-size: 0.8rem; color: var(--color-text-secondary); }

  .perm-request-btn {
    display: block;
    width: 100%;
    padding: 12px 20px;
    margin-bottom: 20px;
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 6%, transparent);
    color: var(--color-primary);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast);
    text-align: center;
  }

  .perm-request-btn:hover {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  .loading-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .section { margin-bottom: 32px; }

  .section-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-secondary);
    margin: 0 0 14px;
  }

  .section-title.overdue { color: #f59e0b; }

  .captures-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .reminder-wrapper {
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    overflow: hidden;
    transition: box-shadow var(--duration-fast);
  }

  .reminder-wrapper:hover {
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }

  .overdue-card {
    border-color: color-mix(in srgb, #f59e0b 40%, transparent);
    background: color-mix(in srgb, #f59e0b 4%, var(--color-bg));
  }

  .reminder-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    gap: 8px;
  }

  .reminder-time {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .overdue-time { color: #f59e0b; }

  .reminder-actions { display: flex; gap: 6px; }

  .action-btn {
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all var(--duration-fast);
  }

  .action-btn.dismiss {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
  }

  .action-btn.dismiss:hover {
    background: color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  .action-btn.cancel {
    background: var(--color-surface);
    color: var(--color-text-secondary);
  }

  .action-btn.cancel:hover {
    background: var(--color-border);
    color: var(--color-text);
  }
</style>
