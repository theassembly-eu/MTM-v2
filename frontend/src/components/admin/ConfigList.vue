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
  margin-top: 1rem;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.item-card {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.item-code {
  color: #666;
  font-size: 0.9em;
  margin: 0.25rem 0;
}

.item-description {
  color: #666;
  font-size: 0.9em;
  margin: 0.5rem 0 0 0;
}

.item-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-edit, .btn-delete {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-edit {
  background: #4CAF50;
  color: white;
}

.btn-edit:hover {
  background: #45a049;
}

.btn-delete {
  background: #f44336;
  color: white;
}

.btn-delete:hover {
  background: #da190b;
}

.empty-state {
  color: #666;
  font-style: italic;
  padding: 2rem;
  text-align: center;
}
</style>

