<script lang="ts">
  import { t } from '$lib/i18n';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';
  import { collections, addCollection } from '$lib/stores/collections';
  import { activeCaptures } from '$lib/stores/captures';
  import { requestProFeature } from '$lib/pro';
  import { resolvedTheme } from '$lib/theme';
  import NavIcon from '$lib/components/NavIcon.svelte';
  import { getOverdueCount } from '$lib/reminders';
  import { onMount } from 'svelte';

  interface NavItem {
    href: string;
    icon: string;
    label: string;
  }

  const mainItems: NavItem[] = [
    { href: '/', icon: 'all', label: t('nav.allCaptures') }
  ];

  const typeItems: NavItem[] = [
    { href: '/links', icon: 'link', label: t('nav.links') },
    { href: '/quotes', icon: 'quote', label: t('nav.quotes') },
    { href: '/notes', icon: 'note', label: t('nav.notes') },
    { href: '/images', icon: 'image', label: t('nav.images') }
  ];

  let collapsed = $state(false);
  let isAdding = $state(false);
  let newName = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);
  let overdueCount = $state(0);

  onMount(() => {
    async function fetchCount() {
      overdueCount = await getOverdueCount();
    }
    fetchCount();
    // Refresh every minute
    const interval = setInterval(async () => {
      await fetchCount();
    }, 60000);
    return () => clearInterval(interval);
  });

  const utilityItems: NavItem[] = [
    { href: '/reminders', icon: 'reminder', label: 'Reminders' },
    { href: '/archived', icon: 'archived', label: t('status.archived') },
    { href: '/trash', icon: 'trash', label: t('nav.trash') }
  ];

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  async function startAdding() {
    const allowed = await requestProFeature('collections', 'Collections');
    if (!allowed) return;
    isAdding = true;
    await tick();
    inputEl?.focus();
  }

  async function handleCollectionKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (newName.trim()) {
        await addCollection(newName.trim());
      }
      cancelAdding();
      return;
    }

    if (e.key === 'Escape') {
      cancelAdding();
    }
  }

  function cancelAdding() {
    isAdding = false;
    newName = '';
  }
</script>

<aside class="sidebar" class:collapsed role="navigation" aria-label="Main navigation">
  <div class="sidebar-header">
    <a href="/" class="logo" aria-label="Motif Home">
      <img src={$resolvedTheme === 'dark' ? '/logo-dark.png' : '/logo-light.png'} alt="Motif Logo" class="logo-img" />
      {#if !collapsed}
        <span class="logo-text">Motif</span>
      {/if}
    </a>
    <button
      class="collapse-btn"
      onclick={() => (collapsed = !collapsed)}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? '→' : '←'}
    </button>
  </div>

  <nav class="sidebar-nav">
    <div class="group">
      {#if !collapsed}
        <p class="group-title">Main</p>
      {/if}
      {#each mainItems as item}
        <a href={item.href} class="nav-item" class:active={isActive(item.href, $page.url.pathname)} title={collapsed ? item.label : undefined}>
          <span class="nav-icon"><NavIcon name={item.icon} size={18} /></span>
          {#if !collapsed}
            <span class="nav-label">{item.label}</span>
            <span class="nav-count">{$activeCaptures.length}</span>
          {/if}
        </a>
      {/each}
    </div>

    <div class="group">
      {#if !collapsed}
        <p class="group-title">By Type</p>
      {/if}
      {#each typeItems as item}
        <a href={item.href} class="nav-item" class:active={isActive(item.href, $page.url.pathname)} title={collapsed ? item.label : undefined}>
          <span class="nav-icon"><NavIcon name={item.icon} size={18} /></span>
          {#if !collapsed}<span class="nav-label">{item.label}</span>{/if}
        </a>
      {/each}
    </div>

    <div class="group">
      <div class="section-header">
        {#if !collapsed}<p class="group-title">{t('collections.title')}</p>{/if}
        <button class="add-btn" onclick={startAdding} aria-label={t('collections.add')}>+</button>
      </div>

      <div class="collections-list">
        {#each $collections as collection}
          <a
            href="/collections/{collection.id}"
            class="nav-item"
            class:active={isActive(`/collections/${collection.id}`, $page.url.pathname)}
            title={collapsed ? collection.name : undefined}
          >
            <span class="collection-dot" style="background:{collection.color}"></span>
            {#if !collapsed}<span class="nav-label">{collection.name}</span>{/if}
          </a>
        {/each}

        {#if isAdding}
          <div class="nav-item adding-item">
            <span class="collection-dot placeholder"></span>
            <input
              bind:this={inputEl}
              bind:value={newName}
              onkeydown={handleCollectionKeydown}
              onblur={cancelAdding}
              class="inline-input"
              placeholder={t('collections.namePlaceholder')}
              maxlength="30"
            />
          </div>
        {/if}
      </div>
    </div>

    <div class="group utility-group">
      {#if !collapsed}<p class="group-title">Utility</p>{/if}
      {#each utilityItems as item}
        <a href={item.href} class="nav-item" class:active={isActive(item.href, $page.url.pathname)} title={collapsed ? item.label : undefined}>
          <span class="nav-icon"><NavIcon name={item.icon} size={18} /></span>
          {#if !collapsed}<span class="nav-label">{item.label}</span>{/if}
          {#if item.href === '/reminders' && overdueCount > 0}
            <span class="overdue-badge">{overdueCount}</span>
          {/if}
        </a>
      {/each}
    </div>
  </nav>

  <div class="sidebar-footer">
    <a href="/settings" class="nav-item" class:active={isActive('/settings', $page.url.pathname)} title={collapsed ? t('nav.settings') : undefined}>
      <span class="nav-icon"><NavIcon name="settings" size={18} /></span>
      {#if !collapsed}<span class="nav-label">{t('nav.settings')}</span>{/if}
    </a>
    {#if !collapsed}
      <p class="privacy-note">🛡 We collect zero data. Everything stays on your device.</p>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    display:flex;
    flex-direction:column;
    width:270px;
    height:100vh;
    background:var(--color-surface);
    border-right:1px solid var(--color-border);
    padding:14px 12px;
    position:sticky;
    top:0;
    flex-shrink:0;
    z-index:40;
    transition:width var(--duration-normal) var(--ease-out);
  }

  .sidebar.collapsed { width:72px; }

  .sidebar-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:4px 4px 16px;
  }

  .logo {
    display:flex;
    align-items:center;
    gap:10px;
    text-decoration:none;
  }

  .logo-img { width:30px; height:30px; object-fit:contain; }
  .logo-text { font-size:1.2rem; font-weight:700; color:var(--color-text); letter-spacing:-0.02em; }

  .collapse-btn {
    background:none;
    border:none;
    width:28px;
    height:28px;
    border-radius:var(--radius-sm);
    color:var(--color-text-secondary);
    cursor:pointer;
  }

  .collapse-btn:hover { background:var(--color-primary-subtle); color:var(--color-primary); }

  .sidebar-nav {
    flex:1;
    overflow-y:auto;
    display:flex;
    flex-direction:column;
    gap:14px;
    padding-right:2px;
  }

  .group { display:flex; flex-direction:column; gap:2px; }
  .group-title {
    margin:0 12px 4px;
    font-size:0.68rem;
    text-transform:uppercase;
    letter-spacing:0.06em;
    font-weight:700;
    color:var(--color-text-secondary);
  }

  .section-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding-right:8px;
  }

  .add-btn {
    width:20px;
    height:20px;
    border:none;
    border-radius:var(--radius-sm);
    background:none;
    color:var(--color-text-secondary);
    cursor:pointer;
    font-size:1rem;
    line-height:1;
  }

  .add-btn:hover { background:var(--color-primary-subtle); color:var(--color-primary); }

  .nav-item {
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border-radius:var(--radius-md);
    color:var(--color-text-secondary);
    text-decoration:none;
    font-size:0.875rem;
    font-weight:500;
    position:relative;
    transition:all var(--duration-fast) var(--ease-out);
  }

  .nav-item:hover { background:var(--color-primary-subtle); color:var(--color-text); }

  .nav-item.active {
    background:var(--color-primary-subtle);
    color:var(--color-primary);
    font-weight:600;
  }

  .nav-item.active::before {
    content:'';
    position:absolute;
    left:0;
    top:50%;
    transform:translateY(-50%);
    width:3px;
    height:20px;
    background:var(--color-primary);
    border-radius:0 var(--radius-full) var(--radius-full) 0;
  }

  .nav-icon {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .nav-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  .nav-count {
    margin-left:auto;
    font-size:0.75rem;
    padding:1px 8px;
    border-radius:var(--radius-full);
    color:var(--color-primary);
    background:color-mix(in srgb, var(--color-primary) 14%, transparent);
  }

  .overdue-badge {
    margin-left:auto;
    min-width:18px;
    height:18px;
    padding:0 5px;
    border-radius:var(--radius-full);
    background:#f59e0b;
    color:#fff;
    font-size:0.7rem;
    font-weight:800;
    display:inline-flex;
    align-items:center;
    justify-content:center;
  }

  .collections-list { display:flex; flex-direction:column; gap:2px; }
  .collection-dot {
    width:8px;
    height:8px;
    border-radius:50%;
    margin-left:6px;
    flex-shrink:0;
  }

  .collection-dot.placeholder {
    background:var(--color-border);
  }

  .adding-item { gap:8px; }

  .inline-input {
    width:100%;
    border:none;
    border-bottom:1px solid var(--color-primary);
    background:none;
    color:var(--color-text);
    font-size:0.875rem;
    padding:0;
    outline:none;
    font-family:var(--font-sans);
  }

  .utility-group {
    border-top:1px solid var(--color-border);
    padding-top:10px;
  }

  .sidebar-footer {
    border-top:1px solid var(--color-border);
    margin-top:8px;
    padding-top:10px;
  }

  .privacy-note {
    margin: 8px 12px 0;
    font-size: 0.72rem;
    line-height: 1.4;
    color: var(--color-text-secondary);
  }

  @media (max-width: 768px) {
    .sidebar { display:none; }
  }

  @media (min-width: 1280px) {
    .nav-item {
      padding: 11px 12px;
    }
  }
</style>
