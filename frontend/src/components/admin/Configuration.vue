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

    <!-- Target Audiences (SUPER_ADMIN only) -->
    <div v-if="activeTab === 'audiences' && userRole === 'SUPER_ADMIN'" class="config-section">
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

    <!-- Output Formats (SUPER_ADMIN only) -->
    <div v-if="activeTab === 'formats' && userRole === 'SUPER_ADMIN'" class="config-section">
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

    <!-- Languages (SUPER_ADMIN only) -->
    <div v-if="activeTab === 'languages' && userRole === 'SUPER_ADMIN'" class="config-section">
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

    <!-- LVLs (SUPER_ADMIN only) -->
    <div v-if="activeTab === 'lvls' && userRole === 'SUPER_ADMIN'" class="config-section">
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
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="modal-overlay" @click="closeModal">
          <div class="modal" @click.stop>
            <h3>{{ editingItem ? `${getItemTypeLabel()} Bewerken` : `Nieuwe ${getItemTypeLabel()}` }}</h3>
            <div class="modal-body-content">
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
            
            <!-- Output Structure Editor -->
            <OutputStructureEditor
              v-model="itemForm.outputStructure"
              :saving="saving"
            />
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn-cancel">Annuleren</button>
            <button type="submit" :disabled="saving" class="btn-primary" :class="{ 'btn-loading': saving }">
              <span v-if="saving" class="btn-spinner"></span>
              <span>{{ saving ? 'Opslaan...' : 'Opslaan' }}</span>
            </button>
          </div>
        </form>
        </div>
      </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { Teleport, Transition } from 'vue';
import axios from 'axios';
import { useAuth } from '../../composables/useAuth.js';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import ConfigList from './ConfigList.vue';
import PromptTemplatesTab from './PromptTemplatesTab.vue';
import SystemPromptTemplatesTab from './SystemPromptTemplatesTab.vue';
import OutputStructureEditor from './OutputStructureEditor.vue';

const { userRole } = useAuth();
const { success, error: showError } = useToast();
const { confirm } = useConfirm();

const loading = ref(false);
const saving = ref(false);
const error = ref(null);

// Check for hash in URL to set initial tab
const getInitialTab = () => {
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.replace('#', '');
    const availableTabs = userRole.value === 'SUPER_ADMIN' 
      ? ['audiences', 'formats', 'languages', 'lvls', 'templates', 'system-templates']
      : ['templates', 'system-templates'];
    if (availableTabs.includes(hash)) {
      return hash;
    }
  }
  // Default tab based on role
  return userRole.value === 'SUPER_ADMIN' ? 'audiences' : 'templates';
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
  outputStructure: { sections: [] },
  behavioralRules: [],
});

const placesText = ref('');

// Filter tabs based on user role
const tabs = computed(() => {
  const allTabs = [
    { id: 'lvls', label: 'LVLs' },
    { id: 'audiences', label: 'Doelgroepen' },
    { id: 'formats', label: 'Output Formaten' },
    { id: 'languages', label: 'Talen' },
    { id: 'templates', label: 'Prompt Templates' },
    { id: 'system-templates', label: 'Systeem Templates' },
  ];
  
  // SUPER_ADMIN sees all tabs
  if (userRole.value === 'SUPER_ADMIN') {
    return allTabs;
  }
  
  // ADMIN and TEAM_LEADER only see template tabs
  return allTabs.filter(tab => tab.id === 'templates' || tab.id === 'system-templates');
});

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
    outputStructure: { sections: [] },
    behavioralRules: [],
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
    outputStructure: item.outputStructure || { sections: [] },
    behavioralRules: item.behavioralRules || [],
  };
  placesText.value = (item.places || []).join('\n');
  showModal.value = true;
}

const modalCloseGuard = ref(false);

function closeModal() {
  modalCloseGuard.value = true;
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
    outputStructure: { sections: [] },
    behavioralRules: [],
  };
  placesText.value = '';
  // Reset guard after cleanup
  setTimeout(() => {
    modalCloseGuard.value = false;
  }, 100);
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

    // For output formats, ensure outputStructure is properly formatted
    if (activeTab.value === 'formats') {
      // Only send outputStructure if it has sections
      if (!data.outputStructure || !data.outputStructure.sections || data.outputStructure.sections.length === 0) {
        // Remove empty outputStructure to use default
        delete data.outputStructure;
      } else {
        // Validate sections have names
        const invalidSections = data.outputStructure.sections.filter(s => !s.name || s.name.trim().length === 0);
        if (invalidSections.length > 0) {
          error.value = 'Alle secties moeten een naam hebben';
          showError('Alle secties moeten een naam hebben');
          saving.value = false;
          return;
        }
      }
    }

    if (editingItem.value) {
      await axios.put(`${endpoint}/${editingItem.value.id}`, data);
      success(`${getItemTypeLabel()} succesvol bijgewerkt`);
    } else {
      await axios.post(endpoint, data);
      success(`${getItemTypeLabel()} succesvol aangemaakt`);
    }
    await fetchData();
    closeModal();
  } catch (err) {
    console.error('Error saving item:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het opslaan';
    error.value = errorMsg;
    showError(errorMsg);
  } finally {
    saving.value = false;
  }
}

async function deleteItem(item, type) {
  try {
    const confirmed = await confirm({
      title: `${getItemTypeLabel()} verwijderen`,
      message: `Weet je zeker dat je "${item.name}" wilt verwijderen?`,
      description: 'Deze actie kan niet ongedaan worden gemaakt.',
      type: 'danger',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    let endpoint = '';
    switch (type) {
      case 'lvl': endpoint = '/api/lvls'; break;
      case 'audience': endpoint = '/api/target-audiences'; break;
      case 'format': endpoint = '/api/output-formats'; break;
      case 'language': endpoint = '/api/languages'; break;
    }
    await axios.delete(`${endpoint}/${item.id}`);
    success(`${getItemTypeLabel()} succesvol verwijderd`);
    await fetchData();
  } catch (err) {
    if (err === false) return; // User cancelled
    console.error('Error deleting item:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het verwijderen';
    error.value = errorMsg;
    showError(errorMsg);
  }
}

// Prevent body scroll when modal is open
watch(showModal, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

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

.btn-loading {
  position: relative;
  color: transparent;
}

.btn-loading .btn-spinner {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
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

.btn-primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-cancel {
  background: var(--color-text-tertiary);
  color: var(--color-text-inverse);
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-cancel:hover:not(:disabled) {
  background: #4B5563;
}

.btn-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal Styles */
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
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal h3 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-6) 0;
  padding: var(--spacing-6);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.modal form {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.modal .form-group {
  margin-bottom: var(--spacing-4);
}

.modal .form-group label {
  display: block;
  margin-bottom: var(--spacing-2);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.modal .form-group input[type="text"],
.modal .form-group textarea {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: inherit;
}

.modal .form-group input[type="text"]:focus,
.modal .form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal .form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.modal-body-content {
  padding: var(--spacing-6);
  overflow-y: auto;
  flex: 1;
}

.modal-actions {
  display: flex;
  gap: var(--spacing-3);
  justify-content: flex-end;
  padding: var(--spacing-6);
  border-top: 1px solid var(--color-border);
  margin-top: auto;
}

/* Modal Transitions */
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
  
  .modal h3,
  .modal-body-content,
  .modal-actions {
    padding: var(--spacing-4);
  }
}
</style>

