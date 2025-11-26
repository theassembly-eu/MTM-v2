import { ref, computed } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';

const user = ref(null);
const token = ref(localStorage.getItem('mtm_token') || null);
const loading = ref(false);
const error = ref(null);

// Set axios default authorization header if token exists
if (token.value) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`;
}

export function useAuth() {
  const router = useRouter();

  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const userRole = computed(() => user.value?.role || null);
  const userTeams = computed(() => user.value?.teams || []);

  async function login(email, password) {
    loading.value = true;
    error.value = null;

    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      token.value = response.data.token;
      user.value = response.data.user;

      // Store token in localStorage
      localStorage.setItem('mtm_token', token.value);
      localStorage.setItem('mtm_user', JSON.stringify(user.value));

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`;

      return { success: true };
    } catch (err) {
      error.value = err.response?.data?.error || 'Login failed. Please check your credentials.';
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('mtm_token');
    localStorage.removeItem('mtm_user');
    delete axios.defaults.headers.common['Authorization'];
    router.push('/login');
  }

  async function checkAuth() {
    if (!token.value) {
      return false;
    }

    try {
      const response = await axios.get('/api/auth/me');
      user.value = response.data.user;
      return true;
    } catch (err) {
      // Token invalid, clear auth
      logout();
      return false;
    }
  }

  function hasRole(...roles) {
    if (!user.value) return false;
    return roles.includes(user.value.role);
  }

  function hasTeamAccess(teamId) {
    if (!user.value) return false;
    if (user.value.role === 'SUPER_ADMIN' || user.value.role === 'ADMIN') {
      return true;
    }
    return user.value.teams.some(team => team.id === teamId || team === teamId);
  }

  // Initialize user from localStorage on app start
  function initAuth() {
    const storedUser = localStorage.getItem('mtm_user');
    if (storedUser && token.value) {
      try {
        user.value = JSON.parse(storedUser);
        // Verify token is still valid
        checkAuth();
      } catch (err) {
        console.error('Error parsing stored user:', err);
        logout();
      }
    }
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    userRole,
    userTeams,
    login,
    logout,
    checkAuth,
    hasRole,
    hasTeamAccess,
    initAuth,
  };
}

