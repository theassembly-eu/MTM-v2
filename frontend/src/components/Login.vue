<template>
  <div class="login-container">
    <div class="login-card">
      <img 
        src="https://assets.nationbuilder.com/vooruit/sites/3/meta_images/original/Vooruit_thumbnail.jpg?1619535283" 
        alt="Vooruit Logo" 
        class="logo"
      />
      <h1>MensentaalMachine v2.0</h1>
      <h2>Login</h2>

      <form @submit.prevent="handleLogin" class="login-form">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="your.email@example.com"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            placeholder="Enter your password"
            :disabled="loading"
          />
        </div>

        <button type="submit" :disabled="loading" class="login-button">
          <span v-if="loading">Logging in...</span>
          <span v-else>Login</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';

const router = useRouter();
const { login, error, loading } = useAuth();

const email = ref('');
const password = ref('');

async function handleLogin() {
  const result = await login(email.value, password.value);
  if (result.success) {
    router.push('/simplify');
  }
}

onMounted(() => {
  // Clear any previous errors
  error.value = null;
});
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f2f5;
  padding: 2rem;
}

.login-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 3rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.logo {
  max-width: 150px;
  margin-bottom: 1rem;
}

h1 {
  font-size: 2rem;
  color: #000;
  margin-bottom: 0.5rem;
}

h2 {
  font-size: 1.5rem;
  color: #333;
  margin-bottom: 2rem;
}

.login-form {
  text-align: left;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #000;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1em;
  box-sizing: border-box;
  background-color: #fdfdfd;
  color: #333;
}

.form-group input:focus {
  outline: none;
  border-color: #FF0000;
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.error-message {
  background-color: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  border: 1px solid #fcc;
}

.login-button {
  width: 100%;
  padding: 12px 24px;
  font-size: 1.1em;
  font-weight: 600;
  background-color: #FF0000;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.2s ease;
  margin-top: 1rem;
}

.login-button:hover:not(:disabled) {
  background-color: #cc0000;
  transform: translateY(-2px);
}

.login-button:disabled {
  background-color: #999;
  cursor: not-allowed;
  transform: none;
}

.login-button:focus {
  outline: 4px auto -webkit-focus-ring-color;
}
</style>

