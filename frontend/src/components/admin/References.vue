<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Referenties Beheer</h1>
      <p class="page-subtitle">Beheer referenties voor projecten (URLs, trefwoorden, geografische context)</p>
    </div>

    <div class="project-selector">
      <label for="project-select">Selecteer Project:</label>
      <select 
        id="project-select" 
        v-model="selectedProjectId" 
        @change="fetchReferences"
      >
        <option value="">Selecteer een project</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }} ({{ project.teamName }})
        </option>
      </select>
    </div>

    <LoadingSpinner v-if="loading" message="Referenties laden..." />
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="selectedProjectId" class="references-section">
      <div class="section-header">
        <h2>Referenties voor {{ selectedProjectName }}</h2>
        <button @click="showCreateModal = true" class="btn-primary">
          Nieuwe Referentie
        </button>
      </div>

      <div class="search-section">
        <SearchInput
          v-model="searchQuery"
          @search="handleSearch"
          placeholder="Zoeken op titel, URL of trefwoorden..."
          label="Zoeken referenties"
        />
      </div>

      <EmptyState
        v-if="filteredReferences.length === 0"
        icon="🔗"
        title="Geen referenties"
        description="Voeg referenties toe (URLs of trefwoorden) om de AI context te geven bij het vereenvoudigen van teksten."
        action-label="Nieuwe Referentie"
        :action-handler="() => showCreateModal = true"
      />

      <div v-else class="references-list">
        <div 
          v-for="ref in filteredReferences" 
          :key="ref.id" 
          class="reference-card"
        >
          <div class="reference-header">
            <h3>{{ ref.title }}</h3>
            <div class="reference-actions">
              <button @click="editReference(ref)" class="btn-edit">Bewerken</button>
              <button @click="deleteReference(ref.id)" class="btn-delete">Verwijderen</button>
            </div>
          </div>
          <div class="reference-info">
            <p><strong>Type:</strong> {{ ref.type }}</p>
            <p v-if="ref.url"><strong>URL:</strong> <a :href="ref.url" target="_blank">{{ ref.url }}</a></p>
            <p v-if="ref.geoContext"><strong>Geografische Context:</strong> {{ ref.geoContext }}</p>
            <p v-if="ref.keywords && ref.keywords.length > 0">
              <strong>Trefwoorden:</strong> {{ ref.keywords.join(', ') }}
            </p>
            <p v-if="ref.summary"><strong>Samenvatting:</strong> {{ ref.summary }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Reference Modal -->
    <div v-if="showCreateModal || editingReference" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <h3>{{ editingReference ? 'Referentie Bewerken' : 'Nieuwe Referentie' }}</h3>
        <form @submit.prevent="saveReference">
          <div class="form-group">
            <label>Type *</label>
            <select v-model="referenceForm.type" required @change="onTypeChange">
              <option value="">Selecteer type</option>
              <option value="URL">URL</option>
              <option value="KEYWORDS">Trefwoorden</option>
            </select>
          </div>
          <div class="form-group">
            <label>Titel *</label>
            <input v-model="referenceForm.title" type="text" required />
          </div>
          <div v-if="referenceForm.type === 'URL'" class="form-group">
            <label>URL *</label>
            <input v-model="referenceForm.url" type="url" required />
            <small>De URL wordt automatisch opgehaald en samengevat.</small>
          </div>
          <div v-if="referenceForm.type === 'KEYWORDS'" class="form-group">
            <label>Trefwoorden</label>
            <div class="keyword-input">
              <input 
                type="text" 
                v-model="newKeyword" 
                @keyup.enter="addKeyword"
                placeholder="Voeg trefwoord toe en druk Enter"
              />
              <button type="button" @click="addKeyword">Toevoegen</button>
            </div>
            <div class="keyword-tags">
              <span 
                v-for="(keyword, index) in referenceForm.keywords" 
                :key="index" 
                class="keyword-tag"
              >
                {{ keyword }}
                <button type="button" @click="removeKeyword(index)">×</button>
              </span>
            </div>
          </div>
          <div class="form-group">
            <label>Geografische Context</label>
            <input v-model="referenceForm.geoContext" type="text" />
          </div>
          <div class="form-group">
            <label>Samenvatting (handmatig)</label>
            <textarea v-model="referenceForm.summary" rows="4"></textarea>
            <small v-if="referenceForm.type === 'URL'">Wordt automatisch gegenereerd als leeg gelaten.</small>
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
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import EmptyState from '../common/EmptyState.vue';
import LoadingSpinner from '../common/LoadingSpinner.vue';
import SearchInput from '../common/SearchInput.vue';

const { success, error: showError } = useToast();
const { confirm } = useConfirm();

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const projects = ref([]);
const references = ref([]);
const selectedProjectId = ref('');
const showCreateModal = ref(false);
const editingReference = ref(null);
const newKeyword = ref('');
const searchQuery = ref('');

const referenceForm = ref({
  type: '',
  title: '',
  url: '',
  keywords: [],
  geoContext: '',
  summary: '',
});

const selectedProjectName = computed(() => {
  const project = projects.value.find(p => p.id === selectedProjectId.value);
  return project?.name || '';
});

const filteredReferences = computed(() => {
  if (!searchQuery.value.trim()) {
    return references.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  return references.value.filter(ref => {
    const title = (ref.title || '').toLowerCase();
    const url = (ref.url || '').toLowerCase();
    const keywords = (ref.keywords || []).join(' ').toLowerCase();
    return title.includes(query) || url.includes(query) || keywords.includes(query);
  });
});

function handleSearch(query) {
  // Search is handled by computed property
}

function onTypeChange() {
  if (referenceForm.value.type === 'KEYWORDS') {
    referenceForm.value.url = '';
  } else if (referenceForm.value.type === 'URL') {
    referenceForm.value.keywords = [];
  }
}

function addKeyword() {
  const keyword = newKeyword.value.trim();
  if (keyword && !referenceForm.value.keywords.includes(keyword)) {
    referenceForm.value.keywords.push(keyword);
    newKeyword.value = '';
  }
}

function removeKeyword(index) {
  referenceForm.value.keywords.splice(index, 1);
}

async function fetchProjects() {
  try {
    const response = await axios.get('/api/projects');
    projects.value = response.data.map(p => ({
      id: p._id || p.id,
      name: p.name,
      teamName: p.team?.name || '',
    }));
  } catch (err) {
    console.error('Error fetching projects:', err);
    error.value = 'Fout bij het ophalen van projecten';
  }
}

async function fetchReferences() {
  if (!selectedProjectId.value) {
    references.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const response = await axios.get(`/api/projects/${selectedProjectId.value}/references`);
    references.value = response.data.map(r => ({
      id: r._id || r.id,
      title: r.title,
      type: r.type,
      url: r.url || '',
      keywords: r.keywords || [],
      geoContext: r.geoContext || '',
      summary: r.summary || '',
    }));
  } catch (err) {
    console.error('Error fetching references:', err);
    error.value = 'Fout bij het ophalen van referenties';
  } finally {
    loading.value = false;
  }
}

function editReference(ref) {
  editingReference.value = ref;
  referenceForm.value = {
    type: ref.type,
    title: ref.title,
    url: ref.url || '',
    keywords: [...ref.keywords],
    geoContext: ref.geoContext || '',
    summary: ref.summary || '',
  };
}

function closeModal() {
  showCreateModal.value = false;
  editingReference.value = null;
  referenceForm.value = {
    type: '',
    title: '',
    url: '',
    keywords: [],
    geoContext: '',
    summary: '',
  };
  newKeyword.value = '';
}

async function saveReference() {
  saving.value = true;
  error.value = null;
  try {
    const data = {
      ...referenceForm.value,
      project: selectedProjectId.value,
    };

    if (editingReference.value) {
      await axios.put(`/api/references/${editingReference.value.id}`, data);
      success('Referentie succesvol bijgewerkt');
    } else {
      await axios.post(`/api/projects/${selectedProjectId.value}/references`, data);
      success('Referentie succesvol aangemaakt');
    }
    await fetchReferences();
    closeModal();
  } catch (err) {
    console.error('Error saving reference:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het opslaan van referentie';
    error.value = errorMsg;
    showError(errorMsg);
  } finally {
    saving.value = false;
  }
}

async function deleteReference(refId) {
  try {
    const confirmed = await confirm({
      title: 'Referentie verwijderen',
      message: 'Weet je zeker dat je deze referentie wilt verwijderen?',
      description: 'Deze actie kan niet ongedaan worden gemaakt.',
      type: 'danger',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    await axios.delete(`/api/references/${refId}`);
    success('Referentie succesvol verwijderd');
    await fetchReferences();
  } catch (err) {
    if (err === false) return; // User cancelled
    console.error('Error deleting reference:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het verwijderen van referentie';
    error.value = errorMsg;
    showError(errorMsg);
  }
}

onMounted(() => {
  fetchProjects();
});
</script>

<style scoped>
.admin-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--spacing-8) var(--spacing-4);
}

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

.project-selector {
  margin-bottom: var(--spacing-8);
  padding: var(--spacing-6);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.project-selector label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
  display: block;
}

.project-selector select {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
}

.references-section {
  margin-top: var(--spacing-8);
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

.references-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--spacing-4);
}

.reference-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.reference-card:hover {
  box-shadow: var(--shadow-md);
}

.reference-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-4);
  gap: var(--spacing-4);
  min-width: 0;
}

.reference-header h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.reference-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.reference-info {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.reference-info p {
  margin: var(--spacing-2) 0;
}

.reference-info strong {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  margin-right: var(--spacing-2);
}

.reference-info a {
  color: var(--color-primary);
  text-decoration: none;
  transition: color var(--transition-base);
}

.reference-info a:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.keyword-input {
  display: flex;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
}

.keyword-input input {
  flex: 1;
}

.keyword-input button {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  min-height: var(--spacing-8);
}

.keyword-tag {
  background: var(--color-bg-tertiary);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.keyword-tag button {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-size: var(--font-size-lg);
  line-height: 1;
  padding: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: all var(--transition-base);
}

.keyword-tag button:hover {
  color: var(--color-error);
  background-color: var(--color-bg-secondary);
}

.form-group small {
  display: block;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  margin-top: var(--spacing-2);
  line-height: var(--line-height-relaxed);
}

.empty-state {
  color: var(--color-text-tertiary);
  font-style: italic;
  padding: var(--spacing-8);
  text-align: center;
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--spacing-4);
}

.modal {
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-8);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--color-border);
}

.modal h3 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-top: 0;
  margin-bottom: var(--spacing-6);
}

.form-group {
  margin-bottom: var(--spacing-6);
}

.form-group label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
  margin-top: var(--spacing-8);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-border);
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn-edit {
  background: var(--color-success);
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.btn-edit:hover {
  background: #059669;
}

.btn-delete {
  background: var(--color-error);
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.btn-delete:hover {
  background: #DC2626;
}

.btn-cancel {
  background: var(--color-text-tertiary);
  color: var(--color-text-inverse);
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.btn-cancel:hover {
  background: #4B5563;
}

.loading {
  text-align: center;
  padding: var(--spacing-10);
  color: var(--color-text-secondary);
}

.error-message {
  background: #FEF2F2;
  color: var(--color-error);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-6);
  border: 1px solid #FECACA;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
}

.search-section {
  margin-bottom: var(--spacing-6);
  padding: var(--spacing-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
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

@media (max-width: 768px) {
  .admin-page {
    padding: var(--spacing-4) var(--spacing-3);
  }
  
  .references-list {
    grid-template-columns: 1fr;
  }
  
  .modal {
    padding: var(--spacing-6);
  }
}
</style>

