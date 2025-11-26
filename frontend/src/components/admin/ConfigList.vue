<template>
  <div class="config-list">
    <div v-if="items.length === 0" class="empty-state">
      Geen items gevonden.
    </div>
    <div v-else class="items-list">
      <div 
        v-for="item in items" 
        :key="item.id" 
        class="item-card"
      >
        <div class="item-header">
          <div>
            <h3>{{ item.name }}</h3>
            <p v-if="item.code" class="item-code">{{ item.code }}</p>
            <p v-if="item.description" class="item-description">{{ item.description }}</p>
          </div>
          <div class="item-actions">
            <button @click="$emit('edit', item)" class="btn-edit">Bewerken</button>
            <button @click="$emit('delete', item, itemType)" class="btn-delete">Verwijderen</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    required: true,
  },
  itemType: {
    type: String,
    required: true,
  },
});

defineEmits(['edit', 'delete']);
</script>

<style scoped>
.config-list {
  margin-top: var(--spacing-4);
}

.items-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-4);
}

.item-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
  display: flex;
  flex-direction: column;
  width: 100%;
}

.item-card:hover {
  box-shadow: var(--shadow-md);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-4);
  width: 100%;
}

.item-header > div:first-child {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.item-header h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-2) 0;
  word-break: break-word;
}

.item-code {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-family: 'Monaco', 'Courier New', monospace;
  margin: var(--spacing-2) 0;
  background: var(--color-bg-tertiary);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  display: inline-block;
  word-break: break-all;
}

.item-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: var(--spacing-2) 0 0 0;
  line-height: var(--line-height-relaxed);
  word-break: break-word;
}

.item-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.btn-edit, .btn-delete {
  padding: var(--spacing-2) var(--spacing-4);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.btn-edit {
  background: var(--color-success);
  color: var(--color-text-inverse);
}

.btn-edit:hover {
  background: #059669;
}

.btn-delete {
  background: var(--color-error);
  color: var(--color-text-inverse);
}

.btn-delete:hover {
  background: #DC2626;
}

.empty-state {
  color: var(--color-text-tertiary);
  font-style: italic;
  padding: var(--spacing-8);
  text-align: center;
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .items-list {
    grid-template-columns: 1fr;
  }
}
</style>

