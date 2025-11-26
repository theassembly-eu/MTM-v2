<template>
  <div class="admin-page">
    <div class="page-header">
      <h1>Gebruikers Beheer</h1>
      <p class="page-subtitle">Beheer gebruikers, rollen en teamtoewijzingen</p>
    </div>

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

.users-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--spacing-4);
}

.user-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.user-card:hover {
  box-shadow: var(--shadow-md);
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-4);
  gap: var(--spacing-4);
}

.user-info {
  flex: 1;
}

.user-info h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-2) 0;
}

.user-name {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: var(--spacing-2) 0;
}

.user-role {
  display: inline-block;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  margin-top: var(--spacing-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.user-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-shrink: 0;
}

.user-details {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
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
  grid-column: 1 / -1;
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
.form-group select {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.multi-select {
  min-height: 120px;
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

@media (max-width: 768px) {
  .admin-page {
    padding: var(--spacing-4) var(--spacing-3);
  }
  
  .users-list {
    grid-template-columns: 1fr;
  }
  
  .modal {
    padding: var(--spacing-6);
  }
}
</style>

