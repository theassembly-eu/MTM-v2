<template>
  <div :class="['empty-state', { 'empty-state-small': small }]">
    <div class="empty-state-icon" v-if="icon">
      <span class="icon-emoji">{{ icon }}</span>
    </div>
    <div class="empty-state-content">
      <h3 class="empty-state-title">{{ title }}</h3>
      <p v-if="description" class="empty-state-description">{{ description }}</p>
      <div v-if="actionLabel && actionHandler" class="empty-state-action">
        <button @click="actionHandler" class="btn-primary">
          {{ actionLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icon: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  actionLabel: {
    type: String,
    default: '',
  },
  actionHandler: {
    type: Function,
    default: null,
  },
  small: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-16) var(--spacing-8);
  text-align: center;
  min-height: 300px;
}

.empty-state-icon {
  margin-bottom: var(--spacing-6);
}

.icon-emoji {
  font-size: 4rem;
  line-height: 1;
  display: block;
}

.empty-state-content {
  max-width: 400px;
}

.empty-state-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-3) 0;
}

.empty-state-description {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-6) 0;
  line-height: var(--line-height-relaxed);
}

.empty-state-action {
  margin-top: var(--spacing-4);
}

.empty-state-small {
  min-height: 150px;
  padding: var(--spacing-6) var(--spacing-4);
}

.empty-state-small .icon-emoji {
  font-size: 2.5rem;
}

.empty-state-small .empty-state-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.empty-state-small .empty-state-description {
  font-size: var(--font-size-sm);
}

@media (max-width: 640px) {
  .empty-state {
    padding: var(--spacing-8) var(--spacing-4);
    min-height: 200px;
  }
  
  .icon-emoji {
    font-size: 3rem;
  }
  
  .empty-state-title {
    font-size: var(--font-size-lg);
  }
  
  .empty-state-small {
    min-height: 120px;
    padding: var(--spacing-4) var(--spacing-2);
  }
  
  .empty-state-small .icon-emoji {
    font-size: 2rem;
  }
}
</style>

