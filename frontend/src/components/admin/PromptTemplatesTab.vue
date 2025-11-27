<template>
  <div class="prompt-templates-tab">
    <div class="section-header">
      <h2>Prompt Templates</h2>
      <button @click="showCreateModal = true" class="btn-primary">
        + Nieuwe Template
      </button>
    </div>

    <div class="filter-group">
      <label>Filter op Scope:</label>
      <select v-model="filterScope" @change="fetchTemplates">
        <option value="">Alle scopes</option>
        <option value="GLOBAL">Global</option>
        <option value="TEAM">Team</option>
        <option value="PROJECT">Project</option>
      </select>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="templates.length === 0 && !loading" class="no-data">
      Geen templates gevonden. Maak je eerste template aan!
    </div>

    <div v-else class="templates-grid">
      <div v-for="template in templates" :key="template.id" class="template-card">
        <div class="template-header">
          <h3>{{ template.name }}</h3>
          <span class="template-badge" :class="`badge-${template.scope.toLowerCase()}`">
            {{ template.scope }}
          </span>
        </div>
        <div class="template-body">
          <p v-if="template.description" class="template-description">
            {{ template.description }}
          </p>
          <div class="template-meta">
            <span v-if="template.team">
              <strong>Team:</strong> {{ template.team.name || template.team }}
            </span>
            <span v-if="template.project">
              <strong>Project:</strong> {{ template.project.name || template.project }}
            </span>
            <span>
              <strong>Gebruikt:</strong> {{ template.usageCount || 0 }}x
            </span>
            <span v-if="template.lastUsed">
              <strong>Laatst gebruikt:</strong> {{ formatDate(template.lastUsed) }}
            </span>
          </div>
          <div class="template-preview">
            <strong>Prompt Preview:</strong>
            <pre>{{ truncatePrompt(template.prompt) }}</pre>
          </div>
        </div>
        <div class="template-actions">
          <button @click="editTemplate(template)" class="btn-secondary">Bewerken</button>
          <button @click="deleteTemplate(template)" class="btn-danger">Verwijderen</button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal || editingTemplate" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ editingTemplate ? 'Template Bewerken' : 'Nieuwe Template' }}</h2>
          <button @click="closeModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Naam *</label>
            <input v-model="formData.name" type="text" required />
          </div>
          <div class="form-group">
            <label>Beschrijving</label>
            <textarea v-model="formData.description" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>Prompt *</label>
            <textarea v-model="formData.prompt" rows="10" required class="prompt-textarea"></textarea>
            <p class="form-hint">
              Je kunt een gegenereerde prompt hier plakken of handmatig een prompt schrijven.
            </p>
          </div>
          <div class="form-group" v-if="userRole === 'SUPER_ADMIN'">
            <label>Scope</label>
            <select v-model="formData.scope" @change="onScopeChange">
              <option value="GLOBAL">Global (voor alle teams)</option>
              <option value="TEAM">Team</option>
              <option value="PROJECT">Project</option>
            </select>
          </div>
          <div class="form-group" v-if="formData.scope !== 'GLOBAL'">
            <label>Team *</label>
            <select v-model="formData.teamId" required @change="onTeamChange">
              <option value="">Selecteer team</option>
              <option v-for="team in availableTeams" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </div>
          <div class="form-group" v-if="formData.scope === 'PROJECT'">
            <label>Project</label>
            <select v-model="formData.projectId">
              <option value="">Geen project (team template)</option>
              <option v-for="project in availableProjects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <button 
              @click="saveTemplate" 
              :disabled="saving || !formData.name || !formData.prompt"
              class="btn-primary"
            >
              {{ saving ? 'Opslaan...' : 'Opslaan' }}
            </button>
            <button @click="closeModal" class="btn-secondary">Annuleren</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuth } from '../../composables/useAuth.js';

const { user, userTeams } = useAuth();
const userRole = computed(() => user.value?.role || '');
const userTeamsList = computed(() => userTeams.value || []);

const templates = ref([]);
const loading = ref(false);
const error = ref(null);
const filterScope = ref('');
const showCreateModal = ref(false);
const editingTemplate = ref(null);
const saving = ref(false);

const formData = ref({
  name: '',
  description: '',
  prompt: '',
  scope: 'TEAM',
  teamId: '',
  projectId: '',
});

const teams = ref([]);
const projects = ref([]);

const availableTeams = computed(() => {
  if (userRole.value === 'SUPER_ADMIN') {
    return teams.value;
  }
  return teams.value.filter(t => userTeamsList.value.some(ut => String(ut.id || ut) === String(t.id)));
});

const availableProjects = computed(() => {
  if (!formData.value.teamId) return [];
  return projects.value.filter(p => String(p.team) === String(formData.value.teamId));
});

async function fetchTemplates() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (filterScope.value) params.append('scope', filterScope.value);
    
    const response = await axios.get(`/api/prompt-templates?${params.toString()}`);
    templates.value = response.data.map(t => ({
      id: t._id || t.id,
      name: t.name,
      description: t.description,
      prompt: t.prompt,
      scope: t.scope,
      team: t.team,
      project: t.project,
      usageCount: t.usageCount || 0,
      lastUsed: t.lastUsed,
      createdBy: t.createdBy,
    }));
  } catch (err) {
    console.error('Error fetching templates:', err);
    error.value = err.response?.data?.error || 'Fout bij ophalen templates';
  } finally {
    loading.value = false;
  }
}

async function fetchTeams() {
  try {
    const response = await axios.get('/api/teams');
    teams.value = response.data.map(t => ({
      id: t._id || t.id,
      name: t.name,
    }));
  } catch (err) {
    console.error('Error fetching teams:', err);
  }
}

async function fetchProjects() {
  try {
    const response = await axios.get('/api/projects');
    projects.value = response.data.map(p => ({
      id: p._id || p.id,
      name: p.name,
      team: p.team?._id || p.team || p.teamId,
    }));
  } catch (err) {
    console.error('Error fetching projects:', err);
  }
}

function onScopeChange() {
  if (formData.value.scope === 'GLOBAL') {
    formData.value.teamId = '';
    formData.value.projectId = '';
  } else if (formData.value.scope === 'TEAM') {
    formData.value.projectId = '';
  }
}

function onTeamChange() {
  if (formData.value.teamId) {
    fetchProjects();
  } else {
    formData.value.projectId = '';
  }
}

function editTemplate(template) {
  editingTemplate.value = template;
  formData.value = {
    name: template.name,
    description: template.description || '',
    prompt: template.prompt,
    scope: template.scope,
    teamId: template.team?._id || template.team || '',
    projectId: template.project?._id || template.project || '',
  };
  if (formData.value.teamId) {
    fetchProjects();
  }
  showCreateModal.value = true;
}

async function saveTemplate() {
  saving.value = true;
  error.value = null;
  try {
    const data = {
      name: formData.value.name,
      description: formData.value.description,
      prompt: formData.value.prompt,
      scope: formData.value.scope,
    };
    
    if (formData.value.scope !== 'GLOBAL') {
      data.teamId = formData.value.teamId;
    }
    
    if (formData.value.scope === 'PROJECT' && formData.value.projectId) {
      data.projectId = formData.value.projectId;
    }
    
    if (editingTemplate.value) {
      await axios.put(`/api/prompt-templates/${editingTemplate.value.id}`, data);
    } else {
      await axios.post('/api/prompt-templates', data);
    }
    
    closeModal();
    await fetchTemplates();
  } catch (err) {
    console.error('Error saving template:', err);
    error.value = err.response?.data?.error || 'Fout bij opslaan template';
  } finally {
    saving.value = false;
  }
}

async function deleteTemplate(template) {
  if (!confirm(`Weet je zeker dat je "${template.name}" wilt verwijderen?`)) {
    return;
  }
  
  try {
    await axios.delete(`/api/prompt-templates/${template.id}`);
    await fetchTemplates();
  } catch (err) {
    console.error('Error deleting template:', err);
    error.value = err.response?.data?.error || 'Fout bij verwijderen template';
  }
}

function closeModal() {
  showCreateModal.value = false;
  editingTemplate.value = null;
  formData.value = {
    name: '',
    description: '',
    prompt: '',
    scope: 'TEAM',
    teamId: '',
    projectId: '',
  };
}

function truncatePrompt(prompt) {
  if (prompt.length <= 200) return prompt;
  return prompt.substring(0, 200) + '...';
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('nl-NL');
}

onMounted(async () => {
  await fetchTeams();
  await fetchProjects();
  await fetchTemplates();
});
</script>

<style scoped>
.prompt-templates-tab {
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
}

.section-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-6);
}

.filter-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.filter-group select {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--spacing-6);
}

.template-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-4);
}

.template-header h3 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  flex: 1;
}

.template-badge {
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
}

.badge-global {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.badge-team {
  background: var(--color-success);
  color: var(--color-text-inverse);
}

.badge-project {
  background: var(--color-warning);
  color: var(--color-text-inverse);
}

.template-body {
  flex: 1;
  margin-bottom: var(--spacing-4);
}

.template-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-3);
  line-height: var(--line-height-relaxed);
}

.template-meta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--spacing-4);
}

.template-meta span {
  display: flex;
  gap: var(--spacing-2);
}

.template-preview {
  background: var(--color-bg-secondary);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.template-preview strong {
  display: block;
  margin-bottom: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.template-preview pre {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  font-family: 'Monaco', 'Courier New', monospace;
}

.template-actions {
  display: flex;
  gap: var(--spacing-3);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border);
}

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
}

.modal-content {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--font-size-3xl);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: all var(--transition-base);
}

.modal-close:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.modal-body {
  padding: var(--spacing-6);
}

.form-group {
  margin-bottom: var(--spacing-4);
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
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.form-group textarea {
  resize: vertical;
  font-family: 'Monaco', 'Courier New', monospace;
}

.prompt-textarea {
  min-height: 200px;
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-2);
}

.btn-danger {
  padding: var(--spacing-3) var(--spacing-5);
  background: var(--color-error);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-error-dark);
}
</style>

