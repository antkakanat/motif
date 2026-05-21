<script lang="ts">
  import { changelog } from '$lib/changelog';
  import { browser } from '$app/environment';

  const CURRENT_VERSION = changelog[0]?.version ?? '1.0.0';
  const STORAGE_KEY = 'motif_last_seen_version';

  let { open = $bindable(false) }: { open: boolean } = $props();

  function close() {
    if (browser) localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    open = false;
  }

  const latest = changelog[0];

  /** Call this from layout on boot to auto-show if version changed */
  export function checkAndShow(): boolean {
    if (!browser) return false;
    const seen = localStorage.getItem(STORAGE_KEY);
    return seen !== CURRENT_VERSION;
  }
</script>

{#if open && latest}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={(e) => { if ((e.target as HTMLElement).classList.contains('backdrop')) close(); }} role="presentation">
    <div class="sheet scale-in" role="dialog" aria-modal="true" aria-label="What's new" tabindex="-1">
      <div class="sheet-header">
        <div class="header-left">
          <span class="sparkle">✨</span>
          <div>
            <h2 class="sheet-title">What's New</h2>
            <span class="version-badge">v{latest.version}</span>
          </div>
        </div>
        <button class="close-btn" onclick={close} aria-label="Close">×</button>
      </div>

      <div class="changes-list">
        {#each latest.items as item}
          <div class="change-item">
            <span class="check">✓</span>
            <span class="change-text">{item}</span>
          </div>
        {/each}
      </div>

      {#if changelog.length > 1}
        <details class="history">
          <summary class="history-toggle">Previous versions</summary>
          {#each changelog.slice(1) as entry}
            <div class="history-entry">
              <p class="history-version">v{entry.version} <span class="history-date">{entry.date}</span></p>
              <ul class="history-list">
                {#each entry.items as item}
                  <li>{item}</li>
                {/each}
              </ul>
            </div>
          {/each}
        </details>
      {/if}

      <div class="sheet-footer">
        <button class="btn-primary" onclick={close}>Got it 🎉</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 14, 26, 0.55);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 210;
    padding: 16px;
  }

  .sheet {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 460px;
    max-height: 82vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 24px 18px;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 8%, var(--color-bg)), var(--color-bg));
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .sparkle {
    font-size: 2rem;
    line-height: 1;
    animation: spin 2s ease-in-out;
  }

  @keyframes spin {
    0%   { transform: rotate(-15deg) scale(0.8); opacity: 0; }
    50%  { transform: rotate(10deg) scale(1.1); }
    100% { transform: rotate(0deg) scale(1); opacity: 1; }
  }

  .sheet-title {
    margin: 0 0 2px;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .version-badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
    font-size: 0.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    color: var(--color-text-secondary);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast);
    flex-shrink: 0;
  }

  .close-btn:hover { background: var(--color-surface); color: var(--color-text); }

  .changes-list {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .change-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .check {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
    font-size: 0.7rem;
    font-weight: 800;
    margin-top: 1px;
  }

  .change-text {
    font-size: 0.9rem;
    color: var(--color-text);
    line-height: 1.5;
  }

  .history {
    border-top: 1px solid var(--color-border);
    padding: 12px 24px;
  }

  .history-toggle {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    user-select: none;
    padding: 4px 0;
  }

  .history-entry { margin-top: 12px; }

  .history-version {
    margin: 0 0 6px;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .history-date {
    font-weight: 400;
    color: var(--color-text-secondary);
    margin-left: 6px;
  }

  .history-list {
    margin: 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .history-list li {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .sheet-footer {
    padding: 16px 24px 20px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
  }

  .btn-primary {
    padding: 10px 24px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 40%, transparent);
  }
</style>
