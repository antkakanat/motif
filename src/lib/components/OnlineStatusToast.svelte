<script lang="ts">
  import { onMount } from 'svelte';

  let show = $state(false);

  onMount(() => {
    const handleOnline = () => {
      show = true;
      setTimeout(() => {
        show = false;
      }, 3000);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  });
</script>

{#if show}
  <div class="online-toast" role="status">
    <span class="check">✓</span>
    <span>Back online</span>
  </div>
{/if}

<style>
  .online-toast {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #10B981;
    color: white;
    padding: 8px 16px;
    border-radius: var(--radius-full);
    font-size: 0.81rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    animation: fadeInOut 3s forwards;
  }

  .check {
    font-size: 1rem;
  }

  @keyframes fadeInOut {
    0% { transform: translate(-50%, -20px); opacity: 0; }
    10% { transform: translate(-50%, 0); opacity: 1; }
    90% { transform: translate(-50%, 0); opacity: 1; }
    100% { transform: translate(-50%, -20px); opacity: 0; }
  }
</style>
