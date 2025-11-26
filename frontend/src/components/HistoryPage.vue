<template>
  <div class="history-page">
    <div class="page-header">
      <h1>Geschiedenis</h1>
      <p class="page-subtitle">Bekijk alle vereenvoudigde teksten en hun context</p>
    </div>

    <div class="filters card">
      <div class="filter-group">
        <label for="search">Zoeken</label>
        <input 
          id="search"
          type="text" 
          v-model="searchQuery" 
          placeholder="Zoeken in tekst..." 
          @input="debouncedFetch"
        />
      </div>
      <div class="filter-group">
        <label for="team-filter">Team</label>
        <select id="team-filter" v-model="selectedTeamId" @change="onTeamChange">
          <option value="">Alle teams</option>
          <option v-for="team in teams" :key="team.id" :value="team.id">
            {{ team.name }}
          </option>
        </select>
      </div>
      <div class="filter-group">
        <label for="project-filter">Project</label>
        <select id="project-filter" v-model="selectedProjectId" @change="fetchRequestLogs">
          <option value="">Alle projecten</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>
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
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-8) var(--spacing-4);
}

.page-header {
  margin-bottom: var(--spacing-8);
  text-align: center;
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

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-8);
  padding: var(--spacing-6);
}

.filter-group {
  display: flex;
  flex-direction: column;
}

.filter-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.filter-group input,
.filter-group select {
  width: 100%;
}

.loading, .no-results {
  text-align: center;
  padding: var(--spacing-8);
  color: var(--color-text-secondary);
}

.error {
  background-color: #FEF2F2;
  color: var(--color-error);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-6);
  border: 1px solid #FECACA;
  text-align: center;
}

.results-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.result-item {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.result-item:hover {
  box-shadow: var(--shadow-md);
}

.result-header {
  margin-bottom: var(--spacing-4);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.result-meta {
  margin: var(--spacing-2) 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.result-body {
  margin-top: var(--spacing-4);
}

.text-section {
  margin-bottom: var(--spacing-6);
}

.text-section strong {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.text-section p,
.text-section pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: var(--color-bg-secondary);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.context-info {
  margin-top: var(--spacing-4);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.context-info div {
  margin: var(--spacing-2) 0;
  color: var(--color-text-secondary);
}

.pagination-info {
  text-align: center;
  margin: var(--spacing-6) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  margin-top: var(--spacing-8);
}

.pagination-btn {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

@media (max-width: 768px) {
  .history-page {
    padding: var(--spacing-4) var(--spacing-3);
  }
  
  .filters {
    grid-template-columns: 1fr;
  }
  
  .page-header h1 {
    font-size: var(--font-size-3xl);
  }
}
</style>