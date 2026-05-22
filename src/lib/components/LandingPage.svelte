<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { onMount } from 'svelte';
  import { performOCR } from '$lib/ocr';

  // Props
  let { onEnterDashboard }: { onEnterDashboard: () => void } = $props();

  // Sandbox State
  let searchQuery = $state('');
  let filterType = $state<'all' | 'link' | 'quote' | 'image'>('all');
  
  // OCR Demo State
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let isScanning = $state(false);
  let scanProgress = $state(0);
  let ocrResult = $state('');
  let scanSuccess = $state(false);

  // Preloaded mock database cards
  interface SandboxCard {
    id: string;
    type: 'link' | 'quote' | 'image';
    title: string;
    content: string;
    tags: string[];
    favicon?: string;
    sourceUrl?: string;
  }

  const initialCards: SandboxCard[] = [
    {
      id: '1',
      type: 'link',
      title: 'Introducing Gemini 3.5 Flash: High intelligence & speed',
      content: 'https://deepmind.google/technologies/gemini',
      tags: ['ai', 'google'],
      favicon: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png'
    },
    {
      id: '2',
      type: 'quote',
      title: 'Structure and Interpretation of Computer Programs',
      content: 'Programs must be written for people to read, and only incidentally for machines to execute.',
      tags: ['programming', 'wisdom']
    },
    {
      id: '3',
      type: 'image',
      title: 'Screenshot Snippet',
      content: '', // Dynamically generated via canvas
      tags: ['ocr', 'local-first']
    }
  ];

  // Draw local text onto a canvas so Tesseract has a 100% reliable high-contrast image to read locally
  function prepareOcrCanvas() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    // Clear and draw background
    const width = canvasEl.width;
    const height = canvasEl.height;

    // Rich cosmic gradient background
    const grad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width);
    grad.addColorStop(0, '#1E1B4B');
    grad.addColorStop(0.5, '#0F0E1A');
    grad.addColorStop(1, '#02010A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative ambient grid lines
    ctx.strokeStyle = 'rgba(91, 78, 214, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Glowing border ring
    ctx.strokeStyle = 'rgba(91, 78, 214, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // Draw Mock Code/Snippet Title bar
    ctx.fillStyle = 'rgba(91, 78, 214, 0.2)';
    ctx.fillRect(4, 4, width - 8, 32);

    // Three mock browser circles
    const colors = ['#EF4444', '#F59E0B', '#10B981'];
    colors.forEach((col, idx) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(20 + idx * 14, 20, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Write text in sharp bold characters for OCR
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(139, 129, 240, 0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText('MOTIF IS 100% PRIVATE', width / 2, height / 2 - 15);

    ctx.fillStyle = '#A09CC8';
    ctx.font = '14px "Inter", sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillText('OCR extracts this text locally.', width / 2, height / 2 + 15);

    ctx.fillStyle = '#8B81F0';
    ctx.font = 'italic 12px "Inter", sans-serif';
    ctx.fillText('No cloud requests were made.', width / 2, height / 2 + 40);
  }

  let hostname = $state('motif.byant.dev');

  onMount(() => {
    prepareOcrCanvas();
    if (typeof window !== 'undefined') {
      hostname = window.location.hostname || 'motif.byant.dev';
    }
  });

  // Run real local OCR demo using Tesseract
  async function runOcrDemo() {
    if (isScanning || !canvasEl) return;
    isScanning = true;
    scanProgress = 0;
    scanSuccess = false;
    ocrResult = '';

    // Interval to fake progress up to 90% while Tesseract loads model
    const progressInterval = setInterval(() => {
      if (scanProgress < 90) {
        scanProgress += Math.floor(Math.random() * 8) + 2;
      }
    }, 150);

    try {
      const dataUrl = canvasEl.toDataURL('image/png');
      const text = await performOCR(dataUrl);
      clearInterval(progressInterval);
      scanProgress = 100;
      ocrResult = text.trim();
      scanSuccess = true;
    } catch (err) {
      console.error('Local Sandbox OCR Error:', err);
      ocrResult = 'Error initializing local OCR: ' + String(err);
    } finally {
      clearInterval(progressInterval);
      isScanning = false;
    }
  }

  // Filter calculations
  let filteredCards = $derived.by(() => {
    let items = initialCards;

    // Filter by type
    if (filterType !== 'all') {
      items = items.filter(c => c.type === filterType);
    }

    // Filter by query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(c => 
        c.title.toLowerCase().includes(q) || 
        c.content.toLowerCase().includes(q) || 
        c.tags.some(t => t.toLowerCase().includes(q)) ||
        (c.id === '3' && ocrResult && ocrResult.toLowerCase().includes(q))
      );
    }

    return items;
  });

  function selectFilter(type: 'all' | 'link' | 'quote' | 'image') {
    filterType = type;
  }
</script>

<div class="landing-container slide-up">
  <!-- Dynamic Glowing Mesh Background Elements -->
  <div class="glow-orb g1"></div>
  <div class="glow-orb g2"></div>

  <!-- Hero Section -->
  <header class="hero-section">
    <div class="branding-row">
      <span class="pill-badge">✨ Now Approved on Microsoft Edge & Chrome Web Store</span>
    </div>
    <h1 class="hero-title">
      Your Private <span class="gradient-text">Spatial Mind</span>
    </h1>
    <p class="hero-subtitle">
      Motif captures links, highlighted quotes, code, and screenshots directly to your local device. 
      Built completely offline. 100% private. Zero telemetry.
    </p>
    
    <div class="cta-row">
      <button class="btn btn-primary cta-btn" onclick={onEnterDashboard}>
        Enter Dashboard <span class="arrow">→</span>
      </button>
      <a href="#sandbox" class="btn btn-outline cta-secondary">
        Try Sandbox Playground
      </a>
    </div>
  </header>

  <!-- Value Pillars Grid -->
  <section class="pillars-section">
    <div class="pillars-grid">
      <div class="pillar-card glass">
        <div class="pillar-icon">🔒</div>
        <h3 class="pillar-title">100% Local database</h3>
        <p class="pillar-desc">
          Your thoughts shouldn't live in someone else's cloud database. Everything is saved to a highly secure, private local database on your device.
        </p>
      </div>

      <div class="pillar-card glass">
        <div class="pillar-icon">👁️</div>
        <h3 class="pillar-title">Zero-Server Local OCR</h3>
        <p class="pillar-desc">
          Scan text from screenshots on-device. Motif performs high-speed neural reading without sending a single byte to any cloud.
        </p>
      </div>

      <div class="pillar-card glass">
        <div class="pillar-icon">⚡</div>
        <h3 class="pillar-title">Offline PWA Engine</h3>
        <p class="pillar-desc">
          Runs perfectly in planes, subways, or mountains. Full keyboard accessibility and instant sub-millisecond search capabilities.
        </p>
      </div>
    </div>
  </section>

  <!-- Sandbox Playground -->
  <section id="sandbox" class="sandbox-section">
    <div class="sandbox-header">
      <h2 class="section-title">Live Technology Playground</h2>
      <p class="section-subtitle">
        Experience Motif's local intelligence directly below. Click tags, test filters, or trigger a fully client-side OCR text extraction on the mock screenshot.
      </p>
    </div>

    <!-- Mock Viewport -->
    <div class="sandbox-viewport glass">
      <!-- Viewport Header -->
      <div class="viewport-header">
        <div class="mac-buttons">
          <span class="dot red"></span>
          <span class="dot orange"></span>
          <span class="dot green"></span>
        </div>
        <div class="viewport-address">
          <span>{hostname} / sandbox / playground</span>
        </div>
      </div>

      <!-- Viewport Toolbar -->
      <div class="viewport-toolbar">
        <div class="sandbox-search-bar">
          <span class="sb-search-icon">🔍</span>
          <input
            type="text"
            class="sb-search-input"
            placeholder="Search sandbox database... (e.g. 'private', 'gemini', 'people')"
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button class="sb-search-clear" onclick={() => searchQuery = ''}>✕</button>
          {/if}
        </div>
        
        <div class="sandbox-filters">
          <button class="chip-filter" class:active={filterType === 'all'} onclick={() => selectFilter('all')}>All</button>
          <button class="chip-filter" class:active={filterType === 'link'} onclick={() => selectFilter('link')}>Links</button>
          <button class="chip-filter" class:active={filterType === 'quote'} onclick={() => selectFilter('quote')}>Quotes</button>
          <button class="chip-filter" class:active={filterType === 'image'} onclick={() => selectFilter('image')}>Screenshots</button>
        </div>
      </div>

      <!-- Sandbox Grid -->
      <div class="sandbox-grid">
        {#each filteredCards as card (card.id)}
          <div 
            class="mock-card" 
            class:image-card={card.type === 'image'} 
            class:quote-card={card.type === 'quote'}
            class:link-card={card.type === 'link'}
            animate:flip={{ duration: 300 }}
            transition:fade={{ duration: 150 }}
          >
            <div class="mc-header">
              <span class="mc-type-badge type-{card.type}">{card.type.toUpperCase()}</span>
              <span class="mc-date">Just now</span>
            </div>

            <div class="mc-body">
              {#if card.type === 'link'}
                <h4 class="mc-title">{card.title}</h4>
                <div class="mc-link-container">
                  {#if card.favicon}
                    <img src={card.favicon} alt="" class="mc-favicon" />
                  {/if}
                  <span class="mc-link-url">{card.content}</span>
                </div>
              {:else if card.type === 'quote'}
                <h4 class="mc-title">{card.title}</h4>
                <blockquote class="mc-quote">"{card.content}"</blockquote>
              {:else if card.type === 'image'}
                <h4 class="mc-title">{card.title}</h4>
                <div class="ocr-demo-container">
                  <canvas 
                    bind:this={canvasEl} 
                    width="320" 
                    height="180" 
                    class="ocr-canvas"
                  ></canvas>

                  <!-- Scanner Laser Line Overlay -->
                  {#if isScanning}
                    <div class="laser-scanner"></div>
                    <div class="ocr-scanning-overlay">
                      <div class="spinner"></div>
                      <span class="scan-text">Extracting locally... {scanProgress}%</span>
                    </div>
                  {/if}

                  {#if !isScanning && !scanSuccess}
                    <button class="btn btn-primary scan-action-btn" onclick={runOcrDemo}>
                      ⚡ Run On-Device OCR Scan
                    </button>
                  {/if}
                </div>

                {#if scanSuccess}
                  <div class="ocr-result-panel" transition:slide={{ duration: 300 }}>
                    <div class="ocr-result-header">
                      <span class="ocr-check">✓</span>
                      <span>Extracted OCR text (100% local)</span>
                    </div>
                    <p class="ocr-result-text">"{ocrResult}"</p>
                  </div>
                {/if}
              {/if}
            </div>

            <div class="mc-footer">
              <div class="mc-tags">
                {#each card.tags as tag}
                  <span class="mc-tag">#{tag}</span>
                {/each}
              </div>
            </div>
          </div>
        {/each}

        {#if filteredCards.length === 0}
          <div class="sandbox-empty" transition:fade>
            <div class="se-icon">🔍</div>
            <p class="se-title">No sandbox results found</p>
            <p class="se-subtitle">Try adjusting your filters or search keywords.</p>
          </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- Enter Dashboard Invitation Footer -->
  <footer class="landing-footer glass">
    <h3>Ready to build your offline knowledge vault?</h3>
    <p>Everything you save is kept safe and local under your absolute control.</p>
    <button class="btn btn-primary cta-btn-footer" onclick={onEnterDashboard}>
      Start Capturing with Motif
    </button>
  </footer>
</div>

<style>
  .landing-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 60px 24px;
    position: relative;
    z-index: 10;
  }

  /* Orbs for cosmic nebula visual depth */
  .glow-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(140px);
    z-index: -1;
    pointer-events: none;
    will-change: transform;
  }

  .glow-orb.g1 {
    top: 5%;
    left: 20%;
    width: 350px;
    height: 350px;
    background: rgba(91, 78, 214, 0.15);
    animation: pulse-orb 8s ease-in-out infinite alternate;
  }

  .glow-orb.g2 {
    top: 40%;
    right: 15%;
    width: 400px;
    height: 400px;
    background: rgba(13, 148, 136, 0.12);
    animation: pulse-orb 12s ease-in-out infinite alternate-reverse;
  }

  @keyframes pulse-orb {
    0% { transform: scale(1) translate(0, 0); }
    100% { transform: scale(1.2) translate(30px, -20px); }
  }

  /* Hero Section styling */
  .hero-section {
    text-align: center;
    max-width: 800px;
    margin: 0 auto 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .pill-badge {
    padding: 6px 14px;
    background: rgba(91, 78, 214, 0.12);
    border: 1px solid rgba(91, 78, 214, 0.25);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    display: inline-block;
  }

  .hero-title {
    font-size: clamp(2.5rem, 6vw, 4.2rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: var(--color-text);
    margin: 0;
  }

  .gradient-text {
    background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .hero-subtitle {
    font-size: 1.2rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
    max-width: 660px;
    margin: 0;
  }

  .cta-row {
    display: flex;
    gap: 16px;
    margin-top: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .cta-btn {
    padding: 14px 28px;
    font-size: 1rem;
    border-radius: var(--radius-xl);
    box-shadow: 0 10px 25px rgba(91, 78, 214, 0.3);
  }

  .cta-btn-footer {
    padding: 14px 32px;
    font-size: 1rem;
    border-radius: var(--radius-xl);
    box-shadow: 0 10px 25px rgba(91, 78, 214, 0.3);
    margin-top: 8px;
  }

  .cta-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba(91, 78, 214, 0.45);
  }

  .cta-secondary {
    padding: 14px 28px;
    font-size: 1rem;
    border-radius: var(--radius-xl);
  }

  .arrow {
    display: inline-block;
    transition: transform 0.2s;
  }
  .cta-btn:hover .arrow {
    transform: translateX(4px);
  }

  /* Pillars styling */
  .pillars-section {
    margin-bottom: 90px;
  }

  .pillars-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
  }

  .pillar-card {
    padding: 32px;
    border-radius: var(--radius-xl);
    border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
    transition: all var(--duration-normal) var(--ease-out);
    background: rgba(var(--color-surface-raw), 0.4);
    box-shadow: var(--shadow-sm);
  }

  .pillar-card:hover {
    transform: translateY(-4px);
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
    background: rgba(var(--color-surface-raw), 0.65);
    box-shadow: var(--shadow-md);
  }

  .pillar-icon {
    font-size: 2.2rem;
    margin-bottom: 16px;
  }

  .pillar-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 10px;
  }

  .pillar-desc {
    font-size: 0.92rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
    margin: 0;
  }

  /* Sandbox Section */
  .sandbox-section {
    margin-bottom: 90px;
    scroll-margin-top: 40px;
  }

  .sandbox-header {
    text-align: center;
    margin-bottom: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .section-title {
    font-size: 2rem;
    font-weight: 800;
    color: var(--color-text);
    margin: 0;
  }

  .section-subtitle {
    font-size: 1rem;
    color: var(--color-text-secondary);
    max-width: 680px;
    line-height: 1.5;
    margin: 0;
  }

  /* Sandbox viewport / mock app styling */
  .sandbox-viewport {
    border-radius: var(--radius-xl);
    border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
    background: rgba(var(--color-surface-raw), 0.45);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }

  .viewport-header {
    background: rgba(var(--color-surface-raw), 0.9);
    padding: 12px 18px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
  }

  .mac-buttons {
    display: flex;
    gap: 8px;
    margin-right: 20px;
  }

  .mac-buttons .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .dot.red { background: #EF4444; }
  .dot.orange { background: #F59E0B; }
  .dot.green { background: #10B981; }

  .viewport-address {
    background: color-mix(in srgb, var(--color-border) 45%, transparent);
    padding: 4px 24px;
    border-radius: var(--radius-sm);
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    font-family: monospace;
    flex: 1;
    max-width: 400px;
    text-align: center;
    margin: 0 auto;
  }

  .viewport-toolbar {
    padding: 16px 20px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .sandbox-search-bar {
    display: flex;
    align-items: center;
    background: rgba(var(--color-surface-raw), 0.75);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0 12px;
    flex: 1;
    min-width: 260px;
    max-width: 500px;
    transition: all var(--duration-fast);
  }

  .sandbox-search-bar:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 10px rgba(91, 78, 214, 0.15);
  }

  .sb-search-icon {
    font-size: 0.8rem;
    margin-right: 8px;
  }

  .sb-search-input {
    border: none;
    background: none;
    outline: none;
    width: 100%;
    padding: 8px 0;
    font-size: 0.82rem;
    color: var(--color-text);
    font-family: var(--font-sans);
  }

  .sb-search-clear {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.8rem;
  }

  .sandbox-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip-filter {
    background: rgba(var(--color-surface-raw), 0.65);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .chip-filter:hover {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  }

  .chip-filter.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
    box-shadow: 0 4px 10px rgba(91, 78, 214, 0.25);
  }

  .sandbox-grid {
    padding: 24px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    min-height: 380px;
    align-items: start;
    position: relative;
  }

  /* Mock Cards */
  .mock-card {
    background: rgba(var(--color-surface-raw), 0.75);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--shadow-sm);
    transition: all var(--duration-normal) var(--ease-out);
    position: relative;
    width: 100%;
    min-width: 0;
  }

  .mock-card:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
    box-shadow: 0 8px 20px rgba(91, 78, 214, 0.08);
  }

  .mc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .mc-type-badge {
    padding: 2px 8px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.05em;
    border-radius: var(--radius-full);
  }

  .mc-type-badge.type-link { color: #1D4ED8; background: #DBEAFE; }
  .mc-type-badge.type-quote { color: #7C3AED; background: #EDE9FE; }
  .mc-type-badge.type-image { color: #BE123C; background: #FFE4E6; }

  .mc-date {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
  }

  .mc-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  .mc-title {
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text);
    line-height: 1.35;
  }

  .mc-link-container {
    display: flex;
    align-items: center;
    gap: 8px;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
  }

  .mc-favicon {
    width: 14px;
    height: 14px;
    object-fit: contain;
  }

  .mc-link-url {
    font-size: 0.76rem;
    color: var(--color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }

  .mc-quote {
    margin: 0;
    padding: 8px 12px;
    border-left: 2px solid var(--color-primary);
    background: var(--color-primary-subtle);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: 0.8rem;
    font-style: italic;
    color: var(--color-text);
    line-height: 1.5;
  }

  .ocr-demo-container {
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: #02010A;
    aspect-ratio: 16/9;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 100%;
  }

  .ocr-canvas {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Laser line scanner styling */
  .laser-scanner {
    position: absolute;
    left: 4px;
    right: 4px;
    height: 2px;
    background: #FF007F;
    box-shadow: 0 0 10px #FF007F, 0 0 4px #FF007F;
    animation: laser-sweep 2s ease-in-out infinite alternate;
    z-index: 5;
  }

  @keyframes laser-sweep {
    0%   { top: 5%; }
    100% { top: 95%; }
  }

  .ocr-scanning-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: white;
    z-index: 4;
  }

  .scan-text {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .scan-action-btn {
    position: absolute;
    padding: 10px 16px;
    font-size: 0.78rem;
    font-weight: 700;
    border-radius: var(--radius-md);
    box-shadow: 0 4px 14px rgba(91, 78, 214, 0.4);
    cursor: pointer;
    z-index: 3;
  }

  .ocr-result-panel {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.22);
    border-radius: var(--radius-md);
    padding: 10px;
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ocr-result-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    font-weight: 700;
    color: #10B981;
  }

  .ocr-check {
    font-size: 0.8rem;
  }

  .ocr-result-text {
    font-size: 0.8rem;
    font-style: italic;
    color: var(--color-text);
    margin: 0;
    word-break: break-word;
  }

  .mc-footer {
    border-top: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
    padding-top: 10px;
    display: flex;
    justify-content: flex-end;
  }

  .mc-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .mc-tag {
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--color-primary);
    background: var(--color-primary-subtle);
    padding: 2px 8px;
    border-radius: var(--radius-full);
  }

  /* Empty state playground filter results */
  .sandbox-empty {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
  }

  .se-icon {
    font-size: 2.2rem;
    margin-bottom: 8px;
    opacity: 0.6;
  }

  .se-title {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--color-text);
  }

  .se-subtitle {
    font-size: 0.82rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  /* Footer invitation */
  .landing-footer {
    text-align: center;
    padding: 48px 32px;
    border-radius: var(--radius-xl);
    border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
    background: rgba(var(--color-surface-raw), 0.4);
    max-width: 800px;
    margin: 40px auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    box-shadow: var(--shadow-lg);
  }

  .landing-footer h3 {
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--color-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .landing-footer p {
    font-size: 0.95rem;
    color: var(--color-text-secondary);
    margin: 0 0 12px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: ocr-spin 0.8s linear infinite;
  }

  @keyframes ocr-spin {
    to { transform: rotate(360deg); }
  }

  /* Dark mode overrides for landing page */
  :global([data-theme='dark']) .laser-scanner {
    background: #00F0FF;
    box-shadow: 0 0 10px #00F0FF, 0 0 4px #00F0FF;
  }

  /* Mobile and Tablet Responsive Adjustments */
  @media (max-width: 768px) {
    .landing-container {
      padding: 40px 16px 80px; /* Extra bottom padding prevents overlapping with BottomNav */
    }

    .hero-section {
      margin-bottom: 48px;
    }

    .pillars-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .pillar-card {
      padding: 24px;
    }

    .sandbox-section {
      margin-bottom: 60px;
    }

    /* Sandbox Viewport Mobile Styling */
    .sandbox-viewport {
      border-radius: var(--radius-lg);
    }

    .viewport-header {
      padding: 10px 14px;
    }

    .mac-buttons {
      margin-right: 12px;
      gap: 6px;
    }

    .mac-buttons .dot {
      width: 8px;
      height: 8px;
    }

    .viewport-address {
      padding: 4px 12px;
      font-size: 0.68rem;
    }

    .viewport-toolbar {
      flex-direction: column;
      align-items: stretch;
      padding: 12px;
      gap: 12px;
    }

    .sandbox-search-bar {
      min-width: 0;
      max-width: none;
      width: 100%;
    }

    .sandbox-filters {
      justify-content: center;
      width: 100%;
      gap: 6px;
    }

    .chip-filter {
      padding: 5px 12px;
      font-size: 0.74rem;
      text-align: center;
    }

    .sandbox-grid {
      grid-template-columns: 1fr;
      padding: 16px;
      gap: 16px;
      min-height: auto;
    }

    .mock-card {
      padding: 14px;
      gap: 10px;
    }

    .mc-quote {
      padding: 6px 10px;
      font-size: 0.78rem;
    }

    /* Invitation Footer */
    .landing-footer {
      padding: 32px 20px;
      margin-top: 20px;
      gap: 8px;
    }

    .landing-footer h3 {
      font-size: 1.25rem;
    }

    .landing-footer p {
      font-size: 0.88rem;
      margin-bottom: 8px;
    }
  }

  @media (max-width: 480px) {
    .landing-container {
      padding: 30px 12px 90px;
    }

    .mac-buttons {
      margin-right: 8px;
      gap: 4px;
    }

    .mac-buttons .dot {
      width: 7px;
      height: 7px;
    }

    .viewport-address {
      font-size: 0.65rem;
      padding: 3px 8px;
    }

    .sandbox-grid {
      padding: 12px;
      gap: 12px;
    }

    .chip-filter {
      padding: 4px 10px;
      font-size: 0.72rem;
    }
  }
</style>
