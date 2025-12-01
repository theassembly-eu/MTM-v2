import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from './composables/useAuth.js';
import Login from './components/Login.vue';
import SimplifyText from './components/SimplifyText.vue';
import HistoryPage from './components/HistoryPage.vue';
import TeamsProjects from './components/admin/TeamsProjects.vue';
import References from './components/admin/References.vue';
import Users from './components/admin/Users.vue';
import Configuration from './components/admin/Configuration.vue';
import Analytics from './components/admin/Analytics.vue';
import ABTests from './components/admin/ABTests.vue';
import ApprovalQueue from './components/admin/ApprovalQueue.vue';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    redirect: '/simplify',
  },
  {
    path: '/simplify',
    name: 'Simplify',
    component: SimplifyText,
    meta: { requiresAuth: true },
  },
  {
    path: '/history',
    name: 'History',
    component: HistoryPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/teams',
    name: 'AdminTeams',
    component: TeamsProjects,
    meta: { requiresAuth: true, requiresRole: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER'] },
  },
  {
    path: '/admin/projects',
    name: 'AdminProjects',
    component: TeamsProjects,
    meta: { requiresAuth: true, requiresRole: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER'] },
  },
  {
    path: '/admin/references',
    name: 'AdminReferences',
    component: References,
    meta: { requiresAuth: true, requiresRole: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER'] },
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: Users,
    meta: { requiresAuth: true, requiresRole: ['SUPER_ADMIN', 'ADMIN'] },
  },
  {
    path: '/admin/config',
    name: 'AdminConfig',
    component: Configuration,
    meta: { requiresAuth: true, requiresRole: ['SUPER_ADMIN'] },
  },
  {
    path: '/admin/analytics',
    name: 'AdminAnalytics',
    component: Analytics,
    meta: { requiresAuth: true, requiresRole: ['SUPER_ADMIN', 'ADMIN'] },
  },
  {
    path: '/admin/ab-tests',
    name: 'AdminABTests',
    component: ABTests,
    meta: { requiresAuth: true, requiresRole: ['SUPER_ADMIN'] },
  },
  {
    path: '/admin/approval-queue',
    name: 'ApprovalQueue',
    component: ApprovalQueue,
    meta: { requiresAuth: true, requiresRole: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER'] },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Auth guard
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, checkAuth, initAuth, hasRole } = useAuth();
  
  // Initialize auth on first navigation
  if (!isAuthenticated.value) {
    initAuth();
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth) {
    // If not authenticated, try to check auth
    if (!isAuthenticated.value) {
      const isAuth = await checkAuth();
      if (!isAuth) {
        next({ name: 'Login', query: { redirect: to.fullPath } });
        return;
      }
    }

    // Check role requirements
    if (to.meta.requiresRole) {
      const userHasRequiredRole = to.meta.requiresRole.some(role => hasRole(role));
      if (!userHasRequiredRole) {
        next({ name: 'Simplify' }); // Redirect to home if insufficient permissions
        return;
      }
    }
  }

  // If already authenticated and trying to access login, redirect to home
  if (to.name === 'Login' && isAuthenticated.value) {
    next({ name: 'Simplify' });
    return;
  }

  next();
});

export default router;