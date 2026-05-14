<script lang="ts">
  import { t } from '$lib/i18n';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { collections } from '$lib/stores/collections';
  import NavIcon from '$lib/components/NavIcon.svelte';

  let moreOpen = $state(false);

  $effect(() => {
    $page.url.pathname;
    moreOpen = false;
  });

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const moreItems = [
    { href: '/quotes', icon: 'quote', label: t('nav.quotes') },
    { href: '/notes', icon: 'note', label: t('nav.notes') },
    { href: '/images', icon: 'image', label: t('nav.images') },
    { href: '/archived', icon: 'archived', label: t('status.archived') },
    { href: '/trash', icon: 'trash', label: t('nav.trash') },
    { href: '/settings', icon: 'settings', label: t('nav.settings') }
  ];
</script>

{#if moreOpen}
  <button class="sheet-backdrop" aria-label="Close menu" onclick={() => (moreOpen = false)}></button>
  <div class="more-sheet slide-up">
    <p class="sheet-title">More</p>
    <div class="sheet-grid">
      {#each moreItems as item}
        <a href={item.href} class="sheet-item" class:active={isActive(item.href, $page.url.pathname)}>
          <span class="sheet-icon"><NavIcon name={item.icon} size={17} /></span>
          <span>{item.label}</span>
        </a>
      {/each}

      {#if $collections.length > 0}
        <a href={`/collections/${$collections[0].id}`} class="sheet-item" title={t('nav.collections')}>
          <span class="sheet-icon"><NavIcon name="collections" size={17} /></span>
          <span>{t('nav.collections')}</span>
        </a>
      {:else}
        <a href="/settings" class="sheet-item" title={t('nav.collections')}>
          <span class="sheet-icon"><NavIcon name="collections" size={17} /></span>
          <span>{t('nav.collections')}</span>
        </a>
      {/if}
    </div>
  </div>
{/if}

<nav class="bottom-nav" aria-label="Main navigation">
  <a href="/" class="bottom-item" class:active={isActive('/', $page.url.pathname)}>
    <span class="bottom-icon"><NavIcon name="home" size={20} /></span>
    <span class="bottom-label">Home</span>
  </a>

  <a href="/links" class="bottom-item" class:active={isActive('/links', $page.url.pathname)}>
    <span class="bottom-icon"><NavIcon name="link" size={20} /></span>
    <span class="bottom-label">{t('nav.links')}</span>
  </a>

  <div class="fab-container">
    <button class="capture-fab" aria-label={t('capture.addNew')} onclick={() => goto('/?new=1')}>
      +
    </button>
  </div>

  <a href="/?focus=search" class="bottom-item" class:active={$page.url.pathname === '/' && $page.url.searchParams.get('focus') === 'search'}>
    <span class="bottom-icon"><NavIcon name="search" size={20} /></span>
    <span class="bottom-label">Search</span>
  </a>

  <button class="bottom-item more-toggle" class:active={moreOpen} onclick={() => (moreOpen = !moreOpen)}>
    <span class="bottom-icon"><NavIcon name="more" size={20} /></span>
    <span class="bottom-label">More</span>
  </button>
</nav>

<style>
  .bottom-nav {
    display:none;
    position:fixed;
    bottom:0;
    left:0;
    right:0;
    height:calc(68px + env(safe-area-inset-bottom, 0px));
    background:var(--color-surface);
    border-top:1px solid var(--color-border);
    z-index:60;
    padding:0 4px env(safe-area-inset-bottom, 0px);
    align-items:center;
    justify-content:space-between;
    backdrop-filter:blur(16px);
    -webkit-backdrop-filter:blur(16px);
  }

  @media (max-width: 768px) {
    .bottom-nav { display:flex; }
  }

  .bottom-item {
    flex:1;
    height:100%;
    border:none;
    background:none;
    text-decoration:none;
    color:var(--color-text-secondary);
    font-family:var(--font-sans);
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:4px;
    font-size:10px;
    font-weight:600;
    cursor:pointer;
    transition:all var(--duration-fast);
    position:relative;
  }

  .bottom-item.active { color:var(--color-primary); }
  
  .bottom-item.active::after {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 3px;
    background: var(--color-primary);
    border-radius: 0 0 4px 4px;
  }

  .bottom-icon {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: transform 0.2s var(--ease-out);
  }

  .bottom-item:active .bottom-icon {
    transform: scale(0.9);
  }

  .fab-container {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    height: 100%;
  }

  .capture-fab {
    width:52px;
    height:52px;
    border-radius:50%;
    margin-top:-28px;
    border:none;
    background:var(--color-primary);
    color:#fff;
    text-decoration:none;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:2rem;
    line-height:1;
    box-shadow: 0 8px 20px rgba(91, 78, 214, 0.4);
    flex-shrink:0;
    transition: all 0.2s var(--ease-out);
    z-index: 2;
  }

  .capture-fab:active { 
    transform: scale(0.92) translateY(2px);
    box-shadow: 0 4px 10px rgba(91, 78, 214, 0.3);
  }

  .more-toggle {
    border-radius:var(--radius-sm);
  }

  .sheet-backdrop {
    position:fixed;
    inset:0;
    border:none;
    background:rgba(8, 8, 16, 0.4);
    z-index:58;
    backdrop-filter: blur(2px);
  }

  .more-sheet {
    position:fixed;
    left:12px;
    right:12px;
    bottom:calc(80px + env(safe-area-inset-bottom, 0px));
    background:var(--color-surface);
    border:1px solid var(--color-border);
    border-radius:var(--radius-xl);
    box-shadow:var(--shadow-xl);
    padding:16px;
    z-index:59;
  }

  .sheet-title {
    margin:0 0 10px;
    font-size:0.75rem;
    text-transform:uppercase;
    letter-spacing:0.06em;
    color:var(--color-text-secondary);
    font-weight:700;
  }

  .sheet-grid {
    display:grid;
    grid-template-columns:repeat(3, minmax(0, 1fr));
    gap:10px;
  }

  .sheet-item {
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:6px;
    min-height:74px;
    border:1px solid var(--color-border);
    border-radius:var(--radius-md);
    text-decoration:none;
    color:var(--color-text-secondary);
    font-size:12px;
    font-weight:600;
    background:var(--color-bg);
  }

  .sheet-item.active {
    border-color:var(--color-primary);
    color:var(--color-primary);
    background:var(--color-primary-subtle);
  }

  .sheet-icon {
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
</style>
