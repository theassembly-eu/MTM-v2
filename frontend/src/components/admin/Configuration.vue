<template>
  <div class="admin-page">
    <h1>Configuratie Beheer</h1>
    <p class="subtitle">Beheer Doelgroepen, Output Formaten en Talen</p>

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

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <h3>{{ editingItem ? `${getItemTypeLabel()} Bewerken` : `Nieuwe ${getItemTypeLabel()}` }}</h3>
        <form @submit.prevent="saveItem">
          <div class="form-group">
            <label>Naam *</label>
            <input v-model="itemForm.name" type="text" required />
          </div>
          <div v-if="activeTab === 'languages'" class="form-group">
            <label>Code *</label>
            <input v-model="itemForm.code" type="text" required placeholder="Bijv. DUTCH" />
          </div>
          <div class="form-group">
            <label>Beschrijving</label>
            <textarea v-model="itemForm.description" rows="3"></textarea>
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

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const activeTab = ref('audiences');
const showModal = ref(false);
const editingItem = ref(null);
const editingType = ref(null);

const targetAudiences = ref([]);
const outputFormats = ref([]);
const languages = ref([]);

const itemForm = ref({
  name: '',
  code: '',
  description: '',
});

const tabs = [
  { id: 'audiences', label: 'Doelgroepen' },
  { id: 'formats', label: 'Output Formaten' },
  { id: 'languages', label: 'Talen' },
];

function getItemTypeLabel() {
  switch (activeTab.value) {
    case 'audiences': return 'Doelgroep';
    case 'formats': return 'Output Formaat';
    case 'languages': return 'Taal';
    default: return 'Item';
  }
}

function getApiEndpoint() {
  switch (activeTab.value) {
    case 'audiences': return '/api/target-audiences';
    case 'formats': return '/api/output-formats';
    case 'languages': return '/api/languages';
    default: return '';
  }
}

function getCurrentItems() {
  switch (activeTab.value) {
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
    const [audiencesRes, formatsRes, languagesRes] = await Promise.all([
      axios.get('/api/target-audiences'),
      axios.get('/api/output-formats'),
      axios.get('/api/languages'),
    ]);

    targetAudiences.value = audiencesRes.data.map(a => ({
      id: a._id || a.id,
      name: a.name,
      description: a.description || '',
    }));

    outputFormats.value = formatsRes.data.map(f => ({
      id: f._id || f.id,
      name: f.name,
      description: f.description || '',
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
  };
  showModal.value = true;
}

function editItem(item) {
  editingItem.value = item;
  editingType.value = activeTab.value;
  itemForm.value = {
    name: item.name,
    code: item.code || '',
    description: item.description || '',
  };
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
  };
}

async function saveItem() {
  saving.value = true;
  error.value = null;
  try {
    const endpoint = getApiEndpoint();
    const data = { ...itemForm.value };
    
    if (activeTab.value === 'languages' && data.code) {
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
.subtitle {
  color: #666;
  margin-bottom: 2rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #ddd;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-weight: 600;
  color: #666;
  transition: all 0.3s ease;
}

.tab-button:hover {
  color: #000;
}

.tab-button.active {
  color: #FF0000;
  border-bottom-color: #FF0000;
}

.config-section {
  margin-top: 2rem;
}

/* Reuse other styles from TeamsProjects */
</style>

