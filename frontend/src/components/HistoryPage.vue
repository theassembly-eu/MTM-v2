<template>
  <div class="history-page">
    <h2>Geschiedenis</h2>
    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="savedResults.length === 0 && !loading" class="no-results">
      Geen opgeslagen resultaten gevonden.
    </div>
    <ul v-else class="results-list">
      <li v-for="result in savedResults" :key="result._id" class="result-item">
        <div class="result-header">
          <strong>Originele Tekst:</strong>
          <p>{{ result.originalText }}</p>
        </div>
        <div class="result-body">
          <strong>Vereenvoudigde Tekst:</strong>
          <pre>{{ result.simplifiedText }}</pre>
        </div>
        <div class="result-footer">
          <span>Opgeslagen op: {{ new Date(result.createdAt).toLocaleString() }}</span>
          <button @click="deleteResult(result._id)" class="delete-btn">Verwijder</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import axios from 'axios';

export default {
  name: 'HistoryPage',
  setup() {
    const savedResults = ref([]);
    const loading = ref(true);
    const error = ref(null);

    const fetchSavedResults = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/saved-results');
        savedResults.value = response.data;
      } catch (err) {
        error.value = 'Fout bij het ophalen van opgeslagen resultaten.';
        console.error(err);
      } finally {
        loading.value = false;
      }
    };

    const deleteResult = async (id) => {
      if (!confirm('Weet je zeker dat je dit resultaat wilt verwijderen?')) {
        return;
      }
      try {
        await axios.delete(`http://localhost:3000/api/saved-results/${id}`);
        savedResults.value = savedResults.value.filter(result => result._id !== id);
      } catch (err) {
        error.value = 'Fout bij het verwijderen van het resultaat.';
        console.error(err);
      }
    };

    onMounted(fetchSavedResults);

    return {
      savedResults,
      loading,
      error,
      deleteResult,
    };
  },
};
</script>

<style scoped>
.history-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  text-align: center;
  margin-bottom: 2rem;
}

.loading, .error, .no-results {
  text-align: center;
  padding: 1rem;
}

.error {
  color: red;
}

.results-list {
  list-style: none;
  padding: 0;
}

.result-item {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 1rem;
  padding: 1.5rem;
}

.result-header strong {
  display: block;
  margin-bottom: 0.5rem;
}

.result-body {
  margin-top: 1rem;
}

.result-body pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #eee;
  padding: 1rem;
  border-radius: 4px;
}

.result-footer {
  margin-top: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: #666;
}

.delete-btn {
  background: #ff4d4d;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn:hover {
  background: #e60000;
}
</style>