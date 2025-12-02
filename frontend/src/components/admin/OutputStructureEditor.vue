<template>
  <div class="output-structure-editor">
    <div class="editor-header">
      <h4 class="section-title">Output Structuur</h4>
      <button 
        type="button" 
        @click="addSection" 
        class="btn-add-section"
        :disabled="saving"
      >
        + Sectie Toevoegen
      </button>
    </div>
    
    <p class="editor-description">
      Definieer de structuur van de output. Elke sectie wordt gebruikt om de AI te instrueren hoe de output moet worden opgebouwd.
    </p>

    <EmptyState
      v-if="sections.length === 0"
      icon="📋"
      title="Geen secties gedefinieerd"
      description="Voeg secties toe om een aangepaste output structuur te maken. Als er geen secties zijn gedefinieerd, wordt de standaard structuur gebruikt."
    />

    <div v-else class="sections-list">
      <div
        v-for="(section, index) in sortedSections"
        :key="section._tempId || index"
        class="section-item"
      >
        <div class="section-header">
          <div class="section-number">{{ index + 1 }}</div>
          <div class="section-content">
            <div class="section-main">
              <input
                v-model="section.name"
                type="text"
                placeholder="Sectie naam (bijv. Hero Section)"
                class="section-name-input"
                :disabled="saving"
                @blur="validateSection(section)"
              />
              <div class="section-meta">
                <label class="meta-label">
                  <input
                    type="number"
                    v-model.number="section.order"
                    min="0"
                    class="order-input"
                    :disabled="saving"
                    @change="updateOrder(section)"
                  />
                  <span>Volgorde</span>
                </label>
                <label class="meta-label checkbox-label">
                  <input
                    type="checkbox"
                    v-model="section.required"
                    :disabled="saving"
                  />
                  <span>Verplicht</span>
                </label>
              </div>
            </div>
            <textarea
              v-model="section.description"
              placeholder="Beschrijving van wat deze sectie moet bevatten..."
              rows="2"
              class="section-description-input"
              :disabled="saving"
            ></textarea>
            <div v-if="section._error" class="section-error">
              {{ section._error }}
            </div>
          </div>
          <div class="section-actions">
            <button
              type="button"
              @click="moveSection(index, 'up')"
              :disabled="index === 0 || saving"
              class="btn-move"
              title="Omhoog verplaatsen"
            >
              ↑
            </button>
            <button
              type="button"
              @click="moveSection(index, 'down')"
              :disabled="index === sortedSections.length - 1 || saving"
              class="btn-move"
              title="Omlaag verplaatsen"
            >
              ↓
            </button>
            <button
              type="button"
              @click="removeSection(section)"
              :disabled="saving"
              class="btn-remove"
              title="Verwijderen"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="sections.length > 0" class="structure-preview">
      <h5 class="preview-title">Preview Structuur</h5>
      <div class="preview-content">
        <div
          v-for="(section, index) in sortedSections"
          :key="index"
          class="preview-section"
        >
          <div class="preview-section-header">
            <span class="preview-number">{{ index + 1 }}</span>
            <strong>{{ section.name || 'Naamloze sectie' }}</strong>
            <span v-if="section.required !== false" class="preview-required">[REQUIRED]</span>
          </div>
          <p v-if="section.description" class="preview-description">
            {{ section.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import EmptyState from '../common/EmptyState.vue';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ sections: [] }),
  },
  saving: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue']);

const sections = ref([]);
let tempIdCounter = 0;
let isUpdatingFromProps = false;
let lastEmittedValue = null;

// Helper to normalize sections for comparison
function normalizeSections(sections) {
  return sections.map(({ _tempId, _error, ...section }) => ({
    name: section.name || '',
    description: section.description || '',
    required: section.required !== false,
    order: section.order !== undefined ? section.order : 999,
  }));
}

// Helper to compare sections
function sectionsEqual(sections1, sections2) {
  if (!sections1 && !sections2) return true;
  if (!sections1 || !sections2) return false;
  if (sections1.length !== sections2.length) return false;
  
  const norm1 = normalizeSections(sections1);
  const norm2 = normalizeSections(sections2);
  
  return JSON.stringify(norm1) === JSON.stringify(norm2);
}

// Initialize sections from modelValue
watch(() => props.modelValue, (newValue) => {
  // Prevent circular updates
  if (isUpdatingFromProps) return;
  
  const newSections = newValue?.sections || [];
  const currentNormalized = normalizeSections(sections.value);
  const newNormalized = normalizeSections(newSections);
  
  // Only update if actually different
  if (!sectionsEqual(sections.value, newSections)) {
    isUpdatingFromProps = true;
    
    if (newSections.length > 0) {
      sections.value = newSections.map(s => ({
        ...s,
        _tempId: s._tempId || `temp_${tempIdCounter++}`,
        required: s.required !== undefined ? s.required : true,
        order: s.order !== undefined ? s.order : 999,
      }));
    } else {
      sections.value = [];
    }
    
    lastEmittedValue = JSON.stringify(newNormalized);
    
    // Reset flag after a microtask to allow other updates
    setTimeout(() => {
      isUpdatingFromProps = false;
    }, 0);
  }
}, { immediate: true, deep: true });

// Watch for changes and emit updates
watch(sections, (newSections) => {
  // Prevent circular updates
  if (isUpdatingFromProps) return;
  
  const cleanSections = normalizeSections(newSections);
  const cleanValue = JSON.stringify(cleanSections);
  
  // Only emit if value actually changed
  if (cleanValue !== lastEmittedValue) {
    lastEmittedValue = cleanValue;
    emit('update:modelValue', {
      sections: cleanSections,
    });
  }
}, { deep: true });

const sortedSections = computed(() => {
  return [...sections.value].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : 999;
    const orderB = b.order !== undefined ? b.order : 999;
    return orderA - orderB;
  });
});

function addSection() {
  const newSection = {
    name: '',
    description: '',
    required: true,
    order: sections.value.length > 0 
      ? Math.max(...sections.value.map(s => s.order || 0)) + 1 
      : 1,
    _tempId: `temp_${tempIdCounter++}`,
  };
  sections.value.push(newSection);
}

function removeSection(section) {
  const index = sections.value.findIndex(s => 
    s._tempId === section._tempId || 
    (section._tempId === undefined && s === section)
  );
  if (index !== -1) {
    sections.value.splice(index, 1);
  }
}

function moveSection(index, direction) {
  const sorted = sortedSections.value;
  if (direction === 'up' && index > 0) {
    // Find the actual sections in the original array
    const sectionToMove = sorted[index];
    const sectionToSwap = sorted[index - 1];
    
    // Swap orders
    const tempOrder = sectionToMove.order;
    sectionToMove.order = sectionToSwap.order;
    sectionToSwap.order = tempOrder;
  } else if (direction === 'down' && index < sorted.length - 1) {
    // Find the actual sections in the original array
    const sectionToMove = sorted[index];
    const sectionToSwap = sorted[index + 1];
    
    // Swap orders
    const tempOrder = sectionToMove.order;
    sectionToMove.order = sectionToSwap.order;
    sectionToSwap.order = tempOrder;
  }
}

function updateOrder(section) {
  if (section.order === undefined || section.order === null) {
    section.order = 999;
  }
}

function validateSection(section) {
  if (!section.name || section.name.trim().length === 0) {
    section._error = 'Sectie naam is verplicht';
  } else {
    section._error = null;
  }
}
</script>

<style scoped>
.output-structure-editor {
  margin-top: var(--spacing-6);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-border);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-3);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.btn-add-section {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-add-section:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-add-section:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-4);
  line-height: var(--line-height-relaxed);
}

.sections-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

.section-item {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
  transition: all var(--transition-base);
}

.section-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-start;
}

.section-number {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.section-content {
  flex: 1;
  min-width: 0;
}

.section-main {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-start;
  margin-bottom: var(--spacing-2);
  flex-wrap: wrap;
}

.section-name-input {
  flex: 1;
  min-width: 200px;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.section-name-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.section-name-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.section-meta {
  display: flex;
  gap: var(--spacing-3);
  align-items: center;
  flex-wrap: wrap;
}

.meta-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.order-input {
  width: 60px;
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.order-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.checkbox-label {
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.section-description-input {
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
}

.section-description-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.section-description-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.section-error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin-top: var(--spacing-1);
}

.section-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  flex-shrink: 0;
}

.btn-move,
.btn-remove {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.btn-move:hover:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.btn-remove:hover:not(:disabled) {
  background: var(--color-error);
  color: var(--color-text-inverse);
  border-color: var(--color-error);
}

.btn-move:disabled,
.btn-remove:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.structure-preview {
  margin-top: var(--spacing-6);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.preview-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-3) 0;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.preview-section {
  padding: var(--spacing-3);
  background: var(--color-bg-primary);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

.preview-section-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-1);
}

.preview-number {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.preview-required {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  font-weight: var(--font-weight-medium);
  margin-left: auto;
}

.preview-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
  line-height: var(--line-height-relaxed);
}
</style>

