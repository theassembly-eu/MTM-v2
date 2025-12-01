<template>
  <div class="search-input-wrapper">
    <label v-if="label" :for="inputId" class="search-label">{{ label }}</label>
    <div class="search-input-container">
      <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        :id="inputId"
        type="text"
        :value="modelValue"
        @input="handleInput"
        :placeholder="placeholder"
        :disabled="disabled"
        class="search-input"
        :class="{ 'search-input-disabled': disabled }"
      />
      <button
        v-if="modelValue && clearable"
        @click="clear"
        class="search-clear"
        type="button"
        aria-label="Zoekopdracht wissen"
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: 'Zoeken...',
  },
  label: {
    type: String,
    default: '',
  },
  debounce: {
    type: Number,
    default: 300,
  },
  clearable: {
    type: Boolean,
    default: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'search']);

const inputId = computed(() => `search-${Math.random().toString(36).substr(2, 9)}`);

let debounceTimer = null;

function handleInput(event) {
  const value = event.target.value;
  emit('update:modelValue', value);
  
  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Set new timer
  debounceTimer = setTimeout(() => {
    emit('search', value);
  }, props.debounce);
}

function clear() {
  emit('update:modelValue', '');
  emit('search', '');
}
</script>

<style scoped>
.search-input-wrapper {
  width: 100%;
}

.search-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--spacing-3);
  width: 20px;
  height: 20px;
  color: var(--color-text-tertiary);
  pointer-events: none;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  padding-left: calc(var(--spacing-3) * 2 + 20px);
  padding-right: calc(var(--spacing-3) * 2 + 20px);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input-disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}

.search-clear {
  position: absolute;
  right: var(--spacing-2);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
  padding: 0;
}

.search-clear:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.search-clear svg {
  width: 16px;
  height: 16px;
}
</style>

