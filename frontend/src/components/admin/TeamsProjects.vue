<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Teams & Projecten Beheer</h1>
      <p class="page-subtitle">Beheer teams, projecten en hun communicatieniveaus</p>
    </div>

    <LoadingSpinner v-if="loading" message="Teams en projecten laden..." />
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Teams List -->
    <div class="teams-section">
      <div class="section-header">
        <h2>Teams</h2>
        <button 
          v-if="canCreateTeam" 
          @click="showCreateTeamModal = true" 
          class="btn-primary"
        >
          Nieuw Team
        </button>
      </div>

      <div class="search-section">
        <SearchInput
          v-model="teamSearchQuery"
          @search="handleTeamSearch"
          placeholder="Zoeken op teamnaam..."
          label="Zoeken teams"
        />
      </div>

      <EmptyState
        v-if="filteredTeams.length === 0"
        icon="👥"
        title="Geen teams gevonden"
        description="Maak je eerste team aan om projecten en communicatieniveaus te beheren."
        :action-label="canCreateTeam ? 'Nieuw Team' : ''"
        :action-handler="canCreateTeam ? () => showCreateTeamModal = true : null"
      />

      <div v-else class="teams-list">
        <div 
          v-for="team in filteredTeams" 
          :key="team.id" 
          class="team-card"
        >
          <div class="team-header">
            <h3>{{ team.name }}</h3>
            <div class="team-actions">
              <button @click="editTeam(team)" class="btn-edit">Bewerken</button>
              <button 
                v-if="canDeleteTeam" 
                @click="deleteTeam(team.id)" 
                class="btn-delete"
              >
                Verwijderen
              </button>
            </div>
          </div>

          <div class="team-info">
            <p><strong>LVLs:</strong> {{ getTeamLvlNames(team) }}</p>
            <p><strong>Leden:</strong> {{ team.members?.length || 0 }}</p>
          </div>

          <!-- Projects for this team -->
          <div class="projects-section">
            <div class="projects-header">
              <h4>Projecten</h4>
              <button 
                @click="openCreateProjectModal(team)" 
                class="btn-small"
                :disabled="!canCreateProject"
              >
                Nieuw Project
              </button>
            </div>

            <EmptyState
              v-if="teamProjects(team.id).length === 0"
              icon="📁"
              title="Geen projecten"
              description="Voeg een project toe aan dit team om te beginnen."
              :action-label="canCreateProject ? 'Nieuw Project' : ''"
              :action-handler="canCreateProject ? () => openCreateProjectModal(team) : null"
              class="empty-state-small"
            />

            <ul v-else class="projects-list">
              <li 
                v-for="project in teamProjects(team.id)" 
                :key="project.id"
                class="project-item"
              >
                <div class="project-info">
                  <span class="project-name">{{ project.name }}</span>
                  <span class="project-lvls">({{ getProjectLvlNames(project) }})</span>
                </div>
                <div class="project-actions">
                  <button @click="viewApprovedContent(project)" class="btn-view-small" title="Goedgekeurde teksten">📚</button>
                  <button @click="editProject(project)" class="btn-edit-small">Bewerken</button>
                  <button @click="deleteProject(project.id)" class="btn-delete-small">Verwijderen</button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Team Modal -->
    <div v-if="showCreateTeamModal || editingTeam" class="modal-overlay" @click="closeModals">
      <div class="modal" @click.stop>
        <h3>{{ editingTeam ? 'Team Bewerken' : 'Nieuw Team' }}</h3>
        <form @submit.prevent="saveTeam">
          <div class="form-group">
            <label>Team Naam *</label>
            <input v-model="teamForm.name" type="text" required />
          </div>
          <div class="form-group">
            <label>LVLs *</label>
            <div class="checkbox-group">
              <label v-for="lvl in lvls" :key="lvl.id" class="checkbox-label">
                <input 
                  type="checkbox" 
                  :value="lvl.id" 
                  v-model="teamForm.lvls"
                />
                {{ lvl.name }} ({{ lvl.code }})
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Leden</label>
            <select v-model="teamForm.members" multiple class="multi-select">
              <option v-for="user in availableUsers" :key="user.id" :value="user.id">
                {{ user.email }} ({{ user.role }})
              </option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModals" class="btn-cancel">Annuleren</button>
            <button type="submit" :disabled="savingProject" class="btn-primary" :class="{ 'btn-loading': savingProject }">
              <span v-if="savingProject" class="btn-spinner"></span>
              <span>{{ savingProject ? 'Opslaan...' : 'Opslaan' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Create/Edit Project Modal -->
    <div v-if="showCreateProjectModal || editingProject" class="modal-overlay" @click="closeModals">
      <div class="modal" @click.stop>
        <h3>{{ editingProject ? 'Project Bewerken' : 'Nieuw Project' }}</h3>
        <form @submit.prevent="saveProject">
          <div class="form-group">
            <label>Project Naam *</label>
            <input v-model="projectForm.name" type="text" required />
          </div>
          <div class="form-group">
            <label>Team *</label>
            <select v-model="projectForm.team" required :disabled="!!editingProject">
              <option value="">Selecteer team</option>
              <option v-for="team in teams" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>LVLs * (moet subset zijn van team LVLs)</label>
            <div class="checkbox-group">
              <label 
                v-for="lvl in availableProjectLvls" 
                :key="lvl.id" 
                class="checkbox-label"
              >
                <input 
                  type="checkbox" 
                  :value="lvl.id" 
                  v-model="projectForm.lvls"
                />
                {{ lvl.name }} ({{ lvl.code }})
              </label>
            </div>
          </div>
          <div class="form-group">
            <label>Beschrijving</label>
            <textarea v-model="projectForm.description" rows="3"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="closeModals" class="btn-cancel">Annuleren</button>
            <button type="submit" :disabled="savingTeam" class="btn-primary" :class="{ 'btn-loading': savingTeam }">
              <span v-if="savingTeam" class="btn-spinner"></span>
              <span>{{ savingTeam ? 'Opslaan...' : 'Opslaan' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Approved Content Library Modal -->
    <div v-if="showApprovedContentModal" class="modal-overlay" @click="showApprovedContentModal = false">
      <div class="modal approved-content-modal" @click.stop>
        <div class="modal-header">
          <h3>Goedgekeurde Teksten - {{ currentProject?.name }}</h3>
          <button @click="showApprovedContentModal = false" class="btn-close">×</button>
        </div>
        
        <div class="approved-content-filters">
          <div class="filter-row">
            <input
              v-model="approvedContentSearch"
              type="text"
              placeholder="Zoeken in teksten..."
              class="search-input"
            />
            <select v-model="approvedContentLvlFilter" @change="fetchApprovedContent" class="filter-select">
              <option value="">Alle LVLs</option>
              <option v-for="lvl in availableLvls" :key="lvl.id" :value="lvl.id">
                {{ lvl.name }}
              </option>
            </select>
            <select v-model="approvedContentFormatFilter" @change="fetchApprovedContent" class="filter-select">
              <option value="">Alle formaten</option>
              <option v-for="format in availableFormats" :key="format.id" :value="format.id">
                {{ format.name }}
              </option>
            </select>
            <input
              v-model="approvedContentTagFilter"
              type="text"
              placeholder="Filter op tag..."
              @input="fetchApprovedContent"
              class="filter-tag"
            />
            <input
              v-model="approvedContentDateFrom"
              type="date"
              @change="fetchApprovedContent"
              class="filter-date"
              placeholder="Vanaf"
            />
            <input
              v-model="approvedContentDateTo"
              type="date"
              @change="fetchApprovedContent"
              class="filter-date"
              placeholder="Tot"
            />
            <button @click="resetApprovedContentFilters" class="btn-filter-reset">Reset</button>
          </div>
        </div>

        <LoadingSpinner v-if="approvedContentLoading" message="Goedgekeurde teksten laden..." small />
        <div v-else-if="approvedContentError" class="error-message">{{ approvedContentError }}</div>
        <div v-else-if="approvedContent.length === 0" class="empty-state">
          Geen goedgekeurde teksten gevonden voor dit project.
        </div>
        <div v-else class="approved-content-list">
          <div
            v-for="content in approvedContent"
            :key="content._id || content.id"
            class="approved-content-item"
          >
            <div class="content-header">
              <div class="content-meta">
                <span class="content-date">{{ formatDate(content.approvedAt) }}</span>
                <span class="content-lvl">{{ content.lvl?.name || 'N/A' }}</span>
                <span class="content-format">{{ content.outputFormat?.name || 'N/A' }}</span>
              </div>
              <button
                v-if="canDeleteApprovedContent"
                @click="deleteApprovedContent(content._id || content.id)"
                class="btn-delete-small"
                title="Verwijderen"
              >
                🗑️
              </button>
            </div>
            <div class="content-body">
              <div class="content-section">
                <strong>Originele Tekst:</strong>
                <p class="content-text">{{ truncateText(content.originalText, 200) }}</p>
              </div>
              <div class="content-section">
                <strong>Vereenvoudigde Tekst:</strong>
                <p class="content-text">{{ truncateText(content.simplifiedText, 200) }}</p>
              </div>
              <div class="content-tags">
                <div v-if="editingTagsFor !== (content._id || content.id)" class="tags-display">
                  <span v-if="!content.tags || content.tags.length === 0" class="no-tags">Geen tags</span>
                  <span
                    v-for="tag in (content.tags || [])"
                    :key="tag"
                    class="tag-badge"
                  >
                    {{ tag }}
                    <button
                      v-if="canDeleteApprovedContent"
                      @click="removeTag(content, tag)"
                      class="tag-remove"
                      title="Verwijder tag"
                    >
                      ×
                    </button>
                  </span>
                  <button
                    v-if="canDeleteApprovedContent"
                    @click="editTags(content)"
                    class="btn-tag-add"
                    title="Tag toevoegen"
                  >
                    + Tag
                  </button>
                </div>
                <div v-else class="tags-edit">
                  <input
                    v-model="newTagInput"
                    @keyup.enter="addTag(content)"
                    @keyup.esc="cancelEditTags"
                    type="text"
                    placeholder="Tag naam..."
                    class="tag-input"
                  />
                  <button @click="addTag(content)" class="btn-tag-save">Toevoegen</button>
                  <button @click="cancelEditTags" class="btn-tag-cancel">Annuleren</button>
                </div>
              </div>
              <div class="content-footer">
                <span class="content-approver">
                  Goedgekeurd door {{ content.approvedBy?.email || 'Onbekend' }}
                </span>
                <button @click="viewFullContent(content)" class="btn-view-full">Bekijk volledig</button>
              </div>
            </div>
          </div>

          <div v-if="approvedContentPagination.totalPages > 1" class="pagination">
            <button
              @click="changeApprovedContentPage(approvedContentPagination.page - 1)"
              :disabled="approvedContentPagination.page <= 1"
              class="pagination-btn"
            >
              Vorige
            </button>
            <span>
              Pagina {{ approvedContentPagination.page }} van {{ approvedContentPagination.totalPages }}
            </span>
            <button
              @click="changeApprovedContentPage(approvedContentPagination.page + 1)"
              :disabled="approvedContentPagination.page >= approvedContentPagination.totalPages"
              class="pagination-btn"
            >
              Volgende
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Full Content View Modal -->
    <div v-if="showFullContentModal" class="modal-overlay" @click="showFullContentModal = false">
      <div class="modal full-content-modal" @click.stop>
        <div class="modal-header">
          <h3>Goedgekeurde Tekst</h3>
          <button @click="showFullContentModal = false" class="btn-close">×</button>
        </div>
        <div v-if="selectedContent" class="full-content">
          <div class="content-meta-full">
            <p><strong>Goedgekeurd op:</strong> {{ formatDate(selectedContent.approvedAt) }}</p>
            <p><strong>Goedgekeurd door:</strong> {{ selectedContent.approvedBy?.email || 'Onbekend' }}</p>
            <p><strong>LVL:</strong> {{ selectedContent.lvl?.name || 'N/A' }}</p>
            <p><strong>Formaat:</strong> {{ selectedContent.outputFormat?.name || 'N/A' }}</p>
            <p><strong>Doelgroep:</strong> {{ selectedContent.targetAudience?.name || 'N/A' }}</p>
          </div>
          <div class="content-section-full">
            <h4>Originele Tekst</h4>
            <pre class="content-text-full">{{ selectedContent.originalText }}</pre>
          </div>
          <div class="content-section-full">
            <h4>Vereenvoudigde Tekst</h4>
            <pre class="content-text-full">{{ selectedContent.simplifiedText }}</pre>
          </div>
          <div v-if="selectedContent.metadata?.verificationNotes" class="content-notes">
            <h4>Verificatie Notities</h4>
            <p>{{ selectedContent.metadata.verificationNotes }}</p>
          </div>
          <div v-if="selectedContent.metadata?.approvalNotes" class="content-notes">
            <h4>Goedkeuring Notities</h4>
            <p>{{ selectedContent.metadata.approvalNotes }}</p>
          </div>
          <div class="modal-actions">
            <button @click="copyToClipboard(selectedContent.simplifiedText)" class="btn-primary">
              📋 Kopieer naar klembord
            </button>
            <button @click="showFullContentModal = false" class="btn-secondary">Sluiten</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import { useAuth } from '../../composables/useAuth.js';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';
import EmptyState from '../common/EmptyState.vue';
import LoadingSpinner from '../common/LoadingSpinner.vue';
import SearchInput from '../common/SearchInput.vue';

const { user, hasRole } = useAuth();
const { success, error: showError } = useToast();
const { confirm } = useConfirm();

const loading = ref(false);
const savingTeam = ref(false);
const savingProject = ref(false);
const error = ref(null);
const teams = ref([]);
const projects = ref([]);
const lvls = ref([]);
const availableUsers = ref([]);

const showCreateTeamModal = ref(false);
const editingTeam = ref(null);
const showCreateProjectModal = ref(false);
const editingProject = ref(null);
const showApprovedContentModal = ref(false);
const showFullContentModal = ref(false);
const currentProject = ref(null);
const approvedContent = ref([]);
const approvedContentLoading = ref(false);
const teamSearchQuery = ref('');
const approvedContentError = ref(null);
const approvedContentSearch = ref('');
const approvedContentLvlFilter = ref('');
const approvedContentFormatFilter = ref('');
const approvedContentDateFrom = ref('');
const approvedContentDateTo = ref('');
const approvedContentTagFilter = ref('');
const editingTagsFor = ref(null);
const newTagInput = ref('');
const approvedContentPagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});
const selectedContent = ref(null);
const availableLvls = ref([]);
const availableFormats = ref([]);

const teamForm = ref({
  name: '',
  lvls: [],
  members: [],
});

const projectForm = ref({
  name: '',
  team: '',
  lvls: [],
  description: '',
});

const canCreateTeam = computed(() => hasRole('SUPER_ADMIN', 'ADMIN'));
const canDeleteTeam = computed(() => hasRole('SUPER_ADMIN'));
const canCreateProject = computed(() => hasRole('SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER'));

const availableProjectLvls = computed(() => {
  if (!projectForm.value.team) return [];
  const team = teams.value.find(t => t.id === projectForm.value.team);
  if (!team || !team.lvls) return [];
  return lvls.value.filter(lvl => team.lvls.includes(lvl.id));
});

function teamProjects(teamId) {
  return projects.value.filter(p => p.team === teamId || p.team?.id === teamId);
}

const filteredTeams = computed(() => {
  if (!teamSearchQuery.value.trim()) {
    return teams.value;
  }
  
  const query = teamSearchQuery.value.toLowerCase().trim();
  return teams.value.filter(team => {
    const name = (team.name || '').toLowerCase();
    return name.includes(query);
  });
});

function handleTeamSearch(query) {
  // Search is handled by computed property
}

function getTeamLvlNames(team) {
  if (!team.lvls) return 'Geen';
  return team.lvls.map(lvlId => {
    const lvl = lvls.value.find(l => l.id === lvlId);
    return lvl ? lvl.name : '';
  }).filter(Boolean).join(', ') || 'Geen';
}

function getProjectLvlNames(project) {
  if (!project.lvls) return 'Geen';
  return project.lvls.map(lvlId => {
    const lvl = lvls.value.find(l => l.id === lvlId);
    return lvl ? lvl.name : '';
  }).filter(Boolean).join(', ') || 'Geen';
}

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const [teamsRes, projectsRes, lvlsRes, usersRes] = await Promise.all([
      axios.get('/api/teams'),
      axios.get('/api/projects'),
      axios.get('/api/lvls'),
      hasRole('SUPER_ADMIN', 'ADMIN') ? axios.get('/api/users') : Promise.resolve({ data: [] }),
    ]);

    teams.value = teamsRes.data.map(t => ({
      id: t._id || t.id,
      name: t.name,
      lvls: t.lvls?.map(l => l._id || l.id) || [],
      members: t.members || [],
    }));

    projects.value = projectsRes.data.map(p => ({
      id: p._id || p.id,
      name: p.name,
      team: p.team?._id || p.team || p.teamId,
      lvls: p.lvls?.map(l => l._id || l.id) || [],
      description: p.description || '',
    }));

    lvls.value = lvlsRes.data.map(l => ({
      id: l._id || l.id,
      name: l.name,
      code: l.code,
    }));

    if (usersRes.data) {
      availableUsers.value = usersRes.data.map(u => ({
        id: u._id || u.id,
        email: u.email,
        role: u.role,
      }));
    }
  } catch (err) {
    console.error('Error fetching data:', err);
    error.value = 'Fout bij het ophalen van gegevens';
  } finally {
    loading.value = false;
  }
}

function openCreateProjectModal(team) {
  projectForm.value = {
    name: '',
    team: team.id,
    lvls: [],
    description: '',
  };
  showCreateProjectModal.value = true;
}

function editTeam(team) {
  editingTeam.value = team;
  teamForm.value = {
    name: team.name,
    lvls: [...team.lvls],
    members: [...team.members],
  };
}

function editProject(project) {
  editingProject.value = project;
  projectForm.value = {
    name: project.name,
    team: project.team,
    lvls: [...project.lvls],
    description: project.description || '',
  };
}

function closeModals() {
  showCreateTeamModal.value = false;
  showCreateProjectModal.value = false;
  editingTeam.value = null;
  editingProject.value = null;
  teamForm.value = { name: '', lvls: [], members: [] };
  projectForm.value = { name: '', team: '', lvls: [], description: '' };
}

async function saveTeam() {
  savingTeam.value = true;
  try {
    if (editingTeam.value) {
      await axios.put(`/api/teams/${editingTeam.value.id}`, teamForm.value);
      success('Team succesvol bijgewerkt');
    } else {
      await axios.post('/api/teams', teamForm.value);
      success('Team succesvol aangemaakt');
    }
    await fetchData();
    closeModals();
  } catch (err) {
    console.error('Error saving team:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het opslaan van team';
    error.value = errorMsg;
    showError(errorMsg);
  } finally {
    savingTeam.value = false;
  }
}

async function saveProject() {
  savingProject.value = true;
  try {
    if (editingProject.value) {
      await axios.put(`/api/projects/${editingProject.value.id}`, projectForm.value);
      success('Project succesvol bijgewerkt');
    } else {
      await axios.post('/api/projects', projectForm.value);
      success('Project succesvol aangemaakt');
    }
    await fetchData();
    closeModals();
  } catch (err) {
    console.error('Error saving project:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het opslaan van project';
    error.value = errorMsg;
    showError(errorMsg);
  } finally {
    savingProject.value = false;
  }
}

async function deleteTeam(teamId) {
  try {
    const confirmed = await confirm({
      title: 'Team verwijderen',
      message: 'Weet je zeker dat je dit team wilt verwijderen?',
      description: 'Deze actie kan niet ongedaan worden gemaakt.',
      type: 'danger',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    await axios.delete(`/api/teams/${teamId}`);
    success('Team succesvol verwijderd');
    await fetchData();
  } catch (err) {
    if (err === false) return; // User cancelled
    console.error('Error deleting team:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het verwijderen van team';
    error.value = errorMsg;
    showError(errorMsg);
  }
}

async function deleteProject(projectId) {
  try {
    const confirmed = await confirm({
      title: 'Project verwijderen',
      message: 'Weet je zeker dat je dit project wilt verwijderen?',
      description: 'Deze actie kan niet ongedaan worden gemaakt.',
      type: 'danger',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    await axios.delete(`/api/projects/${projectId}`);
    success('Project succesvol verwijderd');
    await fetchData();
  } catch (err) {
    if (err === false) return; // User cancelled
    console.error('Error deleting project:', err);
    const errorMsg = err.response?.data?.error || 'Fout bij het verwijderen van project';
    error.value = errorMsg;
    showError(errorMsg);
  }
}

const canDeleteApprovedContent = computed(() => 
  hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN')
);

function viewApprovedContent(project) {
  currentProject.value = project;
  resetApprovedContentFilters();
  showApprovedContentModal.value = true;
  fetchLvlsAndFormats();
  fetchApprovedContent();
}

async function fetchApprovedContent() {
  if (!currentProject.value) return;
  approvedContentLoading.value = true;
  approvedContentError.value = null;
  try {
    const params = {
      page: approvedContentPagination.value.page,
      limit: approvedContentPagination.value.limit,
    };
    if (approvedContentSearch.value.trim()) {
      params.search = approvedContentSearch.value.trim();
    }
    if (approvedContentLvlFilter.value) {
      params.lvl = approvedContentLvlFilter.value;
    }
    if (approvedContentFormatFilter.value) {
      params.outputFormat = approvedContentFormatFilter.value;
    }
    if (approvedContentDateFrom.value) {
      params.dateFrom = approvedContentDateFrom.value;
    }
    if (approvedContentDateTo.value) {
      params.dateTo = approvedContentDateTo.value;
    }
    if (approvedContentTagFilter.value.trim()) {
      params.tag = approvedContentTagFilter.value.trim();
    }
    const response = await axios.get(
      `/api/projects/${currentProject.value.id}/approved-content`,
      { params }
    );
    approvedContent.value = response.data.data;
    approvedContentPagination.value = {
      page: response.data.pagination.page,
      limit: response.data.pagination.limit,
      total: response.data.pagination.total,
      totalPages: response.data.pagination.totalPages,
    };
  } catch (err) {
    console.error('Error fetching approved content:', err);
    approvedContentError.value = err.response?.data?.error || 'Fout bij het ophalen van goedgekeurde teksten';
  } finally {
    approvedContentLoading.value = false;
  }
}

function resetApprovedContentFilters() {
  approvedContentSearch.value = '';
  approvedContentLvlFilter.value = '';
  approvedContentFormatFilter.value = '';
  approvedContentDateFrom.value = '';
  approvedContentDateTo.value = '';
  approvedContentTagFilter.value = '';
  approvedContentPagination.value.page = 1;
  fetchApprovedContent();
}

function editTags(content) {
  editingTagsFor.value = content._id || content.id;
  newTagInput.value = '';
}

function cancelEditTags() {
  editingTagsFor.value = null;
  newTagInput.value = '';
}

async function addTag(content) {
  if (!newTagInput.value.trim()) return;
  const tag = newTagInput.value.trim().toLowerCase();
  if (content.tags && content.tags.includes(tag)) {
    showError('Deze tag bestaat al');
    return;
  }
  try {
    const response = await axios.put(`/api/approved-content/${content._id || content.id}/tags`, {
      action: 'add',
      tag,
    });
    const index = approvedContent.value.findIndex(c => (c._id || c.id) === (content._id || content.id));
    if (index !== -1) {
      approvedContent.value[index] = response.data;
    }
    newTagInput.value = '';
    success('Tag toegevoegd');
  } catch (err) {
    console.error('Error adding tag:', err);
    showError(err.response?.data?.error || 'Fout bij toevoegen tag');
  }
}

async function removeTag(content, tag) {
  try {
    const response = await axios.put(`/api/approved-content/${content._id || content.id}/tags`, {
      action: 'remove',
      tag,
    });
    const index = approvedContent.value.findIndex(c => (c._id || c.id) === (content._id || content.id));
    if (index !== -1) {
      approvedContent.value[index] = response.data;
    }
    success('Tag verwijderd');
  } catch (err) {
    console.error('Error removing tag:', err);
    showError(err.response?.data?.error || 'Fout bij verwijderen tag');
  }
}

async function fetchLvlsAndFormats() {
  try {
    const [lvlsRes, formatsRes] = await Promise.all([
      axios.get('/api/lvls'),
      axios.get('/api/output-formats'),
    ]);
    availableLvls.value = lvlsRes.data.map(l => ({ id: l._id || l.id, name: l.name }));
    availableFormats.value = formatsRes.data.map(f => ({ id: f._id || f.id, name: f.name }));
  } catch (err) {
    console.error('Error fetching LVLs and formats:', err);
  }
}

function changeApprovedContentPage(newPage) {
  approvedContentPagination.value.page = newPage;
  fetchApprovedContent();
}

function viewFullContent(content) {
  selectedContent.value = content;
  showFullContentModal.value = true;
}

async function deleteApprovedContent(contentId) {
  try {
    const confirmed = await confirm({
      title: 'Goedgekeurde tekst verwijderen',
      message: 'Weet je zeker dat je deze goedgekeurde tekst wilt verwijderen?',
      description: 'Deze actie kan niet ongedaan worden gemaakt.',
      type: 'danger',
      confirmText: 'Verwijderen',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    await axios.delete(`/api/projects/${currentProject.value.id}/approved-content/${contentId}`);
    success('Goedgekeurde tekst succesvol verwijderd');
    await fetchApprovedContent();
  } catch (err) {
    if (err === false) return; // User cancelled
    console.error('Error deleting approved content:', err);
    showError(err.response?.data?.error || 'Fout bij het verwijderen van goedgekeurde tekst');
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    success('Tekst gekopieerd naar klembord!');
  } catch (err) {
    console.error('Error copying to clipboard:', err);
    showError('Fout bij kopiëren naar klembord');
  }
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
  if (!dateString) return 'Onbekend';
  return new Date(dateString).toLocaleString('nl-BE');
}

let searchDebounceTimer = null;
watch(approvedContentSearch, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    approvedContentPagination.value.page = 1;
    fetchApprovedContent();
  }, 500);
});

onMounted(() => {
  fetchData();
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

h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-4);
}

h3 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-4);
}

h4 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.teams-section {
  margin-bottom: var(--spacing-10);
}

.teams-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
  gap: var(--spacing-6);
}

.team-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.team-card:hover {
  box-shadow: var(--shadow-md);
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-4);
  gap: var(--spacing-4);
  min-width: 0;
}

.team-header h3 {
  margin: 0;
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.team-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.team-info {
  margin-bottom: var(--spacing-4);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.projects-section {
  margin-top: var(--spacing-4);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border);
  overflow: hidden;
}

.projects-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  overflow: visible;
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-3);
}

.projects-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: background-color var(--transition-base);
  gap: var(--spacing-3);
  min-width: 0;
  overflow: hidden;
}

.project-item:hover {
  background: var(--color-bg-tertiary);
}

.project-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  overflow: hidden;
}

.project-name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

.project-lvls {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  flex-shrink: 0;
}

.project-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-shrink: 0;
  align-items: center;
}

.empty-state, .empty-state-small {
  color: var(--color-text-tertiary);
  font-style: italic;
  padding: var(--spacing-8);
  text-align: center;
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.empty-state-small {
  padding: var(--spacing-4);
  font-size: var(--font-size-sm);
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

.btn-edit, .btn-edit-small {
  background: var(--color-success);
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-edit:hover:not(:disabled), .btn-edit-small:hover:not(:disabled) {
  background: #059669;
}

.btn-edit:disabled, .btn-edit-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-delete, .btn-delete-small {
  background: var(--color-error);
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-delete:hover:not(:disabled), .btn-delete-small:hover:not(:disabled) {
  background: #DC2626;
}

.btn-delete:disabled, .btn-delete-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-view-small {
  background: #3B82F6;
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  min-width: fit-content;
}

.btn-view-small:hover {
  background: #2563EB;
}

.btn-edit-small,
.btn-delete-small {
  white-space: nowrap;
  min-width: fit-content;
}

.btn-view-full {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
}

.btn-view-full:hover {
  background: var(--color-primary-hover);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: var(--font-size-2xl);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
}

.btn-close:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.approved-content-modal,
.full-content-modal {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
}

.approved-content-filters {
  margin-bottom: var(--spacing-6);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.filter-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr auto;
  gap: var(--spacing-3);
  align-items: center;
}

.search-input,
.filter-select,
.filter-date {
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.search-input:focus,
.filter-select:focus,
.filter-date:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-filter-reset {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-text-tertiary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
}

.btn-filter-reset:hover {
  background: #4B5563;
}

.approved-content-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.approved-content-item {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  transition: box-shadow var(--transition-base);
}

.approved-content-item:hover {
  box-shadow: var(--shadow-md);
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-4);
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
}

.content-meta {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.content-meta span {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
}

.content-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.content-section {
  margin-bottom: var(--spacing-3);
}

.content-section strong {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.content-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  margin: 0;
  white-space: pre-wrap;
}

.content-tags {
  margin-top: var(--spacing-3);
  padding-top: var(--spacing-3);
  border-top: 1px solid var(--color-border);
}

.tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  align-items: center;
}

.no-tags {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-style: italic;
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  background: #DBEAFE;
  color: #1E40AF;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.tag-remove {
  background: transparent;
  border: none;
  color: #1E40AF;
  cursor: pointer;
  font-size: var(--font-size-lg);
  line-height: 1;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color var(--transition-base);
}

.tag-remove:hover {
  background: rgba(30, 64, 175, 0.1);
}

.btn-tag-add {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-tag-add:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
}

.tags-edit {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.tag-input {
  flex: 1;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.tag-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-tag-save,
.btn-tag-cancel {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.btn-tag-save {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.btn-tag-save:hover {
  background: var(--color-primary-hover);
}

.btn-tag-cancel {
  background: var(--color-text-tertiary);
  color: var(--color-text-inverse);
}

.btn-tag-cancel:hover {
  background: #4B5563;
}

.content-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-3);
  padding-top: var(--spacing-3);
  border-top: 1px solid var(--color-border);
}

.content-approver {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.full-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.content-meta-full {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.content-meta-full p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.content-section-full h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-3);
}

.content-text-full {
  background: var(--color-bg-secondary);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-primary);
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.content-notes {
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
}

.content-notes h4 {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-2) 0;
}

.content-notes p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  font-style: italic;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  margin-top: var(--spacing-6);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border);
}

.pagination-btn {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-small, .btn-edit-small, .btn-delete-small {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-xs);
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

.multi-select {
  min-height: 120px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  cursor: pointer;
  padding: var(--spacing-2);
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-base);
  font-size: var(--font-size-sm);
}

.checkbox-label:hover {
  background: var(--color-bg-tertiary);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
  margin-top: var(--spacing-8);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-border);
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

@media (max-width: 768px) {
  .admin-page {
    padding: var(--spacing-4) var(--spacing-3);
  }
  
  .teams-list {
    grid-template-columns: 1fr;
    min-width: 0;
  }

  .team-card {
    min-width: 0;
    overflow: visible;
  }
  
  .project-item {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .project-info {
    width: 100%;
    margin-bottom: var(--spacing-2);
  }

  .project-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .btn-view-small,
  .btn-edit-small,
  .btn-delete-small {
    font-size: var(--font-size-xs);
    padding: var(--spacing-1) var(--spacing-2);
  }
  
  .modal {
    padding: var(--spacing-6);
    max-width: 95vw;
  }

  .filter-row {
    grid-template-columns: 1fr;
    gap: var(--spacing-2);
  }

  .filter-row > * {
    width: 100%;
  }
}
</style>

