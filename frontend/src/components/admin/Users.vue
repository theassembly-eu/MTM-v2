<template>
  <div class="admin-page">
    <h1>Gebruikers Beheer</h1>

    <div class="section-header">
      <h2>Gebruikers</h2>
      <button @click="showCreateModal = true" class="btn-primary">
        Nieuwe Gebruiker
      </button>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="users.length === 0 && !loading" class="empty-state">
      Geen gebruikers gevonden.
    </div>

    <div v-else class="users-list">
      <div 
        v-for="user in users" 
        :key="user.id" 
        class="user-card"
      >
        <div class="user-header">
          <div class="user-info">
            <h3>{{ user.email }}</h3>
            <p class="user-name">{{ user.name || 'Geen naam' }}</p>
            <span class="user-role">{{ user.role }}</span>
          </div>
          <div class="user-actions">
            <button @click="editUser(user)" class="btn-edit">Bewerken</button>
            <button 
              v-if="canDeleteUser" 
              @click="deleteUser(user.id)" 
              class="btn-delete"
              :disabled="user.id === currentUserId"
            >
              Verwijderen
            </button>
          </div>
        </div>
        <div class="user-details">
          <p><strong>Teams:</strong> {{ getUserTeamNames(user) }}</p>
        </div>
      </div>
    </div>

    <!-- Create/Edit User Modal -->
    <div v-if="showCreateModal || editingUser" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <h3>{{ editingUser ? 'Gebruiker Bewerken' : 'Nieuwe Gebruiker' }}</h3>
        <form @submit.prevent="saveUser">
          <div class="form-group">
            <label>Email *</label>
            <input 
              v-model="userForm.email" 
              type="email" 
              required
              :disabled="!!editingUser"
            />
          </div>
          <div class="form-group">
            <label>Naam</label>
            <input v-model="userForm.name" type="text" />
          </div>
          <div class="form-group">
            <label>Wachtwoord {{ editingUser ? '(laat leeg om niet te wijzigen)' : '*' }}</label>
            <input 
              v-model="userForm.password" 
              type="password" 
              :required="!editingUser"
            />
          </div>
          <div class="form-group">
            <label>Rol *</label>
            <select v-model="userForm.role" required :disabled="!canChangeRole">
              <option value="">Selecteer rol</option>
              <option value="TEAM_MEMBER">Team Lid</option>
              <option value="TEAM_LEADER">Team Leider</option>
              <option value="ADMIN">Admin</option>
              <option v-if="isSuperAdmin" value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <div class="form-group">
            <label>Teams</label>
            <select v-model="userForm.teams" multiple class="multi-select">
              <option v-for="team in teams" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
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
import { useAuth } from '../../composables/useAuth.js';

const { user: currentUser, hasRole } = useAuth();

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const users = ref([]);
const teams = ref([]);
const showCreateModal = ref(false);
const editingUser = ref(null);

const userForm = ref({
  email: '',
  name: '',
  password: '',
  role: 'TEAM_MEMBER',
  teams: [],
});

const currentUserId = computed(() => currentUser.value?.id);
const isSuperAdmin = computed(() => hasRole('SUPER_ADMIN'));
const canDeleteUser = computed(() => hasRole('SUPER_ADMIN'));
const canChangeRole = computed(() => {
  if (!editingUser.value) return true;
  if (isSuperAdmin.value) return true;
  // ADMIN cannot change SUPER_ADMIN role
  return editingUser.value.role !== 'SUPER_ADMIN';
});

function getUserTeamNames(user) {
  if (!user.teams || user.teams.length === 0) return 'Geen teams';
  return user.teams.map(team => team.name || team).join(', ');
}

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const [usersRes, teamsRes] = await Promise.all([
      axios.get('/api/users'),
      axios.get('/api/teams'),
    ]);

    users.value = usersRes.data.map(u => ({
      id: u._id || u.id,
      email: u.email,
      name: u.name || '',
      role: u.role,
      teams: u.teams || [],
    }));

    teams.value = teamsRes.data.map(t => ({
      id: t._id || t.id,
      name: t.name,
    }));
  } catch (err) {
    console.error('Error fetching data:', err);
    error.value = 'Fout bij het ophalen van gegevens';
  } finally {
    loading.value = false;
  }
}

function editUser(user) {
  editingUser.value = user;
  userForm.value = {
    email: user.email,
    name: user.name || '',
    password: '',
    role: user.role,
    teams: user.teams.map(t => t.id || t),
  };
}

function closeModal() {
  showCreateModal.value = false;
  editingUser.value = null;
  userForm.value = {
    email: '',
    name: '',
    password: '',
    role: 'TEAM_MEMBER',
    teams: [],
  };
}

async function saveUser() {
  saving.value = true;
  error.value = null;
  try {
    const data = { ...userForm.value };
    if (editingUser.value && !data.password) {
      delete data.password; // Don't send empty password
    }

    if (editingUser.value) {
      await axios.put(`/api/users/${editingUser.value.id}`, data);
    } else {
      await axios.post('/api/users', data);
    }
    await fetchData();
    closeModal();
  } catch (err) {
    console.error('Error saving user:', err);
    error.value = err.response?.data?.error || 'Fout bij het opslaan van gebruiker';
  } finally {
    saving.value = false;
  }
}

async function deleteUser(userId) {
  if (!confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) return;
  try {
    await axios.delete(`/api/users/${userId}`);
    await fetchData();
  } catch (err) {
    console.error('Error deleting user:', err);
    error.value = err.response?.data?.error || 'Fout bij het verwijderen van gebruiker';
  }
}

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
/* Reuse styles from TeamsProjects */
.admin-page, .section-header, .users-list, .user-card, .user-header, .user-info,
.user-actions, .user-details, .modal-overlay, .modal, .form-group, .modal-actions,
.btn-primary, .btn-edit, .btn-delete, .btn-cancel, .loading, .error-message,
.empty-state, .multi-select {
  /* Styles from TeamsProjects */
}

.user-name {
  color: #666;
  font-size: 0.9em;
  margin: 0.25rem 0;
}

.user-role {
  display: inline-block;
  background: #FF0000;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 600;
  margin-top: 0.5rem;
}
</style>

