<template>
  <TransitionGroup name="toast" tag="div" class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast', `toast-${toast.type}`]"
      @click="removeToast(toast.id)"
    >
      <div class="toast-icon">
        <svg v-if="toast.type === 'success'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-else-if="toast.type === 'error'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-else-if="toast.type === 'warning'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <svg v-else fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="toast-content">
        <p class="toast-message">{{ toast.message }}</p>
        <p v-if="toast.description" class="toast-description">{{ toast.description }}</p>
      </div>
      <button class="toast-close" @click.stop="removeToast(toast.id)" aria-label="Sluiten">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </TransitionGroup>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { registerToastCallback } from '../../composables/useToast.js';

const toasts = ref([]);
const timers = ref(new Map());

function showToast(message, type = 'info', duration = 5000, description = null) {
  const id = Date.now() + Math.random();
  const toast = {
    id,
    message,
    type,
    description,
  };
  
  toasts.value.push(toast);
  
  // Auto-remove after duration
  if (duration > 0) {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    timers.value.set(id, timer);
  }
  
  return id;
}

function removeToast(id) {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.value.splice(index, 1);
  }
  
  // Clear timer if exists
  const timer = timers.value.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.value.delete(id);
  }
}

function clearAll() {
  toasts.value.forEach(toast => {
    const timer = timers.value.get(toast.id);
    if (timer) clearTimeout(timer);
  });
  toasts.value = [];
  timers.value.clear();
}

// Register this toast instance globally
let unregisterCallback = null;

onMounted(() => {
  unregisterCallback = registerToastCallback(showToast);
});

onUnmounted(() => {
  if (unregisterCallback) {
    unregisterCallback();
  }
  clearAll();
});
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--spacing-4);
  right: var(--spacing-4);
  z-index: var(--z-tooltip);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  max-width: 420px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  pointer-events: auto;
  cursor: pointer;
  transition: all var(--transition-base);
  min-width: 300px;
  max-width: 420px;
}

.toast:hover {
  box-shadow: var(--shadow-xl);
  transform: translateY(-2px);
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-message {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-1) 0;
  line-height: var(--line-height-normal);
}

.toast-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-normal);
}

.toast-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-base);
}

.toast-close:hover {
  color: var(--color-text-primary);
}

.toast-close svg {
  width: 16px;
  height: 16px;
}

/* Toast Types */
.toast-success {
  border-left: 4px solid var(--color-success);
}

.toast-success .toast-icon {
  color: var(--color-success);
}

.toast-error {
  border-left: 4px solid var(--color-error);
}

.toast-error .toast-icon {
  color: var(--color-error);
}

.toast-warning {
  border-left: 4px solid var(--color-warning);
}

.toast-warning .toast-icon {
  color: var(--color-warning);
}

.toast-info {
  border-left: 4px solid var(--color-info);
}

.toast-info .toast-icon {
  color: var(--color-info);
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all var(--transition-base);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform var(--transition-base);
}

@media (max-width: 640px) {
  .toast-container {
    top: var(--spacing-2);
    right: var(--spacing-2);
    left: var(--spacing-2);
    max-width: none;
  }
  
  .toast {
    min-width: 0;
    max-width: none;
  }
}
</style>

