<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click="handleOverlayClick" @keydown.esc="handleEscape">
        <div 
          class="modal" 
          :class="{ 'modal-large': large, 'modal-small': small }"
          @click.stop
          role="dialog"
          :aria-labelledby="title ? 'modal-title' : undefined"
          :aria-describedby="description ? 'modal-description' : undefined"
        >
          <div class="modal-header" v-if="title || showClose">
            <h2 v-if="title" id="modal-title" class="modal-title">{{ title }}</h2>
            <button 
              v-if="showClose"
              @click="handleClose"
              class="modal-close"
              aria-label="Sluiten"
              type="button"
            >
              ×
            </button>
          </div>
          <div class="modal-body" :id="description ? 'modal-description' : undefined">
            <slot></slot>
          </div>
          <div class="modal-footer" v-if="$slots.footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  showClose: {
    type: Boolean,
    default: true,
  },
  closeOnOverlay: {
    type: Boolean,
    default: true,
  },
  closeOnEscape: {
    type: Boolean,
    default: true,
  },
  large: {
    type: Boolean,
    default: false,
  },
  small: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'update:isOpen']);

let previousActiveElement = null;

function handleClose() {
  emit('close');
  emit('update:isOpen', false);
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    handleClose();
  }
}

function handleEscape(event) {
  if (props.closeOnEscape && props.isOpen) {
    event.preventDefault();
    handleClose();
  }
}

function trapFocus(event) {
  if (!props.isOpen) return;
  
  const modal = event.currentTarget.querySelector('.modal');
  if (!modal) return;
  
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (event.key === 'Tab') {
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Store previous active element
    previousActiveElement = document.activeElement;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Focus modal after render
    await nextTick();
    const modal = document.querySelector('.modal');
    if (modal) {
      const firstFocusable = modal.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  } else {
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Restore focus to previous element
    if (previousActiveElement) {
      previousActiveElement.focus();
      previousActiveElement = null;
    }
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
  document.addEventListener('keydown', trapFocus);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
  document.removeEventListener('keydown', trapFocus);
  document.body.style.overflow = '';
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
  z-index: 1000;
  padding: var(--spacing-4);
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-large {
  max-width: 900px;
}

.modal-small {
  max-width: 400px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
}

.modal-close:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.modal-body {
  padding: var(--spacing-6);
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: var(--spacing-6);
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: var(--spacing-3);
  justify-content: flex-end;
}

/* Enhanced Transitions */
.modal-enter-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.modal-enter-active .modal {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-leave-active .modal {
  transition: transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.modal-enter-from {
  opacity: 0;
}

.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}

.modal-leave-to .modal {
  transform: scale(0.98) translateY(5px);
  opacity: 0;
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: var(--spacing-2);
  }
  
  .modal {
    max-height: 95vh;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: var(--spacing-4);
  }
}
</style>

