<script lang="ts">
  let {
    open = $bindable(false),
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm
  }: {
    open?: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm?: () => void;
  } = $props();

  function close() {
    open = false;
  }

  function confirm() {
    open = false;
    onConfirm?.();
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) close();
  }

  $effect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onEscape);
    };
  });
</script>

{#if open}
  <div class="modal-backdrop" onclick={onBackdropClick} role="presentation">
    <div
      class="modal"
      class:modal-danger={danger}
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div class="modal-content">
        <div class="modal-icon" aria-hidden="true">
          {#if danger}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          {/if}
        </div>

        <h2 id="confirm-modal-title" class="modal-title">{title}</h2>
        <p id="confirm-modal-desc" class="modal-message">{message}</p>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn secondary modal-btn" onclick={close}>{cancelLabel}</button>
        <button type="button" class="btn modal-btn" class:danger={danger} onclick={confirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
