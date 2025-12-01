<template>
  <div class="system-prompt-templates-tab">
    <div class="section-header">
      <h2>Systeem Prompt Templates</h2>
      <div class="header-actions">
        <button @click="runMigration" class="btn-secondary" :disabled="migrating">
          {{ migrating ? 'Migratie bezig...' : 'Run Migratie' }}
        </button>
        <button @click="showCreateModal" class="btn-primary">
          Nieuw Template
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Filter -->
    <div class="filters">
      <select v-model="filterType" @change="fetchTemplates" class="filter-select">
        <option value="">Alle Types</option>
        <option value="role">Role</option>
        <option value="context">Context</option>
        <option value="instruction">Instruction</option>
        <option value="structure">Structure</option>
        <option value="behavior">Behavior</option>
      </select>
      <label class="filter-checkbox">
        <input type="checkbox" v-model="filterActive" @change="fetchTemplates" />
        Alleen Actieve
      </label>
    </div>

    <!-- Templates List -->
    <div v-if="!loading && templates.length > 0" class="templates-list">
      <div v-for="template in templates" :key="template._id || template.id" class="template-card">
        <div class="template-header">
          <div class="template-info">
            <h3>{{ template.name }}</h3>
            <div class="template-meta">
              <span class="badge" :class="`badge-${template.type}`">{{ template.type }}</span>
              <span class="badge" :class="template.isActive ? 'badge-active' : 'badge-inactive'">
                {{ template.isActive ? 'Actief' : 'Inactief' }}
              </span>
              <span class="priority">Prioriteit: {{ template.priority }}</span>
              <span class="version">v{{ template.version }}</span>
            </div>
          </div>
          <div class="template-actions">
            <button @click="viewVersionHistory(template)" class="btn-version">Versies</button>
            <button @click="editTemplate(template)" class="btn-edit">Bewerken</button>
            <button @click="deleteTemplate(template)" class="btn-delete">Verwijderen</button>
          </div>
        </div>
        <div class="template-description">
          <p>{{ template.description || 'Geen beschrijving' }}</p>
        </div>
        <div class="template-content-preview">
          <strong>Content:</strong>
          <pre>{{ truncateContent(template.content) }}</pre>
        </div>
        <div v-if="template.variables && template.variables.length > 0" class="template-variables">
          <strong>Variabelen:</strong>
          <ul>
            <li v-for="(varItem, idx) in template.variables" :key="idx">
              {{ varItem.name }} ({{ varItem.source }}) {{ varItem.required ? '*required' : '' }}
            </li>
          </ul>
        </div>
        <div v-if="template.conditions && template.conditions.length > 0" class="template-conditions">
          <strong>Voorwaarden:</strong>
          <ul>
            <li v-for="(condition, idx) in template.conditions" :key="idx">
              {{ condition.field }} {{ condition.operator }} {{ condition.value || '' }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="!loading && templates.length === 0" class="empty-state">
      <p>Geen templates gevonden. Run de migratie om templates te maken.</p>
    </div>

    <!-- Version History Modal -->
    <div v-if="showVersionModal" class="modal-overlay" @click="closeVersionModal">
      <div class="modal modal-large" @click.stop>
        <h3>Versie Geschiedenis: {{ selectedTemplateForVersion?.name }}</h3>
        <div v-if="versionHistoryLoading" class="loading">Laden...</div>
        <div v-else>
          <div class="version-info">
            <p><strong>Huidige Versie:</strong> {{ versionHistoryData?.currentVersion || 'N/A' }}</p>
            <p><strong>Aantal Versies:</strong> {{ (versionHistoryData?.versionHistory?.length || 0) + 1 }}</p>
          </div>
          <div class="version-list">
            <div class="version-item current">
              <div class="version-header">
                <span class="version-badge current">Huidige Versie</span>
                <span class="version-number">{{ selectedTemplateForVersion?.currentVersion || selectedTemplateForVersion?.version }}</span>
              </div>
              <div class="version-content">
                <pre>{{ truncateContent(selectedTemplateForVersion?.content) }}</pre>
              </div>
            </div>
            <div v-for="(version, idx) in versionHistoryData?.versionHistory || []" :key="idx" class="version-item">
              <div class="version-header">
                <span class="version-badge">v{{ version.version }}</span>
                <span class="version-date">{{ formatDate(version.createdAt) }}</span>
                <button @click="rollbackToVersion(version.version)" class="btn-rollback">Terugzetten</button>
              </div>
              <div v-if="version.changeNotes" class="version-notes">
                <strong>Notities:</strong> {{ version.changeNotes }}
              </div>
              <div class="version-content">
                <pre>{{ truncateContent(version.content) }}</pre>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeVersionModal" class="btn-secondary">Sluiten</button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal modal-large" @click.stop>
        <h3>{{ editingTemplate ? 'Template Bewerken' : 'Nieuw Template' }}</h3>
        <form @submit.prevent="saveTemplate">
          <div class="form-group">
            <label>Naam *</label>
            <input v-model="templateForm.name" type="text" required :disabled="editingTemplate" />
          </div>

          <div class="form-group">
            <label>Beschrijving</label>
            <textarea v-model="templateForm.description" rows="2"></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Type *</label>
              <select v-model="templateForm.type" required>
                <option value="role">Role</option>
                <option value="context">Context</option>
                <option value="instruction">Instruction</option>
                <option value="structure">Structure</option>
                <option value="behavior">Behavior</option>
              </select>
            </div>

            <div class="form-group">
              <label>Prioriteit</label>
              <input v-model.number="templateForm.priority" type="number" />
            </div>

            <div class="form-group">
              <label>Versie</label>
              <input v-model="templateForm.version" type="text" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>
                <input type="checkbox" v-model="templateForm.isActive" />
                Actief
              </label>
            </div>
            <div class="form-group" v-if="editingTemplate">
              <label>
                <input type="checkbox" v-model="templateForm.createNewVersion" />
                Nieuwe Versie Aanmaken
              </label>
              <small>Huidige versie wordt opgeslagen in geschiedenis</small>
            </div>
          </div>
          
          <div class="form-group" v-if="editingTemplate && templateForm.createNewVersion">
            <label>Wijzigingsnotities</label>
            <textarea v-model="templateForm.changeNotes" rows="2" placeholder="Beschrijf waarom deze versie wordt aangemaakt..."></textarea>
          </div>

          <div class="form-group">
            <label>Content *</label>
            <textarea v-model="templateForm.content" rows="8" required placeholder="Template content met {{variabelen}}"></textarea>
            <small>Gebruik {{variabeleNaam}} voor variabelen</small>
          </div>

          <div class="form-group">
            <label>Variabelen</label>
            <div v-for="(varItem, idx) in templateForm.variables" :key="idx" class="variable-item">
              <input v-model="varItem.name" placeholder="Variabele naam" />
              <input v-model="varItem.source" placeholder="context.field.path" />
              <label>
                <input type="checkbox" v-model="varItem.required" />
                Required
              </label>
              <input v-model="varItem.defaultValue" placeholder="Default waarde" />
              <button type="button" @click="removeVariable(idx)" class="btn-remove">×</button>
            </div>
            <button type="button" @click="addVariable" class="btn-add">+ Variabele Toevoegen</button>
          </div>

          <div class="form-group">
            <label>Voorwaarden</label>
            <div v-for="(condition, idx) in templateForm.conditions" :key="idx" class="condition-item">
              <input v-model="condition.field" placeholder="context.field" />
              <select v-model="condition.operator">
                <option value="equals">equals</option>
                <option value="notEquals">notEquals</option>
                <option value="exists">exists</option>
                <option value="notExists">notExists</option>
                <option value="in">in</option>
              </select>
              <input v-model="condition.value" placeholder="Waarde (optioneel)" />
              <button type="button" @click="removeCondition(idx)" class="btn-remove">×</button>
            </div>
            <button type="button" @click="addCondition" class="btn-add">+ Voorwaarde Toevoegen</button>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn-secondary">Annuleren</button>
            <button type="submit" class="btn-primary">Opslaan</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from '../../utils/axios.js';
import { useAuth } from '../../composables/useAuth.js';

const { hasRole } = useAuth();

const templates = ref([]);
const { success, error: showError } = useToast();
const { confirm } = useConfirm();

const loading = ref(false);
const error = ref(null);
const showModal = ref(false);
const editingTemplate = ref(null);
const migrating = ref(false);
const showVersionModal = ref(false);
const selectedTemplateForVersion = ref(null);
const versionHistoryData = ref(null);
const versionHistoryLoading = ref(false);

const filterType = ref('');
const filterActive = ref(false);

const templateForm = ref({
  name: '',
  description: '',
  type: 'instruction',
  content: '',
  variables: [],
  conditions: [],
  priority: 0,
  version: '1.0.0',
  isActive: true,
  metadata: {},
  createNewVersion: false,
  changeNotes: '',
});

async function fetchTemplates() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (filterType.value) params.append('type', filterType.value);
    if (filterActive.value) params.append('isActive', 'true');
    
    const response = await axios.get(`/api/system-prompt-templates?${params.toString()}`);
    templates.value = response.data;
  } catch (err) {
    console.error('Error fetching templates:', err);
    error.value = 'Fout bij het ophalen van templates';
  } finally {
    loading.value = false;
  }
}

async function runMigration() {
  try {
    const confirmed = await confirm({
      title: 'Migratie uitvoeren',
      message: 'Weet je zeker dat je de migratie wilt uitvoeren?',
      description: 'Dit zal bestaande templates updaten.',
      type: 'warning',
      confirmText: 'Uitvoeren',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    migrating.value = true;
    error.value = null;
    try {
      const response = await axios.post('/api/migrations/prompt-sections-to-templates');
      const summary = response.data.summary;
      success(
        'Migratie voltooid!',
        `Aangemaakt: ${summary.created}, Bijgewerkt: ${summary.updated}, Overgeslagen: ${summary.skipped}`,
        8000
      );
      await fetchTemplates();
    } catch (err) {
      console.error('Migration error:', err);
      const errorMsg = err.response?.data?.error || 'Migratie mislukt';
      error.value = errorMsg;
      showError(errorMsg);
    } finally {
      migrating.value = false;
    }
  } catch (err) {
    if (err === false) return; // User cancelled
  }
}

function showCreateModal() {
  editingTemplate.value = null;
  templateForm.value = {
    name: '',
    description: '',
    type: 'instruction',
    content: '',
    variables: [],
    conditions: [],
    priority: 0,
    version: '1.0.0',
    isActive: true,
    metadata: {},
  };
  showModal.value = true;
}

function editTemplate(template) {
  console.log('Editing template:', template);
  editingTemplate.value = template;
  templateForm.value = {
    name: template.name || '',
    description: template.description || '',
    type: template.type || 'instruction',
    content: template.content || '',
    variables: template.variables && Array.isArray(template.variables) ? template.variables.map(v => ({
      name: v.name || '',
      source: v.source || '',
      required: v.required || false,
      defaultValue: v.defaultValue || '',
    })) : [],
    conditions: template.conditions && Array.isArray(template.conditions) ? template.conditions.map(c => ({
      field: c.field || '',
      operator: c.operator || 'equals',
      value: c.value || '',
    })) : [],
    priority: template.priority !== undefined ? template.priority : 0,
    version: template.version || '1.0.0',
    isActive: template.isActive !== undefined ? template.isActive : true,
    metadata: template.metadata || {},
    createNewVersion: false,
    changeNotes: '',
  };
  console.log('Template form:', templateForm.value);
  showModal.value = true;
}

async function viewVersionHistory(template) {
  selectedTemplateForVersion.value = template;
  versionHistoryLoading.value = true;
  showVersionModal.value = true;
  
  try {
    const response = await axios.get(`/api/system-prompt-templates/${template._id || template.id}/versions`);
    versionHistoryData.value = response.data;
  } catch (err) {
    console.error('Error fetching version history:', err);
    error.value = err.response?.data?.error || 'Fout bij het ophalen van versie geschiedenis';
  } finally {
    versionHistoryLoading.value = false;
  }
}

function closeVersionModal() {
  showVersionModal.value = false;
  selectedTemplateForVersion.value = null;
  versionHistoryData.value = null;
}

async function rollbackToVersion(version) {
  try {
    const confirmed = await confirm({
      title: 'Versie terugzetten',
      message: `Weet je zeker dat je terug wilt zetten naar versie ${version}?`,
      description: 'De huidige versie wordt opgeslagen in de geschiedenis.',
      type: 'warning',
      confirmText: 'Terugzetten',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    try {
      await axios.post(`/api/system-prompt-templates/${selectedTemplateForVersion.value._id || selectedTemplateForVersion.value.id}/rollback`, {
        version,
      });
      success('Versie succesvol teruggezet!');
      await fetchTemplates();
      await viewVersionHistory(selectedTemplateForVersion.value); // Refresh version history
    } catch (err) {
      console.error('Error rolling back version:', err);
      const errorMsg = err.response?.data?.error || 'Fout bij terugzetten van versie';
      error.value = errorMsg;
      showError(errorMsg);
    }
  } catch (err) {
    if (err === false) return; // User cancelled
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('nl-NL');
}

function closeModal() {
  showModal.value = false;
  editingTemplate.value = null;
}

async function saveTemplate() {
  try {
    if (editingTemplate.value) {
      const payload = { ...templateForm.value };
      // Only send createNewVersion and changeNotes if checkbox is checked
      if (!payload.createNewVersion) {
        delete payload.createNewVersion;
        delete payload.changeNotes;
      }
      await axios.put(`/api/system-prompt-templates/${editingTemplate.value._id || editingTemplate.value.id}`, payload);
    } else {
      // Remove versioning fields for new templates
      const payload = { ...templateForm.value };
      delete payload.createNewVersion;
      delete payload.changeNotes;
      await axios.post('/api/system-prompt-templates', payload);
    }
    await fetchTemplates();
    closeModal();
    if (editingTemplate.value) {
      success('Template succesvol bijgewerkt');
    } else {
      success('Template succesvol aangemaakt');
    }
  } catch (err) {
    console.error('Error saving template:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het opslaan van template';
    error.value = errorMsg;
    showError(errorMsg);
  }
}

async function deleteTemplate(template) {
  try {
    const confirmed = await confirm({
      title: 'Template verwijderen',
      message: `Weet je zeker dat je "${template.name}" wilt verwijderen?`,
      description: 'Deze actie kan niet ongedaan worden gemaakt.',
      type: 'danger',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    await axios.delete(`/api/system-prompt-templates/${template._id || template.id}`);
    success('Template succesvol verwijderd');
    await fetchTemplates();
  } catch (err) {
    if (err === false) return; // User cancelled
    console.error('Error deleting template:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het verwijderen van template';
    error.value = errorMsg;
    showError(errorMsg);
  }
}

function addVariable() {
  templateForm.value.variables.push({
    name: '',
    source: '',
    required: false,
    defaultValue: '',
  });
}

function removeVariable(idx) {
  templateForm.value.variables.splice(idx, 1);
}

function addCondition() {
  templateForm.value.conditions.push({
    field: '',
    operator: 'equals',
    value: '',
  });
}

function removeCondition(idx) {
  templateForm.value.conditions.splice(idx, 1);
}

function truncateContent(content) {
  if (!content) return '';
  return content.length > 200 ? content.substring(0, 200) + '...' : content;
}

onMounted(() => {
  if (hasRole('SUPER_ADMIN')) {
    fetchTemplates();
  }
});
</script>

<style scoped>
.system-prompt-templates-tab {
  padding: 1rem 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.template-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: white;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.template-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
}

.template-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.badge-role { background: #e3f2fd; color: #1976d2; }
.badge-context { background: #f3e5f5; color: #7b1fa2; }
.badge-instruction { background: #e8f5e9; color: #388e3c; }
.badge-structure { background: #fff3e0; color: #f57c00; }
.badge-behavior { background: #fce4ec; color: #c2185b; }
.badge-active { background: #e8f5e9; color: #388e3c; }
.badge-inactive { background: #ffebee; color: #d32f2f; }

.priority, .version {
  font-size: 0.85rem;
  color: #666;
}

.template-actions {
  display: flex;
  gap: 0.5rem;
}

.template-description {
  margin: 0.5rem 0;
  color: #666;
}

.template-content-preview {
  margin: 0.5rem 0;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.template-content-preview pre {
  margin: 0.5rem 0 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9rem;
}

.template-variables,
.template-conditions {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.template-variables ul,
.template-conditions ul {
  margin: 0.25rem 0;
  padding-left: 1.5rem;
}

.modal-large {
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.variable-item,
.condition-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto 1fr auto;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: #f9f9f9;
  border-radius: 4px;
}

.btn-remove {
  background: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
}

.btn-add {
  background: #4caf50;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #666;
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
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group textarea {
  resize: vertical;
  font-family: monospace;
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #666;
  font-size: 0.85rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #ddd;
}

.btn-primary,
.btn-secondary,
.btn-edit,
.btn-delete {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-secondary {
  background: #9e9e9e;
  color: white;
}

.btn-secondary:hover {
  background: #757575;
}

.btn-edit {
  background: #2196f3;
  color: white;
}

.btn-edit:hover {
  background: #1976d2;
}

.btn-delete {
  background: #f44336;
  color: white;
}

.btn-delete:hover {
  background: #d32f2f;
}

.btn-version {
  background: #9c27b0;
  color: white;
}

.btn-version:hover {
  background: #7b1fa2;
}

.version-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.version-info p {
  margin: 0.5rem 0;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 60vh;
  overflow-y: auto;
}

.version-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: white;
}

.version-item.current {
  border-color: #4caf50;
  background: #f1f8f4;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.version-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  background: #e0e0e0;
  color: #333;
}

.version-badge.current {
  background: #4caf50;
  color: white;
}

.version-number {
  font-weight: 600;
  color: #333;
}

.version-date {
  font-size: 0.85rem;
  color: #666;
}

.btn-rollback {
  background: #ff9800;
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-rollback:hover {
  background: #f57c00;
}

.version-notes {
  margin: 0.5rem 0;
  padding: 0.5rem;
  background: #fff3cd;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #856404;
}

.version-content {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f9f9f9;
  border-radius: 4px;
}

.version-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  max-height: 200px;
  overflow-y: auto;
}
</style>

