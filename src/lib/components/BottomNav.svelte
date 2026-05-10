<script lang="ts">
  import { t } from '$lib/i18n';
  import { page } from '$app/stores';

  interface NavItem {
    href: string;
    icon: string;
    label: string;
  }

  const navItems: NavItem[] = [
    { href: '/', icon: '⊞', label: t('nav.allCaptures') },
    { href: '/links', icon: '🔗', label: t('nav.links') },
    { href: '/quotes', icon: '❝', label: t('nav.quotes') },
    { href: '/notes', icon: '✎', label: t('nav.notes') },
    { href: '/images', icon: '◻', label: t('nav.images') },
    { href: '/trash', icon: '🗑', label: t('nav.trash') },
    { href: '/settings', icon: '⚙', label: t('nav.settings') }
  ];

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }
</script>

<nav class="bottom-nav" role="navigation" aria-label="Main navigation">
  {#each navItems as item}
    <a
      href={item.href}
      class="bottom-nav-item"
      class:active={isActive(item.href, $page.url.pathname)}
    >
      <span class="bottom-nav-icon">{item.icon}</span>
      <span class="bottom-nav-label">{item.label}</span>
    </a>
  {/each}
</nav>

<style>
  .bottom-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(68px + env(safe-area-inset-bottom, 0px));
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    z-index: 50;
    padding: 0 4px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  @media (max-width: 768px) {
    .bottom-nav {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      /* Smooth scrolling hint */
      mask-image: linear-gradient(to right, black 90%, transparent 100%);
      -webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%);
    }
    .bottom-nav::-webkit-scrollbar {
      display: none;
    }
  }

  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 12px;
    text-decoration: none;
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 500;
    transition: all var(--duration-fast) var(--ease-out);
    position: relative;
    min-width: 72px;
    height: 100%;
    flex-shrink: 0;
  }

  .bottom-nav-item:hover {
    color: var(--color-text);
  }

  .bottom-nav-item.active {
    color: var(--color-primary);
  }

  .bottom-nav-item.active::after {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
    height: 3px;
    background: var(--color-primary);
    border-radius: 0 0 var(--radius-full) var(--radius-full);
  }

  .bottom-nav-icon {
    font-size: 24px;
    line-height: 1;
  }

  .bottom-nav-label {
    white-space: nowrap;
    letter-spacing: -0.01em;
  }
</style>
