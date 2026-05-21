<script lang="ts">
  let { name, size = 18, strokeWidth = 1.9 }: { name: string; size?: number; strokeWidth?: number } = $props();
</script>

<svg
  class="nav-svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'all'}
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
  {:else if name === 'home'}
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  {:else if name === 'link'}
    <path d="M10 14L14 10" />
    <path d="M8 17a4 4 0 0 1 0-5.7l2.3-2.3a4 4 0 0 1 5.7 5.7l-1.1 1.1" />
    <path d="M16 7a4 4 0 0 1 0 5.7l-2.3 2.3A4 4 0 0 1 8 9.3l1.1-1.1" />
  {:else if name === 'quote'}
    <path d="M9 10H7a3 3 0 0 0-3 3v1h5v-4z" />
    <path d="M20 10h-2a3 3 0 0 0-3 3v1h5v-4z" />
  {:else if name === 'note'}
    <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z" />
    <path d="M13.5 6.5l3 3" />
  {:else if name === 'image'}
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.4" />
    <path d="M21 16l-5.4-5.4L10 16l-2.2-2.2L3 18.6" />
  {:else if name === 'archived'}
    <path d="M3 7h18l-1.7 13a2 2 0 0 1-2 1.8H6.7a2 2 0 0 1-2-1.8L3 7z" />
    <path d="M2 7l1.2-3h17.6L22 7" />
    <path d="M9 12h6" />
  {:else if name === 'trash'}
    <path d="M5 7h14" />
    <path d="M8 7V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V7" />
    <path d="M7 7l.8 12.2A2 2 0 0 0 9.8 21h4.4a2 2 0 0 0 2-1.8L17 7" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  {:else if name === 'settings'}
    <circle cx="12" cy="12" r="2.8" />
    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.8 1.8 0 0 1-2.6 2.6l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.8 1.8 0 0 1-2.6-2.6l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2a1.8 1.8 0 0 1 0-3.6h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.8 1.8 0 0 1 2.6-2.6l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a1.8 1.8 0 0 1 0 3.6h-.2a1 1 0 0 0-.9.6z" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  {:else if name === 'more'}
    <circle cx="6" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="18" cy="12" r="1.4" />
  {:else if name === 'collections'}
    <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    <path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2" />
  {:else if name === 'lock'}
    <rect x="5" y="10" width="14" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  {:else if name === 'reminder'}
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  {:else}
    <circle cx="12" cy="12" r="8" />
  {/if}
</svg>

<style>
  .nav-svg {
    display: block;
    flex-shrink: 0;
  }
</style>
