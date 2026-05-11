<script lang="ts">
  import { page } from '$app/stores';
  import { db, type Capture } from '$lib/db';
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import ProGate from '$lib/components/ProGate.svelte';
  import { browser } from '$app/environment';

  const id = $page.params.id as string;
  let capture = $state<Capture | null>(null);
  let content = $state<any>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);

  // Typography settings
  let font = $state('sans'); // 'sans' | 'serif'
  let size = $state('medium'); // 'small' | 'medium' | 'large'
  let width = $state('comfortable'); // 'comfortable' (65ch) | 'wide' (85ch)

  onMount(async () => {
    // Load preferences
    if (browser) {
      font = localStorage.getItem('motif_read_font') || 'sans';
      size = localStorage.getItem('motif_read_size') || 'medium';
      width = localStorage.getItem('motif_read_width') || 'comfortable';
    }

    // Load capture
    capture = (await db.captures.get(id)) || null;
    
    if (!capture) {
      error = 'Capture not found';
      loading = false;
      return;
    }

    if (capture.type !== 'link') {
      error = 'Reading view is only available for links';
      loading = false;
      return;
    }

    try {
      const res = await fetch(`/api/read?url=${encodeURIComponent(capture.content)}`);
      if (!res.ok) {
        let errMessage = 'Failed to fetch clean version';
        try {
          const data = await res.json();
          errMessage = data.message || errMessage;
        } catch (e) {
          errMessage = await res.text();
        }
        throw new Error(errMessage);
      }
      content = await res.json();
    } catch (err: any) {
      error = err.message;
      console.error("Read View Error:", err);
    } finally {
      loading = false;
    }
  });

  function toggleFont() {
    font = font === 'sans' ? 'serif' : 'sans';
    if (browser) localStorage.setItem('motif_read_font', font);
  }

  function toggleSize() {
    const sizes = ['small', 'medium', 'large'];
    const idx = sizes.indexOf(size);
    size = sizes[(idx + 1) % sizes.length];
    if (browser) localStorage.setItem('motif_read_size', size);
  }

  function toggleWidth() {
    width = width === 'comfortable' ? 'wide' : 'comfortable';
    if (browser) localStorage.setItem('motif_read_width', width);
  }
</script>

<svelte:head>
  <title>{capture?.title || 'Reading View'} — Motif</title>
</svelte:head>

<div class="read-page">
  <header class="read-header">
    <a href="/" class="back-btn" aria-label="Back to home">←</a>
    
    {#if capture && !loading && !error}
      <div class="controls">
        <button class="control-btn" onclick={toggleFont} title="Toggle Font">
          {font === 'sans' ? 'Sans' : 'Serif'}
        </button>
        <button class="control-btn" onclick={toggleSize} title="Toggle Size">
          {size === 'small' ? 'A-' : size === 'medium' ? 'A' : 'A+'}
        </button>
        <button class="control-btn" onclick={toggleWidth} title="Toggle Width">
          {width === 'comfortable' ? '⬌' : '↔'}
        </button>
      </div>
    {/if}

    <div class="header-spacer"></div>
    
    {#if capture}
      <a href={capture.content} target="_blank" rel="noopener" class="original-link">
        {t('common.openOriginal') || 'Open Original'} ↗
      </a>
    {/if}
  </header>

  <main class="read-container" 
        class:font-serif={font === 'serif'}
        class:size-small={size === 'small'}
        class:size-large={size === 'large'}
        class:width-wide={width === 'wide'}>
    
    <ProGate feature="readingView" featureLabel="Reading View">
      {#if loading}
        <div class="loading-state fade-in">
          <div class="spinner"></div>
          <p>{t('pro.fetchingClean') || 'Fetching clean version...'}</p>
        </div>
      {:else if error}
        <div class="error-state fade-in">
          <div class="error-icon">⚠️</div>
          <h2 class="error-title">Could not load reading view</h2>
          <p class="error-desc">{error}</p>
          {#if capture}
            <a href={capture.content} target="_blank" rel="noopener" class="btn btn-primary">
              Open Original Website
            </a>
          {/if}
        </div>
      {:else if content}
        <article class="article fade-in">
          <header class="article-header">
            <h1 class="article-title">{content.title}</h1>
            {#if content.byline || content.siteName}
              <p class="article-meta">
                {content.byline ? `By ${content.byline}` : ''}
                {content.byline && content.siteName ? ' • ' : ''}
                {content.siteName || ''}
              </p>
            {/if}
          </header>
          
          <div class="article-content">
            {@html content.content}
          </div>

          <footer class="article-footer">
            <div class="footer-divider"></div>
            <p>End of article. <a href={capture?.content} target="_blank" rel="noopener">View source</a></p>
          </footer>
        </article>
      {/if}
    </ProGate>
  </main>
</div>

<style>
  .read-page {
    min-height: 100vh;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .read-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .back-btn {
    font-size: 20px;
    text-decoration: none;
    color: var(--color-text-secondary);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
  }

  .back-btn:hover {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .controls {
    display: flex;
    gap: 4px;
    background: var(--color-surface);
    padding: 2px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .control-btn {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    border: none;
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast);
  }

  .control-btn:hover {
    color: var(--color-text);
    background: var(--color-bg);
  }

  .header-spacer { flex: 1; }

  .original-link {
    font-size: 13px;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }

  .read-container {
    padding: 40px 20px;
    margin: 0 auto;
    max-width: 65ch; /* Default 'comfortable' width */
    transition: max-width 0.3s var(--ease-out);
  }

  .width-wide { max-width: 85ch; }

  /* Typography System */
  .article {
    line-height: 1.6;
    font-size: 1.1rem;
  }

  .font-serif {
    font-family: Georgia, 'Times New Roman', Times, serif;
  }

  .size-small { font-size: 0.95rem; }
  .size-large { font-size: 1.25rem; }

  .article-title {
    font-size: 2.2rem;
    font-weight: 800;
    margin: 0 0 12px;
    line-height: 1.2;
  }

  .article-meta {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin: 0 0 32px;
  }

  .article-content :global(p) {
    margin: 0 0 1.5em;
  }

  .article-content :global(h2) {
    font-size: 1.5rem;
    margin: 2em 0 0.8em;
  }

  .article-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius-md);
    margin: 2em 0;
  }

  .article-content :global(a) {
    color: var(--color-primary);
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }

  .article-content :global(blockquote) {
    margin: 2em 0;
    padding-left: 20px;
    border-left: 4px solid var(--color-primary-subtle);
    font-style: italic;
    color: var(--color-text-secondary);
  }

  .article-footer {
    margin-top: 64px;
    padding-bottom: 80px;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .footer-divider {
    height: 1px;
    background: var(--color-border);
    width: 100px;
    margin: 0 auto 24px;
  }

  /* States */
  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 0;
    text-align: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .error-icon { font-size: 48px; margin-bottom: 20px; }
  .error-title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
  .error-desc { color: var(--color-text-secondary); margin: 0 0 24px; max-width: 400px; }

  @media (max-width: 768px) {
    .read-container { padding: 24px 16px; }
    .article-title { font-size: 1.8rem; }
  }
</style>
