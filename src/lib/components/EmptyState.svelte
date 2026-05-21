<script lang="ts">
  let {
    icon = '📭',
    title,
    hint = '',
    actionLabel = '',
    onAction
  }: {
    icon?: string;
    title: string;
    hint?: string;
    actionLabel?: string;
    onAction?: () => void;
  } = $props();
</script>

<div class="empty-state fade-in">
  <div class="empty-icon">{icon}</div>
  <h3 class="empty-title">{title}</h3>
  {#if hint}
    <p class="empty-hint">{hint}</p>
  {/if}
  {#if actionLabel && onAction}
    <button class="empty-action" onclick={onAction}>{actionLabel}</button>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 64px 24px;
    gap: 12px;
    min-height: 280px;
    user-select: none;
  }

  .empty-icon {
    font-size: 3rem;
    line-height: 1;
    margin-bottom: 4px;
    filter: grayscale(0.2);
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
  }

  .empty-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .empty-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    max-width: 300px;
    line-height: 1.5;
  }

  .empty-action {
    margin-top: 8px;
    padding: 10px 22px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .empty-action:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 40%, transparent);
  }

  .empty-action:active { transform: translateY(0); }
</style>
