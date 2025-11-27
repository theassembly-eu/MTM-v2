<template>
  <div id="app">
    <header v-if="isAuthenticated" class="app-header">
      <div class="header-container">
        <div class="header-brand">
          <img 
            src="https://assets.nationbuilder.com/vooruit/sites/3/meta_images/original/Vooruit_thumbnail.jpg?1619535283" 
            alt="Vooruit Logo" 
            class="header-logo"
          />
          <span class="header-title">MensentaalMachine</span>
        </div>
        
        <nav class="header-nav">
          <router-link to="/simplify" class="nav-link">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Vereenvoudigen
          </router-link>
          
          <router-link to="/history" class="nav-link">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Geschiedenis
          </router-link>
          
          <div v-if="userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'" class="nav-divider"></div>
          
          <router-link v-if="userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'" to="/admin/teams" class="nav-link">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Teams & Projecten
          </router-link>
          
          <router-link v-if="userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'" to="/admin/references" class="nav-link">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Referenties
          </router-link>
          
          <router-link v-if="userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'" to="/admin/users" class="nav-link">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Gebruikers
          </router-link>
          
          <router-link v-if="userRole === 'SUPER_ADMIN'" to="/admin/config" class="nav-link">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configuratie
          </router-link>
          
          <router-link v-if="userRole === 'SUPER_ADMIN'" to="/admin/analytics" class="nav-link">
            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </router-link>
        </nav>
        
        <div class="header-user">
          <div class="user-menu">
            <span class="user-email">{{ userEmail }}</span>
            <button @click="handleLogout" class="btn-logout" title="Uitloggen">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="logout-icon">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
    
    <main class="app-main">
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

<style scoped>
.app-header {
  background-color: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.header-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--spacing-4) var(--spacing-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
  flex-wrap: wrap;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  flex-shrink: 0;
}

.header-logo {
  height: 32px;
  width: auto;
}

.header-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  display: none;
}

@media (min-width: 640px) {
  .header-title {
    display: inline;
  }
}

.header-nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  flex: 1;
  justify-content: center;
  flex-wrap: wrap;
  min-width: 0;
}

@media (max-width: 1024px) {
  .header-nav {
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    flex-wrap: nowrap;
    justify-content: flex-start;
  }
  
  .header-nav::-webkit-scrollbar {
    display: none;
  }
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
  white-space: nowrap;
}

.nav-link:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-link.router-link-exact-active {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.nav-divider {
  width: 1px;
  height: 24px;
  background-color: var(--color-border);
  margin: 0 var(--spacing-2);
}

.header-user {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.user-email {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  display: none;
}

@media (min-width: 768px) {
  .user-email {
    display: inline;
  }
}

.btn-logout {
  padding: var(--spacing-2);
  background-color: transparent;
  color: var(--color-text-secondary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-logout:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-error);
}

.logout-icon {
  width: 18px;
  height: 18px;
}

.app-main {
  flex: 1;
  width: 100%;
}

@media (max-width: 768px) {
  .header-container {
    padding: var(--spacing-3);
  }
  
  .nav-link span {
    display: none;
  }
  
  .nav-icon {
    width: 20px;
    height: 20px;
  }
}
</style>
