<script lang="ts">
  import { t } from '$lib/i18n';
  import { fade } from 'svelte/transition';
  import { analyzeImport, executeImport, type ImportAnalysis } from '$lib/import';

  let { open = $bindable(false), file = $bindable<File | null>(null) } = $props<{
    open: boolean;
    file: File | null;
  }>();

  let analysisStats = $state<ImportAnalysis['stats'] | null>(null);
  let cachedAnalysis: ImportAnalysis | null = null;
  let error = $state<string | null>(null);
  let isAnalyzing = $state(false);
  let isImporting = $state(false);
  let isSuccess = $state(false);
  let strategy = $state<'merge' | 'replace'>('merge');

  // React to file changes
  $effect(() => {
    if (file && open) {
      void runAnalysis(file);
    }
  });

  async function runAnalysis(f: File) {
    isAnalyzing = true;
    error = null;
    analysisStats = null;
    cachedAnalysis = null;
    isSuccess = false;
    strategy = 'merge';

    try {
      cachedAnalysis = await analyzeImport(f);
      analysisStats = cachedAnalysis.stats;
    } catch (err: any) {
      error = err.message || 'Failed to analyze backup file.';
    } finally {
      isAnalyzing = false;
    }
  }

  function close() {
    open = false;
    file = null;
    error = null;
    analysisStats = null;
    cachedAnalysis = null;
    isSuccess = false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  async function handleConfirm() {
    if (!cachedAnalysis) return;
    
    isImporting = true;
    error = null;
    
    try {
      await executeImport(cachedAnalysis, strategy);
      isSuccess = true;
      // Auto-close after 2 seconds so the user can read the success message
      setTimeout(() => {
        if (isSuccess) close();
      }, 2000);
    } catch (err: any) {
      error = err.message || 'Import failed.';
    } finally {
      isImporting = false;
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdropClick} transition:fade={{ duration: 150 }}>
    <div class="modal scale-in" role="dialog" aria-modal="true" aria-label="Import Backup">
      <div class="modal-header">
        <h2 class="modal-title">Import Backup</h2>
        <button class="btn-close" onclick={close} disabled={isImporting}>×</button>
      </div>

      <div class="modal-body">
        {#if isSuccess}
          <div class="success-state">
            <div class="success-icon">✓</div>
            <p><strong>Import Successful!</strong></p>
            <p class="success-desc">Your captures are now ready.</p>
          </div>
        {:else if isAnalyzing}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Analyzing backup file...</p>
          </div>
        {:else if error}
          <div class="error-box">
            <span class="icon">⚠️</span>
            <p>{error}</p>
          </div>
        {:else if analysisStats}
          <div class="summary-box">
            <p class="summary-text">
              Found <strong>{analysisStats.totalCaptures}</strong> captures, 
              <strong>{analysisStats.totalCollections}</strong> collections, and 
              <strong>{analysisStats.totalTags}</strong> tags.
            </p>
            {#if analysisStats.duplicateCaptures > 0}
              <p class="duplicate-text">
                <span class="icon">ℹ️</span> 
                <strong>{analysisStats.duplicateCaptures}</strong> captures already exist in your library.
              </p>
            {/if}
          </div>

          <div class="strategy-selector">
            <label class="radio-label">
              <input type="radio" name="strategy" value="merge" bind:group={strategy} />
              <div class="radio-content">
                <span class="radio-title">Merge (skip duplicates)</span>
                <span class="radio-desc">Safest option. New items are added, existing items are left untouched.</span>
              </div>
            </label>
            
            <label class="radio-label">
              <input type="radio" name="strategy" value="replace" bind:group={strategy} />
              <div class="radio-content">
                <span class="radio-title text-danger">Replace all (overwrite)</span>
                <span class="radio-desc">Incoming captures will overwrite matching existing items, destroying any local changes.</span>
              </div>
            </label>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        {#if isSuccess}
          <button class="btn btn-primary" onclick={close}>Done</button>
        {:else}
          <button class="btn btn-ghost" onclick={close} disabled={isImporting}>{t('capture.cancel') || 'Cancel'}</button>
          <button class="btn btn-primary" onclick={handleConfirm} disabled={isAnalyzing || !!error || isImporting}>
            {isImporting ? 'Importing...' : 'Confirm Import'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 14, 26, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }

  .modal {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 480px;
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    line-height: 1;
  }

  .modal-body {
    padding: 24px 20px;
  }

  .modal-footer {
    display: flex;
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
    gap: 8px;
    justify-content: flex-end;
  }

  .btn {
    padding: 8px 16px;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
    border: none;
    font-family: var(--font-sans);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-ghost {
    background: none;
    color: var(--color-text-secondary);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .btn-ghost:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 0;
    color: var(--color-text-secondary);
  }

  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 0;
    text-align: center;
  }

  .success-icon {
    width: 48px;
    height: 48px;
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-bottom: 8px;
  }

  .success-desc {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-secondary);
  }
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-box {
    background: var(--color-danger-subtle, rgba(239, 68, 68, 0.1));
    color: var(--color-danger);
    padding: 16px;
    border-radius: var(--radius-md);
    display: flex;
    gap: 12px;
    align-items: flex-start;
    font-size: 14px;
    line-height: 1.5;
  }

  .summary-box {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-bottom: 20px;
  }

  .summary-text {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--color-text);
  }

  .duplicate-text {
    margin: 0;
    font-size: 13px;
    color: var(--color-accent, #eab308);
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .strategy-selector {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .radio-label {
    display: flex;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .radio-label:has(input:checked) {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
  }

  .radio-label:has(input[value="replace"]:checked) {
    border-color: var(--color-danger);
    background: var(--color-danger-subtle, rgba(239, 68, 68, 0.05));
  }

  input[type="radio"] {
    margin-top: 2px;
    accent-color: var(--color-primary);
  }
  
  input[value="replace"] {
    accent-color: var(--color-danger);
  }

  .radio-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .radio-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--color-text);
  }

  .radio-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .text-danger {
    color: var(--color-danger);
  }
</style>
