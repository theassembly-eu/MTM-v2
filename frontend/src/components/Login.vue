<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img 
            src="https://assets.nationbuilder.com/vooruit/sites/3/meta_images/original/Vooruit_thumbnail.jpg?1619535283" 
            alt="Vooruit Logo" 
            class="login-logo"
          />
          <h1 class="login-title">MensentaalMachine</h1>
          <p class="login-subtitle">v{{ appVersion }}</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div v-if="error" class="alert alert-error">
            <svg class="alert-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ error }}
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              placeholder="jouw.email@voorbeeld.be"
              :disabled="loading"
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label for="password">Wachtwoord</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              placeholder="Voer je wachtwoord in"
              :disabled="loading"
              autocomplete="current-password"
            />
          </div>

          <button type="submit" :disabled="loading" class="btn-primary btn-login">
            <span v-if="loading" class="loading-spinner"></span>
            <span v-else>Inloggen</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';

const router = useRouter();
const { login, error, loading } = useAuth();

const appVersion = ref('2.0.0');
const email = ref('');
const password = ref('');

async function handleLogin() {
  const result = await login(email.value, password.value);
  if (result.success) {
    router.push('/simplify');
  }
}

onMounted(() => {
  error.value = null;
});
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%);
  padding: var(--spacing-4);
}

.login-container {
  width: 100%;
  max-width: 420px;
}

.login-card {
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  padding: var(--spacing-10);
  border: 1px solid var(--color-border);
}

.login-header {
  text-align: center;
  margin-bottom: var(--spacing-8);
}

.login-logo {
  height: 64px;
  width: auto;
  margin-bottom: var(--spacing-4);
}

.login-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-1);
  letter-spacing: -0.02em;
}

.login-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  font-weight: var(--font-weight-normal);
}

.login-form {
  text-align: left;
}

.form-group {
  margin-bottom: var(--spacing-5);
}

.form-group label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.form-group input {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.form-group input:disabled {
  background-color: var(--color-bg-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}

.form-group input::placeholder {
  color: var(--color-text-tertiary);
}

.alert {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-5);
  font-size: var(--font-size-sm);
}

.alert-error {
  background-color: #FEF2F2;
  color: var(--color-error);
  border: 1px solid #FECACA;
}

.alert-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.btn-login {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-6);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin-top: var(--spacing-2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .login-card {
    padding: var(--spacing-6);
  }
  
  .login-title {
    font-size: var(--font-size-2xl);
  }
}
</style>
