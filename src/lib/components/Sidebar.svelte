<script lang="ts">
  import { t } from '$lib/i18n';
  import { page } from '$app/stores';
  import { collections, addCollection } from '$lib/stores/collections';
  import { isProUnlocked } from '$lib/pro';
  import { resolvedTheme } from '$lib/theme';
  import { tick } from 'svelte';

  interface NavItem {
    href: string;
    icon: string;
    label: string;
    key: string;
  }

  const navItems: NavItem[] = [
    { href: '/', icon: '⊞', label: t('nav.allCaptures'), key: 'all' },
    { href: '/links', icon: '🔗', label: t('nav.links'), key: 'links' },
    { href: '/quotes', icon: '❝', label: t('nav.quotes'), key: 'quotes' },
    { href: '/notes', icon: '✎', label: t('nav.notes'), key: 'notes' },
    { href: '/images', icon: '◻', label: t('nav.images'), key: 'images' },
    { href: '/trash', icon: '🗑', label: t('nav.trash'), key: 'trash' },
    { href: '/settings', icon: '⚙', label: t('nav.settings'), key: 'settings' }
  ];

  let collapsed = $state(false);
  let isAdding = $state(false);
  let newName = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  async function startAdding() {
    if (!isProUnlocked()) {
      // Redirect or show pro info (simplified for now)
      void goto('/settings');
      return;
    }
    isAdding = true;
    await tick();
    inputEl?.focus();
  }

  async function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (newName.trim()) {
        await addCollection(newName.trim());
      }
      cancelAdding();
    } else if (e.key === 'Escape') {
      cancelAdding();
    }
  }

  function cancelAdding() {
    isAdding = false;
    newName = '';
  }

  import { goto } from '$app/navigation';
</script>

<aside
  class="sidebar"
  class:collapsed
  role="navigation"
  aria-label="Main navigation"
>
  <!-- Logo -->
  <div class="sidebar-header">
    <div class="logo">
      <img src={$resolvedTheme === 'dark' ? '/logo-dark.png' : '/logo-light.png'} alt="Motif Logo" class="logo-img" />
      {#if !collapsed}
        <span class="logo-text">Motif</span>
      {/if}
    </div>
    <button
      class="collapse-btn"
      onclick={() => collapsed = !collapsed}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? '→' : '←'}
    </button>
  </div>

  <!-- Nav items -->
  <nav class="sidebar-nav">
    {#each navItems as item}
      <a
        href={item.href}
        class="nav-item"
        class:active={isActive(item.href, $page.url.pathname)}
        title={collapsed ? item.label : undefined}
        id={item.key === 'settings' ? 'nav-settings' : undefined}
      >
        <span class="nav-icon">{item.icon}</span>
        {#if !collapsed}
          <span class="nav-label">{item.label}</span>
        {/if}
      </a>
    {/each}

    <div class="sidebar-divider"></div>

    <!-- Collections -->
    <div class="sidebar-section">
      <div class="section-header">
        {#if !collapsed}<h3 class="section-title">{t('collections.title')}</h3>{/if}
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
            <span class="nav-icon" style="color: {collection.color}">●</span>
            {#if !collapsed}
              <span class="nav-label">{collection.name}</span>
            {/if}
          </a>
        {/each}

        {#if isAdding}
          <div class="nav-item adding-item">
            <span class="nav-icon">●</span>
            <input
              bind:this={inputEl}
              bind:value={newName}
              onkeydown={handleKeydown}
              onblur={cancelAdding}
              class="inline-input"
              placeholder={t('collections.namePlaceholder')}
              maxlength="30"
            />
          </div>
        {/if}
      </div>
    </div>
  </nav>

  <!-- Bottom section -->
  <div class="sidebar-footer">
    {#if !collapsed}
      <div class="privacy-badge">
        <span class="privacy-icon">🛡</span>
        <span class="privacy-text">{t('settings.privacyStatement')}</span>
      </div>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 260px;
    height: 100vh;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    padding: 16px 12px;
    transition: width var(--duration-normal) var(--ease-out);
    position: sticky;
    top: 0;
    flex-shrink: 0;
    z-index: 40;
  }

  .sidebar.collapsed {
    width: 68px;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 20px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-img {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .logo-text {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .collapse-btn {
    background: none;
    border: none;
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    transition: background var(--duration-fast) var(--ease-out);
  }

  .collapse-btn:hover {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }

  .sidebar-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    text-decoration: none;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    transition: all var(--duration-fast) var(--ease-out);
    position: relative;
  }

  .nav-item:hover {
    background: var(--color-primary-subtle);
    color: var(--color-text);
  }

  .nav-item.active {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    font-weight: 600;
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: var(--color-primary);
    border-radius: 0 var(--radius-full) var(--radius-full) 0;
  }

  .nav-icon {
    font-size: 1.125rem;
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-divider {
    height: 1px;
    background: var(--color-border);
    margin: 12px 12px;
    opacity: 0.5;
  }

  .sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px 4px;
  }

  .section-title {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .add-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.125rem;
    color: var(--color-text-secondary);
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast);
  }

  .add-btn:hover {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }

  .collections-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .adding-item {
    padding: 6px 12px;
  }

  .inline-input {
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-primary);
    color: var(--color-text);
    font-size: 0.875rem;
    font-family: var(--font-sans);
    padding: 0;
    width: 100%;
    outline: none;
  }

  .sidebar-footer {
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
    margin-top: 8px;
  }

  .privacy-badge {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px;
    background: var(--color-primary-subtle);
    border-radius: var(--radius-md);
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .privacy-icon {
    font-size: 0.875rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .privacy-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 768px) {
    .sidebar {
      display: none;
    }
  }
</style>
