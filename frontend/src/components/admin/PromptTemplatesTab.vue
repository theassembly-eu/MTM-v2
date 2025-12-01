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
          
          <!-- Template Type Toggle -->
          <div class="form-group">
            <label>Template Type</label>
            <div class="template-type-toggle">
              <button 
                type="button"
                :class="['toggle-btn', { active: !formData.useComponents }]"
                @click="formData.useComponents = false"
              >
                📝 Volledige Tekst
              </button>
              <button 
                type="button"
                :class="['toggle-btn', { active: formData.useComponents }]"
                @click="formData.useComponents = true"
              >
                🧩 Componenten
              </button>
            </div>
          </div>

          <!-- Full Text Mode -->
          <div v-if="!formData.useComponents" class="form-group">
            <label>Prompt *</label>
            <textarea v-model="formData.prompt" rows="10" required class="prompt-textarea"></textarea>
            <p class="form-hint">
              Je kunt een gegenereerde prompt hier plakken of handmatig een prompt schrijven.
            </p>
          </div>

          <!-- Component-Based Mode -->
          <div v-if="formData.useComponents" class="component-builder">
            <div class="form-group">
              <label>Selecteer System Template Componenten</label>
              <div class="component-selector">
                <select v-model="selectedComponentToAdd" @change="addComponent">
                  <option value="">Selecteer component om toe te voegen...</option>
                  <optgroup v-for="(templates, type) in systemTemplatesByType" :key="type" :label="getTypeLabel(type)">
                    <option 
                      v-for="template in templates" 
                      :key="template._id" 
                      :value="template._id"
                      :disabled="isComponentAdded(template._id)"
                    >
                      {{ template.name }} - {{ template.description || 'Geen beschrijving' }}
                    </option>
                  </optgroup>
                </select>
              </div>
            </div>

            <!-- Selected Components List -->
            <div class="selected-components">
              <h4>Geselecteerde Componenten (volgorde bepaalt de prompt structuur)</h4>
              <div v-if="formData.componentReferences.length === 0" class="no-components">
                Geen componenten geselecteerd. Selecteer componenten uit de dropdown hierboven.
              </div>
              <div 
                v-for="(component, index) in formData.componentReferences" 
                :key="component.systemTemplateId"
                class="component-item"
              >
                <div class="component-header">
                  <span class="component-order">{{ index + 1 }}</span>
                  <span class="component-name">{{ component.systemTemplateName }}</span>
                  <span class="component-type">{{ getComponentType(component.systemTemplateId) }}</span>
                </div>
                <div class="component-actions">
                  <button 
                    type="button"
                    @click="moveComponent(index, 'up')" 
                    :disabled="index === 0"
                    class="btn-icon-small"
                    title="Omhoog"
                  >
                    ↑
                  </button>
                  <button 
                    type="button"
                    @click="moveComponent(index, 'down')" 
                    :disabled="index === formData.componentReferences.length - 1"
                    class="btn-icon-small"
                    title="Omlaag"
                  >
                    ↓
                  </button>
                  <button 
                    type="button"
                    @click="toggleComponent(index)"
                    :class="['btn-toggle', component.enabled ? 'enabled' : 'disabled']"
                    :title="component.enabled ? 'Uitschakelen' : 'Inschakelen'"
                  >
                    {{ component.enabled ? '✓' : '✗' }}
                  </button>
                  <button 
                    type="button"
                    @click="removeComponent(index)"
                    class="btn-icon-small btn-danger"
                    title="Verwijderen"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <!-- Preview Section -->
            <div class="form-group">
              <label>
                Preview
                <button 
                  type="button"
                  @click="previewTemplate"
                  class="btn-secondary btn-sm"
                  :disabled="previewLoading || formData.componentReferences.length === 0"
                >
                  {{ previewLoading ? 'Laden...' : 'Vernieuw Preview' }}
                </button>
              </label>
              <div v-if="previewPrompt" class="preview-box">
                <pre>{{ previewPrompt }}</pre>
              </div>
              <div v-else class="preview-placeholder">
                Klik op "Vernieuw Preview" om een voorbeeld van de samengestelde prompt te zien.
              </div>
            </div>
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
              :disabled="saving || !formData.name || (!formData.useComponents && !formData.prompt) || (formData.useComponents && formData.componentReferences.length === 0)"
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
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';

const { user, userTeams } = useAuth();
const { success, error: showError } = useToast();
const { confirm } = useConfirm();
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
  useComponents: false,
  componentReferences: [],
  scope: 'TEAM',
  teamId: '',
  projectId: '',
});

const systemTemplates = ref([]);
const selectedComponentToAdd = ref('');
const previewPrompt = ref('');
const previewLoading = ref(false);

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

const systemTemplatesByType = computed(() => {
  const grouped = {};
  systemTemplates.value.forEach(template => {
    if (!grouped[template.type]) {
      grouped[template.type] = [];
    }
    grouped[template.type].push(template);
  });
  return grouped;
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
      prompt: t.prompt || '',
      useComponents: t.useComponents || false,
      componentReferences: t.componentReferences || [],
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

async function fetchSystemTemplates() {
  try {
    const response = await axios.get('/api/system-prompt-templates');
    systemTemplates.value = response.data.filter(t => t.isActive !== false);
    console.log('Fetched system templates:', systemTemplates.value.length);
  } catch (err) {
    console.error('Error fetching system templates:', err);
    error.value = err.response?.data?.error || 'Fout bij ophalen system templates';
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
    prompt: template.prompt || '',
    useComponents: template.useComponents || false,
    componentReferences: template.componentReferences ? [...template.componentReferences] : [],
    scope: template.scope,
    teamId: template.team?._id || template.team || '',
    projectId: template.project?._id || template.project || '',
  };
  if (formData.value.teamId) {
    fetchProjects();
  }
  previewPrompt.value = '';
  showCreateModal.value = true;
}

async function saveTemplate() {
  // Validate
  if (!formData.value.name) {
    error.value = 'Naam is verplicht';
    return;
  }

  if (!formData.value.useComponents && !formData.value.prompt?.trim()) {
    error.value = 'Prompt is verplicht wanneer volledige tekst modus wordt gebruikt';
    return;
  }

  if (formData.value.useComponents && formData.value.componentReferences.length === 0) {
    error.value = 'Selecteer minimaal één component wanneer component modus wordt gebruikt';
    return;
  }

  saving.value = true;
  error.value = null;
  try {
    const data = {
      name: formData.value.name,
      description: formData.value.description,
      scope: formData.value.scope,
      useComponents: formData.value.useComponents,
    };
    
    if (formData.value.useComponents) {
      data.componentReferences = formData.value.componentReferences.map((ref, index) => ({
        systemTemplateId: ref.systemTemplateId,
        order: index,
        enabled: ref.enabled !== false,
      }));
    } else {
      data.prompt = formData.value.prompt;
    }
    
    if (formData.value.scope !== 'GLOBAL') {
      data.teamId = formData.value.teamId;
    }
    
    if (formData.value.scope === 'PROJECT' && formData.value.projectId) {
      data.projectId = formData.value.projectId;
    }
    
    if (editingTemplate.value) {
      await axios.put(`/api/prompt-templates/${editingTemplate.value.id}`, data);
      success('Template succesvol bijgewerkt');
    } else {
      await axios.post('/api/prompt-templates', data);
      success('Template succesvol aangemaakt');
    }
    
    closeModal();
    await fetchTemplates();
  } catch (err) {
    console.error('Error saving template:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij opslaan template';
    error.value = errorMsg;
    showError(errorMsg);
  } finally {
    saving.value = false;
  }
}

function addComponent() {
  if (!selectedComponentToAdd.value) return;
  
  const template = systemTemplates.value.find(t => t._id === selectedComponentToAdd.value);
  if (!template) return;

  const newComponent = {
    systemTemplateId: template._id,
    systemTemplateName: template.name,
    order: formData.value.componentReferences.length,
    enabled: true,
  };

  formData.value.componentReferences.push(newComponent);
  selectedComponentToAdd.value = '';
  previewPrompt.value = ''; // Clear preview when components change
}

function removeComponent(index) {
  formData.value.componentReferences.splice(index, 1);
  // Reorder remaining components
  formData.value.componentReferences.forEach((ref, idx) => {
    ref.order = idx;
  });
  previewPrompt.value = '';
}

function moveComponent(index, direction) {
  if (direction === 'up' && index > 0) {
    const temp = formData.value.componentReferences[index];
    formData.value.componentReferences[index] = formData.value.componentReferences[index - 1];
    formData.value.componentReferences[index - 1] = temp;
    // Update orders
    formData.value.componentReferences.forEach((ref, idx) => {
      ref.order = idx;
    });
    previewPrompt.value = '';
  } else if (direction === 'down' && index < formData.value.componentReferences.length - 1) {
    const temp = formData.value.componentReferences[index];
    formData.value.componentReferences[index] = formData.value.componentReferences[index + 1];
    formData.value.componentReferences[index + 1] = temp;
    // Update orders
    formData.value.componentReferences.forEach((ref, idx) => {
      ref.order = idx;
    });
    previewPrompt.value = '';
  }
}

function toggleComponent(index) {
  formData.value.componentReferences[index].enabled = !formData.value.componentReferences[index].enabled;
  previewPrompt.value = '';
}

function isComponentAdded(templateId) {
  return formData.value.componentReferences.some(ref => ref.systemTemplateId === templateId);
}

function getComponentType(templateId) {
  const template = systemTemplates.value.find(t => t._id === templateId);
  return template ? getTypeLabel(template.type) : 'Unknown';
}

function getTypeLabel(type) {
  const labels = {
    role: 'Rol',
    context: 'Context',
    instruction: 'Instructie',
    structure: 'Structuur',
    behavior: 'Gedrag',
  };
  return labels[type] || type;
}

async function previewTemplate() {
  if (formData.value.componentReferences.length === 0) {
    previewPrompt.value = '';
    return;
  }

  previewLoading.value = true;
  try {
    // Create a temporary template object for preview
    const previewData = {
      useComponents: true,
      componentReferences: formData.value.componentReferences
        .filter(ref => ref.enabled !== false)
        .map((ref, index) => ({
          systemTemplateId: ref.systemTemplateId,
          order: index,
          enabled: true,
        })),
    };

    // Use a mock context for preview
    const context = {
      language: 'Dutch',
      lvl: { name: 'Local', code: 'LOCAL' },
      outputFormat: { name: 'Samenvatting' },
    };

    // Try to use the preview endpoint if available, otherwise assemble manually
    try {
      // Create a temporary template ID for preview (we'll use a special endpoint)
      // For now, assemble manually from system templates
      const componentIds = formData.value.componentReferences
        .filter(ref => ref.enabled !== false)
        .map(ref => ref.systemTemplateId);
      
      const components = systemTemplates.value.filter(t => componentIds.includes(t._id));
      const sortedComponents = formData.value.componentReferences
        .filter(ref => ref.enabled !== false)
        .map(ref => components.find(c => c._id === ref.systemTemplateId))
        .filter(Boolean);

      // Simple assembly - just join the content
      // In a real scenario, variables would be resolved
      previewPrompt.value = sortedComponents.map(c => {
        let content = c.content;
        // Basic variable replacement for preview
        content = content.replace(/\{\{language\}\}/g, 'Dutch');
        content = content.replace(/\{\{lvl\.name\}\}/g, 'Local');
        content = content.replace(/\{\{lvl\.code\}\}/g, 'LOCAL');
        content = content.replace(/\{\{outputFormat\.name\}\}/g, 'Samenvatting');
        return content;
      }).join('\n\n');
    } catch (err) {
      console.error('Error assembling preview:', err);
      previewPrompt.value = 'Fout bij laden preview: ' + (err.message || 'Onbekende fout');
    }
  } catch (err) {
    console.error('Error previewing template:', err);
    previewPrompt.value = 'Fout bij laden preview';
  } finally {
    previewLoading.value = false;
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
    
    await axios.delete(`/api/prompt-templates/${template.id}`);
    success('Template succesvol verwijderd');
    await fetchTemplates();
  } catch (err) {
    if (err === false) return; // User cancelled
    console.error('Error deleting template:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij verwijderen template';
    error.value = errorMsg;
    showError(errorMsg);
  }
}

function closeModal() {
  showCreateModal.value = false;
  editingTemplate.value = null;
  formData.value = {
    name: '',
    description: '',
    prompt: '',
    useComponents: false,
    componentReferences: [],
    scope: 'TEAM',
    teamId: '',
    projectId: '',
  };
  previewPrompt.value = '';
  selectedComponentToAdd.value = '';
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
  await fetchSystemTemplates();
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

/* Template Type Toggle */
.template-type-toggle {
  display: flex;
  gap: var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-1);
  background: var(--color-bg-secondary);
}

.toggle-btn {
  flex: 1;
  padding: var(--spacing-2) var(--spacing-4);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.toggle-btn.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-weight: var(--font-weight-medium);
}

.toggle-btn:hover:not(.active) {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

/* Component Builder */
.component-builder {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
}

.component-selector select {
  width: 100%;
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.selected-components {
  margin-top: var(--spacing-4);
}

.selected-components h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-3) 0;
}

.no-components {
  padding: var(--spacing-4);
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
}

.component-item {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-3);
  margin-bottom: var(--spacing-2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.component-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  flex: 1;
}

.component-order {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.component-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.component-type {
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.component-actions {
  display: flex;
  gap: var(--spacing-2);
}

.btn-icon-small {
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.btn-icon-small:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
}

.btn-icon-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-toggle {
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
  min-width: 32px;
}

.btn-toggle.enabled {
  background: var(--color-success);
  color: var(--color-text-inverse);
  border-color: var(--color-success);
}

.btn-toggle.disabled {
  background: var(--color-error);
  color: var(--color-text-inverse);
  border-color: var(--color-error);
}

.btn-toggle:hover {
  opacity: 0.8;
}

.preview-box {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
  max-height: 400px;
  overflow-y: auto;
}

.preview-box pre {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  font-family: 'Monaco', 'Courier New', monospace;
  line-height: 1.5;
}

.preview-placeholder {
  padding: var(--spacing-4);
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
}

.btn-sm {
  padding: var(--spacing-1) var(--spacing-3);
  font-size: var(--font-size-xs);
  margin-left: var(--spacing-2);
}

.template-type-badge {
  display: inline-block;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  margin-left: var(--spacing-2);
}

.template-type-badge.component-based {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.template-type-badge.full-text {
  background: rgba(156, 163, 175, 0.1);
  color: #6b7280;
}
</style>

