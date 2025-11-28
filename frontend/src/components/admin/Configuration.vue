<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Configuratie Beheer</h1>
      <p class="page-subtitle">Beheer LVLs, Doelgroepen, Output Formaten en Talen</p>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="['tab-button', { active: activeTab === tab.id }]"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Target Audiences -->
    <div v-if="activeTab === 'audiences'" class="config-section">
      <div class="section-header">
        <h2>Doelgroepen</h2>
        <button @click="showCreateModal('audience')" class="btn-primary">
          Nieuwe Doelgroep
        </button>
      </div>
      <ConfigList
        :items="targetAudiences"
        :itemType="'audience'"
        @edit="editItem"
        @delete="deleteItem"
      />
    </div>

    <!-- Output Formats -->
    <div v-if="activeTab === 'formats'" class="config-section">
      <div class="section-header">
        <h2>Output Formaten</h2>
        <button @click="showCreateModal('format')" class="btn-primary">
          Nieuw Output Formaat
        </button>
      </div>
      <ConfigList
        :items="outputFormats"
        :itemType="'format'"
        @edit="editItem"
        @delete="deleteItem"
      />
    </div>

    <!-- Languages -->
    <div v-if="activeTab === 'languages'" class="config-section">
      <div class="section-header">
        <h2>Talen</h2>
        <button @click="showCreateModal('language')" class="btn-primary">
          Nieuwe Taal
        </button>
      </div>
      <ConfigList
        :items="languages"
        :itemType="'language'"
        @edit="editItem"
        @delete="deleteItem"
      />
    </div>

    <!-- LVLs -->
    <div v-if="activeTab === 'lvls'" class="config-section">
      <div class="section-header">
        <h2>Communicatieniveaus (LVLs)</h2>
        <button @click="showCreateModal('lvl')" class="btn-primary">
          Nieuw LVL
        </button>
      </div>
      <ConfigList
        :items="lvls"
        :itemType="'lvl'"
        @edit="editItem"
        @delete="deleteItem"
      />
    </div>

    <!-- Prompt Templates -->
    <div v-if="activeTab === 'templates'" class="config-section">
      <PromptTemplatesTab />
    </div>

    <!-- System Prompt Templates -->
    <div v-if="activeTab === 'system-templates'" class="config-section">
      <SystemPromptTemplatesTab />
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <h3>{{ editingItem ? `${getItemTypeLabel()} Bewerken` : `Nieuwe ${getItemTypeLabel()}` }}</h3>
        <form @submit.prevent="saveItem">
          <div class="form-group">
            <label>Naam *</label>
            <input v-model="itemForm.name" type="text" required />
          </div>
          <div v-if="activeTab === 'languages' || activeTab === 'lvls'" class="form-group">
            <label>Code *</label>
            <input v-model="itemForm.code" type="text" required placeholder="Bijv. DUTCH of LOCAL" />
          </div>
          <div class="form-group">
            <label>Beschrijving</label>
            <textarea v-model="itemForm.description" rows="3"></textarea>
          </div>
          <div v-if="activeTab === 'lvls'" class="form-group">
            <label>Plaatsen (één per regel)</label>
            <textarea 
              v-model="placesText" 
              rows="5" 
              placeholder="Antwerpen&#10;Gent&#10;Brussel"
              @input="updatePlaces"
            ></textarea>
            <small class="form-hint">Voeg plaatsen toe, één per regel. Deze worden gebruikt voor contextuele vereenvoudiging.</small>
          </div>
          <!-- Output Format Specific Fields -->
          <div v-if="activeTab === 'formats'" class="format-config-section">
            <h4 class="section-title">Format Configuratie</h4>
            <div class="form-group">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="itemForm.requiresImageSuggestion"
                />
                <span>Vereist Image Suggestion</span>
              </label>
              <small class="form-hint">Wanneer ingeschakeld, zal de AI een image suggestion sectie toevoegen aan de output (bijv. voor Instagram posts).</small>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="itemForm.requiresStructuredOutput"
                />
                <span>Vereist Gestructureerde Output</span>
              </label>
              <small class="form-hint">Wanneer ingeschakeld, moet de output een specifieke structuur volgen (Emotional Core Message, Problem Statement, etc.).</small>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn-cancel">Annuleren</button>
            <button type="submit" :disabled="saving" class="btn-primary">
              <span v-if="saving">Opslaan...</span>
              <span v-else>Opslaan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import ConfigList from './ConfigList.vue';
import PromptTemplatesTab from './PromptTemplatesTab.vue';
import SystemPromptTemplatesTab from './SystemPromptTemplatesTab.vue';

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
// Check for hash in URL to set initial tab
const getInitialTab = () => {
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.replace('#', '');
    if (['audiences', 'formats', 'languages', 'lvls', 'templates', 'system-templates'].includes(hash)) {
      return hash;
    }
  }
  return 'audiences';
};

const activeTab = ref(getInitialTab());
const showModal = ref(false);
const editingItem = ref(null);
const editingType = ref(null);

const targetAudiences = ref([]);
const outputFormats = ref([]);
const languages = ref([]);
const lvls = ref([]);

const itemForm = ref({
  name: '',
  code: '',
  description: '',
  places: [],
  requiresImageSuggestion: false,
  requiresStructuredOutput: true,
});

const placesText = ref('');

const tabs = [
  { id: 'lvls', label: 'LVLs' },
  { id: 'audiences', label: 'Doelgroepen' },
  { id: 'formats', label: 'Output Formaten' },
  { id: 'languages', label: 'Talen' },
  { id: 'templates', label: 'Prompt Templates' },
  { id: 'system-templates', label: 'Systeem Templates' },
];

function getItemTypeLabel() {
  switch (activeTab.value) {
    case 'lvls': return 'LVL';
    case 'audiences': return 'Doelgroep';
    case 'formats': return 'Output Formaat';
    case 'languages': return 'Taal';
    default: return 'Item';
  }
}

function getApiEndpoint() {
  switch (activeTab.value) {
    case 'lvls': return '/api/lvls';
    case 'audiences': return '/api/target-audiences';
    case 'formats': return '/api/output-formats';
    case 'languages': return '/api/languages';
    default: return '';
  }
}

function getCurrentItems() {
  switch (activeTab.value) {
    case 'lvls': return lvls;
    case 'audiences': return targetAudiences;
    case 'formats': return outputFormats;
    case 'languages': return languages;
    default: return ref([]);
  }
}

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const [lvlsRes, audiencesRes, formatsRes, languagesRes] = await Promise.all([
      axios.get('/api/lvls'),
      axios.get('/api/target-audiences'),
      axios.get('/api/output-formats'),
      axios.get('/api/languages'),
    ]);

    lvls.value = lvlsRes.data.map(l => ({
      id: l._id || l.id,
      name: l.name,
      code: l.code,
      description: l.description || '',
      places: l.places || [],
    }));

    targetAudiences.value = audiencesRes.data.map(a => ({
      id: a._id || a.id,
      name: a.name,
      description: a.description || '',
    }));

    outputFormats.value = formatsRes.data.map(f => ({
      id: f._id || f.id,
      name: f.name,
      description: f.description || '',
      requiresImageSuggestion: f.requiresImageSuggestion || false,
      requiresStructuredOutput: f.requiresStructuredOutput !== undefined ? f.requiresStructuredOutput : true,
      outputStructure: f.outputStructure || { sections: [] },
      behavioralRules: f.behavioralRules || [],
    }));

    languages.value = languagesRes.data.map(l => ({
      id: l._id || l.id,
      name: l.name,
      code: l.code,
      description: l.description || '',
    }));
  } catch (err) {
    console.error('Error fetching configuration:', err);
    error.value = 'Fout bij het ophalen van configuratie';
  } finally {
    loading.value = false;
  }
}

function showCreateModal(type) {
  editingType.value = type;
  editingItem.value = null;
  itemForm.value = {
    name: '',
    code: '',
    description: '',
    places: [],
    requiresImageSuggestion: false,
    requiresStructuredOutput: true,
  };
  placesText.value = '';
  showModal.value = true;
}

function updatePlaces() {
  itemForm.value.places = placesText.value
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

function editItem(item) {
  editingItem.value = item;
  editingType.value = activeTab.value;
  itemForm.value = {
    name: item.name,
    code: item.code || '',
    description: item.description || '',
    places: item.places || [],
    requiresImageSuggestion: item.requiresImageSuggestion || false,
    requiresStructuredOutput: item.requiresStructuredOutput !== undefined ? item.requiresStructuredOutput : true,
  };
  placesText.value = (item.places || []).join('\n');
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingItem.value = null;
  editingType.value = null;
  itemForm.value = {
    name: '',
    code: '',
    description: '',
    places: [],
    requiresImageSuggestion: false,
    requiresStructuredOutput: true,
  };
  placesText.value = '';
}

async function saveItem() {
  saving.value = true;
  error.value = null;
  try {
    const endpoint = getApiEndpoint();
    const data = { ...itemForm.value };
    
    // Update places from textarea before saving
    if (activeTab.value === 'lvls') {
      updatePlaces();
      data.places = itemForm.value.places;
    }
    
    if ((activeTab.value === 'languages' || activeTab.value === 'lvls') && data.code) {
      data.code = data.code.toUpperCase();
    }

    if (editingItem.value) {
      await axios.put(`${endpoint}/${editingItem.value.id}`, data);
    } else {
      await axios.post(endpoint, data);
    }
    await fetchData();
    closeModal();
  } catch (err) {
    console.error('Error saving item:', err);
    error.value = err.response?.data?.error || 'Fout bij het opslaan';
  } finally {
    saving.value = false;
  }
}

async function deleteItem(item, type) {
  if (!confirm(`Weet je zeker dat je "${item.name}" wilt verwijderen?`)) return;
  try {
    let endpoint = '';
    switch (type) {
      case 'lvl': endpoint = '/api/lvls'; break;
      case 'audience': endpoint = '/api/target-audiences'; break;
      case 'format': endpoint = '/api/output-formats'; break;
      case 'language': endpoint = '/api/languages'; break;
    }
    await axios.delete(`${endpoint}/${item.id}`);
    await fetchData();
  } catch (err) {
    console.error('Error deleting item:', err);
    error.value = err.response?.data?.error || 'Fout bij het verwijderen';
  }
}

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.page-header {
  margin-bottom: var(--spacing-8);
}

.page-header h1 {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin: 0;
}

.tabs {
  display: flex;
  gap: var(--spacing-1);
  margin-bottom: var(--spacing-8);
  border-bottom: 2px solid var(--color-border);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab-button {
  padding: var(--spacing-3) var(--spacing-5);
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-base);
  white-space: nowrap;
}

.tab-button:hover {
  color: var(--color-text-primary);
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.config-section {
  margin-top: var(--spacing-6);
}

.admin-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--spacing-8) var(--spacing-4);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.section-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.form-hint {
  display: block;
  margin-top: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-style: italic;
}

.format-config-section {
  margin-top: var(--spacing-6);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-border);
}

.section-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* Reuse other styles from TeamsProjects */
</style>

