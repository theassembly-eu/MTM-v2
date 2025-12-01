<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'btn',
      `btn-${variant}`,
      {
        'btn-small': small,
        'btn-large': large,
        'btn-full-width': fullWidth,
        'btn-loading': loading,
      }
    ]"
    @click="handleClick"
  >
    <LoadingSpinner v-if="loading" small :message="''" class="btn-spinner" />
    <span v-if="$slots.icon" class="btn-icon">
      <slot name="icon"></slot>
    </span>
    <span class="btn-text">
      <slot></slot>
    </span>
  </button>
</template>

<script setup>
import LoadingSpinner from './LoadingSpinner.vue';

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'danger', 'ghost', 'success'].includes(value),
  },
  type: {
    type: String,
    default: 'button',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  small: {
    type: Boolean,
    default: false,
  },
  large: {
    type: Boolean,
    default: false,
  },
  fullWidth: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['click']);

function handleClick(event) {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
}
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
  position: relative;
}

.btn-small {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
}

.btn-large {
  padding: var(--spacing-4) var(--spacing-6);
  font-size: var(--font-size-lg);
}

.btn-full-width {
  width: 100%;
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.btn-primary:hover:not(:disabled) {
  background: #2563EB;
}

.btn-secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.btn-danger {
  background: var(--color-error);
  color: var(--color-text-inverse);
}

.btn-danger:hover:not(:disabled) {
  background: #DC2626;
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-primary);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.btn-success {
  background: var(--color-success);
  color: var(--color-text-inverse);
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn:disabled,
.btn-loading {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  padding: 0;
  gap: 0;
}

.btn-spinner :deep(.spinner) {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.btn-icon {
  display: flex;
  align-items: center;
}

.btn-text {
  flex: 1;
}
</style>

