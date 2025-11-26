<template>
  <div class="history-page">
    <h2>Geschiedenis</h2>

    <div class="filters">
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="Zoeken in tekst..." 
        @input="debouncedFetch"
      />
      <select v-model="selectedProjectId" @change="fetchRequestLogs">
        <option value="">Alle projecten</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
      <select v-model="selectedTeamId" @change="onTeamChange">
        <option value="">Alle teams</option>
        <option v-for="team in teams" :key="team.id" :value="team.id">
          {{ team.name }}
        </option>
      </select>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error">{{ error }}</div>
    
    <div v-if="requestLogs.length === 0 && !loading" class="no-results">
      Geen resultaten gevonden.
    </div>

    <div v-else>
      <div class="pagination-info">
        Pagina {{ pagination.page }} van {{ pagination.totalPages }} 
        ({{ pagination.total }} totaal)
      </div>

      <ul class="results-list">
        <li v-for="log in requestLogs" :key="log.id" class="result-item">
          <div class="result-header">
            <div class="result-meta">
              <strong>Team:</strong> {{ log.team?.name || 'Onbekend' }} | 
              <strong>Project:</strong> {{ log.project?.name || 'Onbekend' }} | 
              <strong>LVL:</strong> {{ log.lvl?.name || 'Onbekend' }}
            </div>
            <div class="result-meta">
              <strong>Doelgroep:</strong> {{ log.targetAudience?.name || 'N/A' }} | 
              <strong>Formaat:</strong> {{ log.outputFormat?.name || 'N/A' }} | 
              <strong>Taal:</strong> {{ log.language?.name || 'N/A' }}
            </div>
            <div class="result-meta">
              <strong>Gebruiker:</strong> {{ log.user?.email || 'Onbekend' }} | 
              <strong>Datum:</strong> {{ formatDate(log.createdAt) }}
              <span v-if="log.modelMeta?.totalTokens">
                | <strong>Tokens:</strong> {{ log.modelMeta.totalTokens }}
              </span>
            </div>
          </div>
          <div class="result-body">
            <div class="text-section">
              <strong>Originele Tekst:</strong>
              <p>{{ log.originalText }}</p>
            </div>
            <div class="text-section">
              <strong>Vereenvoudigde Tekst:</strong>
              <pre>{{ log.simplifiedText }}</pre>
            </div>
            <div v-if="log.geoContext || log.includeKeywords?.length > 0 || log.avoidKeywords?.length > 0" class="context-info">
              <div v-if="log.geoContext"><strong>Geografische Context:</strong> {{ log.geoContext }}</div>
              <div v-if="log.includeKeywords?.length > 0">
                <strong>Te Gebruiken Trefwoorden:</strong> {{ log.includeKeywords.join(', ') }}
              </div>
              <div v-if="log.avoidKeywords?.length > 0">
                <strong>Te Vermijden Trefwoorden:</strong> {{ log.avoidKeywords.join(', ') }}
              </div>
              <div v-if="log.referenceIds?.length > 0">
                <strong>Referenties:</strong> 
                <span v-for="(ref, idx) in log.referenceIds" :key="idx">
                  {{ ref.title || ref }}{{ idx < log.referenceIds.length - 1 ? ', ' : '' }}
                </span>
              </div>
            </div>
          </div>
        </li>
      </ul>

      <div class="pagination">
        <button 
          @click="changePage(pagination.page - 1)" 
          :disabled="pagination.page <= 1"
          class="pagination-btn"
        >
          Vorige
        </button>
        <span>Pagina {{ pagination.page }} van {{ pagination.totalPages }}</span>
        <button 
          @click="changePage(pagination.page + 1)" 
          :disabled="pagination.page >= pagination.totalPages"
          class="pagination-btn"
        >
          Volgende
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';

const requestLogs = ref([]);
const loading = ref(true);
const error = ref(null);
const searchQuery = ref('');
const selectedProjectId = ref('');
const selectedTeamId = ref('');
const projects = ref([]);
const teams = ref([]);
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

let debounceTimer = null;

function debouncedFetch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pagination.value.page = 1; // Reset to first page on search
    fetchRequestLogs();
  }, 500);
}

function onTeamChange() {
  selectedProjectId.value = '';
  fetchProjects();
  fetchRequestLogs();
}

async function fetchTeams() {
  try {
    const response = await axios.get('/api/teams');
    teams.value = response.data.map(t => ({
      id: t._id || t.id,
      name: t.name,
    }));
  } catch (err) {
    console.error('Error fetching teams:', err);
  }
}

async function fetchProjects() {
  try {
    const params = selectedTeamId.value ? { teamId: selectedTeamId.value } : {};
    const response = await axios.get('/api/projects', { params });
    projects.value = response.data.map(p => ({
      id: p._id || p.id,
      name: p.name,
    }));
  } catch (err) {
    console.error('Error fetching projects:', err);
  }
}

async function fetchRequestLogs() {
  loading.value = true;
  error.value = null;
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
    };
    
    if (searchQuery.value) {
      // Note: Backend doesn't have search yet, but we can filter client-side
      // For now, just use project filter
    }
    
    if (selectedProjectId.value) {
      params.projectId = selectedProjectId.value;
    }

    const response = await axios.get('/api/request-logs', { params });
    requestLogs.value = response.data.data.map(log => ({
      id: log._id || log.id,
      user: log.user,
      team: log.team,
      project: log.project,
      lvl: log.lvl,
      originalText: log.originalText,
      simplifiedText: log.simplifiedText,
      targetAudience: log.targetAudience,
      outputFormat: log.outputFormat,
      language: log.language,
      geoContext: log.geoContext,
      includeKeywords: log.includeKeywords,
      avoidKeywords: log.avoidKeywords,
      referenceIds: log.referenceIds,
      modelMeta: log.modelMeta,
      createdAt: log.createdAt,
    }));

    pagination.value = {
      page: response.data.pagination.page,
      limit: response.data.pagination.limit,
      total: response.data.pagination.total,
      totalPages: response.data.pagination.totalPages,
    };

    // Client-side search filter if needed
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      requestLogs.value = requestLogs.value.filter(log => 
        log.originalText.toLowerCase().includes(query) ||
        log.simplifiedText.toLowerCase().includes(query)
      );
    }
  } catch (err) {
    console.error('Error fetching request logs:', err);
    error.value = 'Fout bij het ophalen van geschiedenis.';
  } finally {
    loading.value = false;
  }
}

function changePage(newPage) {
  pagination.value.page = newPage;
  fetchRequestLogs();
}

function formatDate(dateString) {
  if (!dateString) return 'Onbekend';
  return new Date(dateString).toLocaleString('nl-BE');
}

onMounted(async () => {
  await Promise.all([fetchTeams(), fetchProjects()]);
  await fetchRequestLogs();
});

watch(selectedProjectId, () => {
  pagination.value.page = 1;
  fetchRequestLogs();
});
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

.filters {
  display: flex;
  justify-content: space-between;
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

.result-header {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #ddd;
}

.result-meta {
  margin: 0.5rem 0;
  font-size: 0.9em;
  color: #666;
}

.result-body {
  margin-top: 1rem;
}

.text-section {
  margin-bottom: 1.5rem;
}

.text-section strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #000;
}

.text-section p,
.text-section pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #eee;
  padding: 1rem;
  border-radius: 4px;
  margin: 0;
}

.context-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 0.9em;
}

.context-info div {
  margin: 0.5rem 0;
}

.pagination-info {
  text-align: center;
  margin: 1rem 0;
  color: #666;
  font-size: 0.9em;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.pagination-btn {
  padding: 0.5rem 1rem;
  background: #FF0000;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.pagination-btn:hover:not(:disabled) {
  background: #cc0000;
}

.pagination-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>