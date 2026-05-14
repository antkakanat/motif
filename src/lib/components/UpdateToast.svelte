<script lang="ts">
  interface Props {
    onUpdate: () => void;
    onDismiss: () => void;
  }

  let { onUpdate, onDismiss }: Props = $props();
</script>

<div class="update-toast" role="alert">
  <div class="update-content">
    <div class="update-icon">🔄</div>
    <div class="update-text">
      <p>Motif was updated</p>
    </div>
  </div>
  <div class="update-actions">
    <button class="btn primary" onclick={onUpdate}>Reload now</button>
    <button class="btn secondary" onclick={onDismiss}>Later</button>
  </div>
</div>

<style>
  .update-toast {
    position: fixed;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    left: 20px;
    right: 20px;
    max-width: 400px;
    background: var(--color-surface);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    padding: 14px 16px;
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    animation: slideUp 0.4s var(--ease-out);
  }

  @keyframes slideUp {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .update-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .update-icon {
    font-size: 1.25rem;
  }

  .update-text p {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .update-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 6px 12px;
    border-radius: var(--radius-md);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .btn.primary {
    background: var(--color-primary);
    color: white;
  }

  .btn.secondary {
    background: var(--color-bg);
    color: var(--color-text-secondary);
    border-color: var(--color-border);
  }

  .btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  @media (min-width: 769px) {
    .update-toast { left: auto; right: 24px; bottom: 24px; }
  }
</style>
