<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Teams & Projecten Beheer</h1>
      <p class="page-subtitle">Beheer teams, projecten en hun communicatieniveaus</p>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
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

      <div v-if="teams.length === 0" class="empty-state">
        Geen teams gevonden.
      </div>

      <div v-else class="teams-list">
        <div 
          v-for="team in teams" 
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

            <div v-if="teamProjects(team.id).length === 0" class="empty-state-small">
              Geen projecten voor dit team.
            </div>

            <ul v-else class="projects-list">
              <li 
                v-for="project in teamProjects(team.id)" 
                :key="project.id"
                class="project-item"
              >
                <span>{{ project.name }}</span>
                <span class="project-lvls">({{ getProjectLvlNames(project) }})</span>
                <div class="project-actions">
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
            <button type="submit" class="btn-primary">Opslaan</button>
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
            <button type="submit" class="btn-primary">Opslaan</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuth } from '../../composables/useAuth.js';

const { user, hasRole } = useAuth();

const loading = ref(false);
const error = ref(null);
const teams = ref([]);
const projects = ref([]);
const lvls = ref([]);
const availableUsers = ref([]);

const showCreateTeamModal = ref(false);
const editingTeam = ref(null);
const showCreateProjectModal = ref(false);
const editingProject = ref(null);

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
  try {
    if (editingTeam.value) {
      await axios.put(`/api/teams/${editingTeam.value.id}`, teamForm.value);
    } else {
      await axios.post('/api/teams', teamForm.value);
    }
    await fetchData();
    closeModals();
  } catch (err) {
    console.error('Error saving team:', err);
    error.value = err.response?.data?.error || 'Fout bij het opslaan van team';
  }
}

async function saveProject() {
  try {
    if (editingProject.value) {
      await axios.put(`/api/projects/${editingProject.value.id}`, projectForm.value);
    } else {
      await axios.post('/api/projects', projectForm.value);
    }
    await fetchData();
    closeModals();
  } catch (err) {
    console.error('Error saving project:', err);
    error.value = err.response?.data?.error || 'Fout bij het opslaan van project';
  }
}

async function deleteTeam(teamId) {
  if (!confirm('Weet je zeker dat je dit team wilt verwijderen?')) return;
  try {
    await axios.delete(`/api/teams/${teamId}`);
    await fetchData();
  } catch (err) {
    console.error('Error deleting team:', err);
    error.value = err.response?.data?.error || 'Fout bij het verwijderen van team';
  }
}

async function deleteProject(projectId) {
  if (!confirm('Weet je zeker dat je dit project wilt verwijderen?')) return;
  try {
    await axios.delete(`/api/projects/${projectId}`);
    await fetchData();
  } catch (err) {
    console.error('Error deleting project:', err);
    error.value = err.response?.data?.error || 'Fout bij het verwijderen van project';
  }
}

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
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--spacing-6);
}

.team-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
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
}

.project-item:hover {
  background: var(--color-bg-tertiary);
}

.project-item > div:first-child {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.project-lvls {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  margin-left: var(--spacing-2);
}

.project-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-shrink: 0;
  flex-wrap: wrap;
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
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn-edit, .btn-edit-small {
  background: var(--color-success);
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.btn-edit:hover, .btn-edit-small:hover {
  background: #059669;
}

.btn-delete, .btn-delete-small {
  background: var(--color-error);
  color: var(--color-text-inverse);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.btn-delete:hover, .btn-delete-small:hover {
  background: #DC2626;
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
}

.btn-cancel:hover {
  background: #4B5563;
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
  }
  
  .modal {
    padding: var(--spacing-6);
  }
}
</style>

