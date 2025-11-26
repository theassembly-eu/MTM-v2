<template>
  <div class="admin-page">
    <h1>Teams & Projecten Beheer</h1>

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
                @click="showCreateProjectModal(team)" 
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

function showCreateProjectModal(team) {
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
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2.5em;
  margin-bottom: 2rem;
  color: #000;
}

h2 {
  font-size: 1.8em;
  margin-bottom: 1rem;
  color: #000;
}

h3 {
  font-size: 1.5em;
  margin-bottom: 1rem;
  color: #333;
}

h4 {
  font-size: 1.2em;
  margin-bottom: 0.5rem;
  color: #333;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.teams-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.team-card {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}

.team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.team-actions {
  display: flex;
  gap: 0.5rem;
}

.team-info {
  margin-bottom: 1rem;
  color: #666;
}

.projects-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #ddd;
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.projects-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.project-lvls {
  color: #666;
  font-size: 0.9em;
  margin-left: 0.5rem;
}

.project-actions {
  display: flex;
  gap: 0.5rem;
}

.empty-state, .empty-state-small {
  color: #666;
  font-style: italic;
  padding: 1rem;
  text-align: center;
}

.empty-state-small {
  padding: 0.5rem;
  font-size: 0.9em;
}

.btn-primary, .btn-edit, .btn-delete, .btn-small, .btn-edit-small, .btn-delete-small, .btn-cancel {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #FF0000;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #cc0000;
}

.btn-edit, .btn-edit-small {
  background: #4CAF50;
  color: white;
}

.btn-edit:hover, .btn-edit-small:hover {
  background: #45a049;
}

.btn-delete, .btn-delete-small {
  background: #f44336;
  color: white;
}

.btn-delete:hover, .btn-delete-small:hover {
  background: #da190b;
}

.btn-small, .btn-edit-small, .btn-delete-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.85em;
}

.btn-cancel {
  background: #999;
  color: white;
}

.btn-cancel:hover {
  background: #777;
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
}

.modal h3 {
  margin-top: 0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #000;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1em;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
}

.multi-select {
  min-height: 100px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ddd;
  padding: 0.5rem;
  border-radius: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.25rem;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid #fcc;
}
</style>

