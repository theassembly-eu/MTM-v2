<template>
  <div id="app">
    <header v-if="isAuthenticated">
      <nav>
        <router-link to="/simplify">Vereenvoudigen</router-link> |
        <router-link to="/history">Geschiedenis</router-link>
        <span v-if="userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'">
          | <router-link to="/admin/teams">Teams</router-link>
          | <router-link to="/admin/projects">Projecten</router-link>
          | <router-link to="/admin/references">Referenties</router-link>
        </span>
        <span v-if="userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'">
          | <router-link to="/admin/users">Gebruikers</router-link>
        </span>
        <span v-if="userRole === 'SUPER_ADMIN'">
          | <router-link to="/admin/config">Configuratie</router-link>
        </span>
        | <button @click="handleLogout" class="logout-button">Uitloggen</button>
        <span class="user-info">({{ userEmail }})</span>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useAuth } from './composables/useAuth.js';

const { user, isAuthenticated, userRole, logout, initAuth } = useAuth();

const userEmail = computed(() => user.value?.email || '');

function handleLogout() {
  logout();
}

onMounted(() => {
  initAuth();
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

header {
  margin-bottom: 2rem;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
}

nav a.router-link-exact-active {
  color: #42b983;
}

.logout-button {
  background: transparent;
  border: 1px solid #FF0000;
  color: #FF0000;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  margin-left: 1rem;
  transition: all 0.3s ease;
}

.logout-button:hover {
  background: #FF0000;
  color: white;
}

.user-info {
  margin-left: 1rem;
  color: #666;
  font-size: 0.9em;
}
</style>