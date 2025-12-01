<template>
  <div class="loading-spinner" :class="{ 'loading-spinner-small': small, 'loading-spinner-large': large }">
    <div class="spinner" :class="{ 'spinner-small': small, 'spinner-large': large }"></div>
    <p v-if="message" class="loading-message">{{ message }}</p>
  </div>
</template>

<script setup>
defineProps({
  message: {
    type: String,
    default: '',
  },
  small: {
    type: Boolean,
    default: false,
  },
  large: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-8);
  gap: var(--spacing-4);
}

.loading-spinner-small {
  padding: var(--spacing-4);
  gap: var(--spacing-2);
}

.loading-spinner-large {
  padding: var(--spacing-12);
  gap: var(--spacing-6);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-bg-tertiary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-small {
  width: 24px;
  height: 24px;
  border-width: 3px;
}

.spinner-large {
  width: 56px;
  height: 56px;
  border-width: 5px;
}

.loading-message {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
  text-align: center;
}

.loading-spinner-small .loading-message {
  font-size: var(--font-size-xs);
}

.loading-spinner-large .loading-message {
  font-size: var(--font-size-base);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

