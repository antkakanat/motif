<script lang="ts">
  import { getShortcuts, MOD_KEY } from '$lib/shortcuts';

  let { open = $bindable(false) }: { open: boolean } = $props();

  const shortcuts = $derived(getShortcuts());

  function close() { open = false; }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  // Group shortcuts for display
  const groups = [
    {
      label: 'Navigation',
      shortcuts: [
        { keys: [MOD_KEY, 'K'], label: 'New capture' },
        { keys: ['/'], label: 'Focus search' },
        { keys: [MOD_KEY, ','], label: 'Open Settings' },
        { keys: ['?'], label: 'Show shortcuts' }
      ]
    },
    {
      label: 'Captures',
      shortcuts: [
        { keys: ['Esc'], label: 'Close modal / deselect' },
        { keys: [MOD_KEY, 'A'], label: 'Select all' },
        { keys: ['Shift', 'Click'], label: 'Range select' },
        { keys: ['Long press'], label: 'Enter selection mode' }
      ]
    },
    {
      label: 'Privacy',
      shortcuts: [
        { keys: [MOD_KEY, 'L'], label: 'Lock app' }
      ]
    }
  ];
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={(e) => { if ((e.target as HTMLElement).classList.contains('backdrop')) close(); }} role="presentation">
    <div class="sheet scale-in" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabindex="-1">
      <div class="sheet-header">
        <h2 class="sheet-title">⌨️ Keyboard Shortcuts</h2>
        <button class="close-btn" onclick={close} aria-label="Close">×</button>
      </div>

      <div class="groups">
        {#each groups as group}
          <div class="group">
            <p class="group-label">{group.label}</p>
            <div class="rows">
              {#each group.shortcuts as sc}
                <div class="row">
                  <div class="keys">
                    {#each sc.keys as key, i}
                      <kbd class="key">{key}</kbd>
                      {#if i < sc.keys.length - 1}<span class="plus">+</span>{/if}
                    {/each}
                  </div>
                  <span class="row-label">{sc.label}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <p class="tip">Tip: Press <kbd class="key-inline">?</kbd> anywhere to open this guide.</p>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 14, 26, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 16px;
  }

  .sheet {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 520px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
    padding: 0;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--color-bg);
    z-index: 1;
  }

  .sheet-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-text);
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
  }

  .close-btn:hover { background: var(--color-surface); color: var(--color-text); }

  .groups {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 8px 0;
  }

  .group { padding: 16px 24px 8px; }

  .group-label {
    margin: 0 0 10px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-secondary);
  }

  .rows { display: flex; flex-direction: column; gap: 6px; }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    transition: background var(--duration-fast);
  }

  .row:hover { background: var(--color-surface); }

  .keys {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 24px;
    padding: 0 8px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text);
    box-shadow: 0 1px 0 var(--color-border);
    white-space: nowrap;
  }

  .plus {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
  }

  .row-label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .tip {
    margin: 0;
    padding: 14px 24px 20px;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    border-top: 1px solid var(--color-border);
  }

  .key-inline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text);
    box-shadow: 0 1px 0 var(--color-border);
  }
</style>
