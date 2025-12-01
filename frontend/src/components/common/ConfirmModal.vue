<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="handleCancel">
        <div class="confirm-modal" @click.stop role="dialog" aria-modal="true" :aria-labelledby="'confirm-title-' + modalId">
          <div class="confirm-header">
            <div class="confirm-icon" :class="`icon-${type}`">
              <svg v-if="type === 'danger'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <svg v-else-if="type === 'warning'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <svg v-else fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 :id="'confirm-title-' + modalId" class="confirm-title">{{ title }}</h3>
          </div>
          
          <div class="confirm-body">
            <p v-if="message" class="confirm-message">{{ message }}</p>
            <p v-if="description" class="confirm-description">{{ description }}</p>
          </div>
          
          <div class="confirm-actions">
            <button
              type="button"
              class="btn-cancel"
              @click="handleCancel"
              ref="cancelButtonRef"
            >
              {{ cancelText }}
            </button>
            <button
              type="button"
              :class="['btn-confirm', `btn-confirm-${type}`]"
              @click="handleConfirm"
              :disabled="loading"
            >
              <span v-if="loading" class="loading-spinner-small"></span>
              <span>{{ confirmText }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Bevestigen',
  },
  message: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  confirmText: {
    type: String,
    default: 'Bevestigen',
  },
  cancelText: {
    type: String,
    default: 'Annuleren',
  },
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['info', 'warning', 'danger'].includes(value),
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['confirm', 'cancel', 'update:isOpen']);

const modalId = ref(Math.random().toString(36).substr(2, 9));
const cancelButtonRef = ref(null);

function handleConfirm() {
  emit('confirm');
}

function handleCancel() {
  emit('cancel');
  emit('update:isOpen', false);
}

// Handle escape key
function handleEscape(e) {
  if (e.key === 'Escape' && props.isOpen) {
    handleCancel();
  }
}

// Focus management
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    // Focus cancel button by default
    if (cancelButtonRef.value) {
      cancelButtonRef.value.focus();
    }
    // Add escape listener
    document.addEventListener('keydown', handleEscape);
  } else {
    document.removeEventListener('keydown', handleEscape);
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--spacing-4);
  backdrop-filter: blur(4px);
}

.confirm-modal {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid var(--color-border);
}

.confirm-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--color-border);
}

.confirm-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-top: 2px;
}

.confirm-icon.icon-danger {
  color: var(--color-error);
}

.confirm-icon.icon-warning {
  color: var(--color-warning);
}

.confirm-icon.icon-info {
  color: var(--color-info);
}

.confirm-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  flex: 1;
}

.confirm-body {
  padding: var(--spacing-6);
}

.confirm-message {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-3) 0;
  line-height: var(--line-height-relaxed);
}

.confirm-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-relaxed);
}

.confirm-actions {
  display: flex;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  border-top: 1px solid var(--color-border);
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  min-width: 100px;
  justify-content: center;
}

.btn-cancel {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.btn-cancel:hover {
  background: var(--color-border);
}

.btn-confirm {
  color: var(--color-text-inverse);
}

.btn-confirm-info {
  background: var(--color-info);
}

.btn-confirm-info:hover {
  background: #2563EB;
}

.btn-confirm-warning {
  background: var(--color-warning);
}

.btn-confirm-warning:hover {
  background: #D97706;
}

.btn-confirm-danger {
  background: var(--color-error);
}

.btn-confirm-danger:hover {
  background: #DC2626;
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-base);
}

.modal-enter-active .confirm-modal,
.modal-leave-active .confirm-modal {
  transition: transform var(--transition-base), opacity var(--transition-base);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .confirm-modal,
.modal-leave-to .confirm-modal {
  opacity: 0;
  transform: scale(0.95);
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: var(--spacing-2);
  }
  
  .confirm-modal {
    max-width: 100%;
  }
  
  .confirm-header,
  .confirm-body,
  .confirm-actions {
    padding: var(--spacing-4);
  }
  
  .confirm-actions {
    flex-direction: column-reverse;
  }
  
  .btn-cancel,
  .btn-confirm {
    width: 100%;
  }
}
</style>

