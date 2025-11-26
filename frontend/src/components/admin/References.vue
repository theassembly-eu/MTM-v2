<template>
  <div class="admin-page">
    <h1>Referenties Beheer</h1>

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

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="selectedProjectId" class="references-section">
      <div class="section-header">
        <h2>Referenties voor {{ selectedProjectName }}</h2>
        <button @click="showCreateModal = true" class="btn-primary">
          Nieuwe Referentie
        </button>
      </div>

      <div v-if="references.length === 0" class="empty-state">
        Geen referenties voor dit project.
      </div>

      <div v-else class="references-list">
        <div 
          v-for="ref in references" 
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
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const projects = ref([]);
const references = ref([]);
const selectedProjectId = ref('');
const showCreateModal = ref(false);
const editingReference = ref(null);
const newKeyword = ref('');

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
    } else {
      await axios.post(`/api/projects/${selectedProjectId.value}/references`, data);
    }
    await fetchReferences();
    closeModal();
  } catch (err) {
    console.error('Error saving reference:', err);
    error.value = err.response?.data?.error || 'Fout bij het opslaan van referentie';
  } finally {
    saving.value = false;
  }
}

async function deleteReference(refId) {
  if (!confirm('Weet je zeker dat je deze referentie wilt verwijderen?')) return;
  try {
    await axios.delete(`/api/references/${refId}`);
    await fetchReferences();
  } catch (err) {
    console.error('Error deleting reference:', err);
    error.value = err.response?.data?.error || 'Fout bij het verwijderen van referentie';
  }
}

onMounted(() => {
  fetchProjects();
});
</script>

<style scoped>
.admin-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.project-selector {
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8f8f8;
  border-radius: 8px;
}

.project-selector label {
  font-weight: 600;
  margin-right: 1rem;
}

.project-selector select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1em;
}

.references-section {
  margin-top: 2rem;
}

.references-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reference-card {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}

.reference-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.reference-info {
  color: #666;
}

.reference-info p {
  margin: 0.5rem 0;
}

.reference-info a {
  color: #FF0000;
  text-decoration: none;
}

.reference-info a:hover {
  text-decoration: underline;
}

.keyword-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.keyword-input input {
  flex: 1;
}

.keyword-input button {
  padding: 8px 16px;
  background: #FF0000;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.keyword-tag {
  background: #e0e0e0;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.keyword-tag button {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 1.2em;
}

.keyword-tag button:hover {
  color: #FF0000;
}

.form-group small {
  display: block;
  color: #666;
  font-size: 0.85em;
  margin-top: 0.25rem;
}

/* Reuse styles from TeamsProjects */
.section-header, .empty-state, .modal-overlay, .modal, .form-group, .modal-actions,
.btn-primary, .btn-edit, .btn-delete, .btn-cancel, .loading, .error-message {
  /* Styles inherited from TeamsProjects component */
}
</style>

