<script lang="ts">
  import { toastMessage } from '$lib/stores/toast';
</script>

{#if $toastMessage}
  <div class="toast slide-up">
    <span class="toast-icon">✓</span>
    <span class="toast-text">{$toastMessage}</span>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--color-text);
    color: var(--color-bg);
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: var(--shadow-lg);
    z-index: 200;
    pointer-events: none;
    animation: toast-in 0.3s var(--ease-out);
  }

  .toast-icon {
    font-size: 1rem;
    color: #22C55E;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (max-width: 768px) {
    .toast {
      bottom: 80px; /* above bottom nav */
    }
  }
</style>
