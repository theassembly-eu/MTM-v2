<template>
  <div class="ab-tests-page">
    <div class="page-header">
      <h1>A/B Test Beheer</h1>
      <p class="page-subtitle">Beheer en monitor A/B tests voor prompt templates</p>
      <button @click="openCreateModal" class="btn-primary">
        <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Nieuwe A/B Test
      </button>
    </div>

    <!-- Filters -->
    <div class="filters card">
      <div class="filter-group">
        <label for="status-filter">Status</label>
        <select id="status-filter" v-model="statusFilter" @change="fetchTests">
          <option value="">Alle Statussen</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Actief</option>
          <option value="PAUSED">Gepauzeerd</option>
          <option value="COMPLETED">Voltooid</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="template-filter">Template</label>
        <select id="template-filter" v-model="templateFilter" @change="fetchTests">
          <option value="">Alle Templates</option>
          <option v-for="template in templates" :key="template._id" :value="template._id">
            {{ template.name }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Tests List -->
    <div v-if="!loading && !error" class="tests-grid">
      <div v-for="test in filteredTests" :key="test._id" class="test-card">
        <div class="test-header">
          <div class="test-title-section">
            <h3>{{ test.name }}</h3>
            <span :class="['status-badge', `status-${test.status.toLowerCase()}`]">
              {{ getStatusLabel(test.status) }}
            </span>
          </div>
          <div class="test-actions">
            <button @click="viewTest(test)" class="btn-icon" title="Details">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button @click="editTest(test)" class="btn-icon" title="Bewerken">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>

        <div class="test-content">
          <p v-if="test.description" class="test-description">{{ test.description }}</p>
          <div class="test-info">
            <div class="info-item">
              <span class="info-label">Template:</span>
              <span class="info-value">{{ test.templateName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Traffic:</span>
              <span class="info-value">{{ test.trafficAllocation }}%</span>
            </div>
            <div class="info-item">
              <span class="info-label">Metric:</span>
              <span class="info-value">{{ getMetricLabel(test.metrics.primaryMetric) }}</span>
            </div>
          </div>

          <!-- Variants Summary -->
          <div class="variants-summary">
            <div class="variant-summary variant-a">
              <div class="variant-header">
                <span class="variant-label">Variant A</span>
                <span class="variant-weight">{{ test.variants.find(v => v.name === 'A')?.weight || 50 }}%</span>
              </div>
              <div class="variant-stats">
                <span>{{ test.results.variantA.requests }} requests</span>
                <span v-if="test.results.variantA.avgTokens > 0">
                  {{ formatNumber(test.results.variantA.avgTokens) }} tokens avg
                </span>
              </div>
            </div>
            <div class="variant-summary variant-b">
              <div class="variant-header">
                <span class="variant-label">Variant B</span>
                <span class="variant-weight">{{ test.variants.find(v => v.name === 'B')?.weight || 50 }}%</span>
              </div>
              <div class="variant-stats">
                <span>{{ test.results.variantB.requests }} requests</span>
                <span v-if="test.results.variantB.avgTokens > 0">
                  {{ formatNumber(test.results.variantB.avgTokens) }} tokens avg
                </span>
              </div>
            </div>
          </div>

          <!-- Winner Badge -->
          <div v-if="test.results.winner" class="winner-badge">
            <span class="winner-label">Winnaar:</span>
            <span :class="['winner-variant', `winner-${test.results.winner.toLowerCase()}`]">
              Variant {{ test.results.winner }}
            </span>
            <span v-if="test.results.confidence > 0" class="confidence">
              ({{ test.results.confidence }}% vertrouwen)
            </span>
          </div>

          <!-- Actions -->
          <div class="test-actions-footer">
            <button 
              v-if="test.status === 'DRAFT'" 
              @click="startTest(test)" 
              class="btn-success btn-sm"
            >
              Starten
            </button>
            <button 
              v-if="test.status === 'ACTIVE'" 
              @click="pauseTest(test)" 
              class="btn-warning btn-sm"
            >
              Pauzeren
            </button>
            <button 
              v-if="test.status === 'PAUSED'" 
              @click="startTest(test)" 
              class="btn-success btn-sm"
            >
              Hervatten
            </button>
            <button 
              v-if="test.status === 'ACTIVE' || test.status === 'PAUSED'" 
              @click="completeTest(test)" 
              class="btn-primary btn-sm"
            >
              Voltooien
            </button>
            <button 
              @click="viewResults(test)" 
              class="btn-secondary btn-sm"
            >
              Resultaten
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredTests.length === 0" class="empty-state">
        <p>Geen A/B tests gevonden</p>
        <button @click="openCreateModal" class="btn-primary">Maak je eerste test</button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingTest ? 'Bewerk A/B Test' : 'Nieuwe A/B Test' }}</h2>
          <button @click="closeModal" class="btn-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="saveTest" class="modal-content">
          <div class="form-group">
            <label for="test-name">Naam *</label>
            <input 
              id="test-name"
              v-model="formData.name" 
              type="text" 
              required 
              placeholder="Bijv. Role Definition v2 vs v3"
            />
          </div>

          <div class="form-group">
            <label for="test-description">Beschrijving</label>
            <textarea 
              id="test-description"
              v-model="formData.description" 
              rows="3"
              placeholder="Beschrijf het doel van deze test..."
            ></textarea>
          </div>

          <div class="form-group">
            <label for="test-template">Template *</label>
            <select 
              id="test-template"
              v-model="formData.templateId" 
              required
              @change="loadTemplateVersions"
            >
              <option value="">Selecteer template...</option>
              <option v-for="template in templates" :key="template._id" :value="template._id">
                {{ template.name }} ({{ template.type }})
              </option>
            </select>
          </div>

          <div v-if="templateVersions.length > 0" class="variants-section">
            <h3>Variants</h3>
            
            <div class="variant-form variant-a">
              <h4>Variant A</h4>
              <div class="form-group">
                <label>Versie *</label>
                <select v-model="formData.variants[0].version" required>
                  <option value="">Selecteer versie...</option>
                  <option v-for="version in templateVersions" :key="version.version" :value="version.version">
                    {{ version.version }} {{ version.createdAt ? `(${formatDate(version.createdAt)})` : '' }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Beschrijving</label>
                <input 
                  v-model="formData.variants[0].description" 
                  type="text"
                  placeholder="Bijv. Huidige versie"
                />
              </div>
              <div class="form-group">
                <label>Weight (%)</label>
                <input 
                  v-model.number="formData.variants[0].weight" 
                  type="number" 
                  min="0" 
                  max="100" 
                  required
                />
              </div>
            </div>

            <div class="variant-form variant-b">
              <h4>Variant B</h4>
              <div class="form-group">
                <label>Versie *</label>
                <select v-model="formData.variants[1].version" required>
                  <option value="">Selecteer versie...</option>
                  <option v-for="version in templateVersions" :key="version.version" :value="version.version">
                    {{ version.version }} {{ version.createdAt ? `(${formatDate(version.createdAt)})` : '' }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Beschrijving</label>
                <input 
                  v-model="formData.variants[1].description" 
                  type="text"
                  placeholder="Bijv. Nieuwe geoptimaliseerde versie"
                />
              </div>
              <div class="form-group">
                <label>Weight (%)</label>
                <input 
                  v-model.number="formData.variants[1].weight" 
                  type="number" 
                  min="0" 
                  max="100" 
                  required
                />
              </div>
            </div>

            <div class="weight-warning" v-if="totalWeight !== 100">
              <span class="warning-icon">⚠️</span>
              <span>Total weight moet 100% zijn (huidig: {{ totalWeight }}%)</span>
            </div>
          </div>

          <div class="form-group">
            <label for="traffic-allocation">Traffic Allocatie (%)</label>
            <input 
              id="traffic-allocation"
              v-model.number="formData.trafficAllocation" 
              type="number" 
              min="0" 
              max="100" 
              required
            />
            <small>Percentage van requests die deel zullen nemen aan deze test</small>
          </div>

          <div class="form-group">
            <label for="min-sample-size">Minimum Sample Size</label>
            <input 
              id="min-sample-size"
              v-model.number="formData.minSampleSize" 
              type="number" 
              min="10" 
              required
            />
            <small>Minimum aantal requests per variant voordat test kan worden voltooid</small>
          </div>

          <div class="form-group">
            <label for="primary-metric">Primary Metric</label>
            <select id="primary-metric" v-model="formData.metrics.primaryMetric" required>
              <option value="tokenUsage">Token Usage (lager is beter)</option>
              <option value="responseTime">Response Time (lager is beter)</option>
              <option value="userRating">User Rating (hoger is beter)</option>
              <option value="custom">Custom Metric</option>
            </select>
          </div>

          <div v-if="formData.metrics.primaryMetric === 'custom'" class="form-group">
            <label for="custom-metric">Custom Metric Naam</label>
            <input 
              id="custom-metric"
              v-model="formData.metrics.customMetricName" 
              type="text"
              placeholder="Bijv. Quality Score"
            />
          </div>

          <div class="form-group">
            <label for="notes">Notities</label>
            <textarea 
              id="notes"
              v-model="formData.notes" 
              rows="2"
              placeholder="Interne notities over deze test..."
            ></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn-secondary">Annuleren</button>
            <button type="submit" class="btn-primary" :disabled="totalWeight !== 100">
              {{ editingTest ? 'Bijwerken' : 'Aanmaken' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Results Modal -->
    <div v-if="showResultsModal && selectedTest" class="modal-overlay" @click.self="closeResultsModal">
      <div class="modal modal-large">
        <div class="modal-header">
          <h2>Resultaten: {{ selectedTest.name }}</h2>
          <button @click="closeResultsModal" class="btn-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-content">
          <div class="results-summary">
            <div class="result-card">
              <h3>Variant A</h3>
              <div class="result-stats">
                <div class="stat">
                  <span class="stat-label">Requests:</span>
                  <span class="stat-value">{{ selectedTest.results.variantA.requests }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Avg Tokens:</span>
                  <span class="stat-value">{{ formatNumber(selectedTest.results.variantA.avgTokens) }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Avg Response Time:</span>
                  <span class="stat-value">{{ formatNumber(selectedTest.results.variantA.avgResponseTime) }}ms</span>
                </div>
                <div class="stat" v-if="selectedTest.results.variantA.avgRating > 0">
                  <span class="stat-label">Avg Rating:</span>
                  <span class="stat-value">{{ selectedTest.results.variantA.avgRating.toFixed(1) }}/5</span>
                </div>
              </div>
            </div>
            <div class="result-card">
              <h3>Variant B</h3>
              <div class="result-stats">
                <div class="stat">
                  <span class="stat-label">Requests:</span>
                  <span class="stat-value">{{ selectedTest.results.variantB.requests }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Avg Tokens:</span>
                  <span class="stat-value">{{ formatNumber(selectedTest.results.variantB.avgTokens) }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Avg Response Time:</span>
                  <span class="stat-value">{{ formatNumber(selectedTest.results.variantB.avgResponseTime) }}ms</span>
                </div>
                <div class="stat" v-if="selectedTest.results.variantB.avgRating > 0">
                  <span class="stat-label">Avg Rating:</span>
                  <span class="stat-value">{{ selectedTest.results.variantB.avgRating.toFixed(1) }}/5</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedTest.results.winner" class="winner-section">
            <h3>Winnaar</h3>
            <div class="winner-display">
              <span :class="['winner-badge-large', `winner-${selectedTest.results.winner.toLowerCase()}`]">
                Variant {{ selectedTest.results.winner }}
              </span>
              <span v-if="selectedTest.results.confidence > 0" class="confidence-large">
                {{ selectedTest.results.confidence }}% vertrouwen
              </span>
            </div>
          </div>

          <div class="modal-actions">
            <button @click="closeResultsModal" class="btn-primary">Sluiten</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useToast } from '../../composables/useToast.js';
import { useConfirm } from '../../composables/useConfirm.js';

const tests = ref([]);
const templates = ref([]);
const templateVersions = ref([]);
const loading = ref(false);
const error = ref(null);
const statusFilter = ref('');
const templateFilter = ref('');
const showModal = ref(false);
const showResultsModal = ref(false);
const editingTest = ref(null);
const selectedTest = ref(null);

const formData = ref({
  name: '',
  description: '',
  templateId: '',
  variants: [
    { name: 'A', version: '', description: '', weight: 50 },
    { name: 'B', version: '', description: '', weight: 50 },
  ],
  trafficAllocation: 100,
  minSampleSize: 100,
  metrics: {
    primaryMetric: 'tokenUsage',
    customMetricName: '',
  },
  notes: '',
});

const filteredTests = computed(() => {
  let filtered = tests.value;
  if (statusFilter.value) {
    filtered = filtered.filter(t => t.status === statusFilter.value);
  }
  if (templateFilter.value) {
    filtered = filtered.filter(t => t.templateId === templateFilter.value);
  }
  return filtered;
});

const totalWeight = computed(() => {
  return (formData.value.variants[0].weight || 0) + (formData.value.variants[1].weight || 0);
});

onMounted(() => {
  fetchTests();
  fetchTemplates();
});

async function fetchTests() {
  loading.value = true;
  error.value = null;
  try {
    const params = {};
    if (statusFilter.value) params.status = statusFilter.value;
    if (templateFilter.value) params.templateId = templateFilter.value;
    
    const response = await axios.get('/api/ab-tests', { params });
    tests.value = response.data;
  } catch (err) {
    error.value = err.response?.data?.error || 'Fout bij ophalen van A/B tests';
    console.error('Error fetching tests:', err);
  } finally {
    loading.value = false;
  }
}

async function fetchTemplates() {
  try {
    const response = await axios.get('/api/system-prompt-templates');
    templates.value = response.data;
  } catch (err) {
    console.error('Error fetching templates:', err);
  }
}

async function loadTemplateVersions() {
  if (!formData.value.templateId) {
    templateVersions.value = [];
    return;
  }
  
  try {
    const response = await axios.get(`/api/system-prompt-templates/${formData.value.templateId}`);
    const template = response.data;
    
    const versions = [];
    // Add current version
    if (template.currentVersion || template.version) {
      versions.push({
        version: template.currentVersion || template.version,
        createdAt: template.updatedAt || template.createdAt,
      });
    }
    // Add version history
    if (template.versionHistory && template.versionHistory.length > 0) {
      template.versionHistory.forEach(v => {
        versions.push({
          version: v.version,
          createdAt: v.createdAt,
        });
      });
    }
    
    templateVersions.value = versions.sort((a, b) => {
      // Sort by version number if possible, otherwise by date
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } catch (err) {
    console.error('Error loading template versions:', err);
    templateVersions.value = [];
  }
}

function openCreateModal() {
  editingTest.value = null;
  formData.value = {
    name: '',
    description: '',
    templateId: '',
    variants: [
      { name: 'A', version: '', description: '', weight: 50 },
      { name: 'B', version: '', description: '', weight: 50 },
    ],
    trafficAllocation: 100,
    minSampleSize: 100,
    metrics: {
      primaryMetric: 'tokenUsage',
      customMetricName: '',
    },
    notes: '',
  };
  templateVersions.value = [];
  showModal.value = true;
}

function editTest(test) {
  editingTest.value = test;
  formData.value = {
    name: test.name,
    description: test.description || '',
    templateId: test.templateId?._id || test.templateId,
    variants: test.variants.map(v => ({ ...v })),
    trafficAllocation: test.trafficAllocation,
    minSampleSize: test.minSampleSize,
    metrics: { ...test.metrics },
    notes: test.notes || '',
  };
  loadTemplateVersions();
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingTest.value = null;
  templateVersions.value = [];
}

async function saveTest() {
  if (totalWeight.value !== 100) {
    warning('Total weight moet 100% zijn');
    return;
  }

  try {
    if (editingTest.value) {
      await axios.put(`/api/ab-tests/${editingTest.value._id}`, formData.value);
      success('A/B test succesvol bijgewerkt');
    } else {
      await axios.post('/api/ab-tests', formData.value);
      success('A/B test succesvol aangemaakt');
    }
    closeModal();
    fetchTests();
  } catch (err) {
    console.error('Error saving test:', err);
    showError(err.response?.data?.error || 'Fout bij opslaan van test');
  }
}

async function startTest(test) {
  try {
    await axios.post(`/api/ab-tests/${test._id}/start`);
    success('A/B test succesvol gestart');
    fetchTests();
  } catch (err) {
    showError(err.response?.data?.error || 'Fout bij starten van test');
  }
}

async function pauseTest(test) {
  try {
    await axios.post(`/api/ab-tests/${test._id}/pause`);
    success('A/B test succesvol gepauzeerd');
    fetchTests();
  } catch (err) {
    showError(err.response?.data?.error || 'Fout bij pauzeren van test');
  }
}

async function completeTest(test) {
  try {
    const confirmed = await confirm({
      title: 'A/B test voltooien',
      message: 'Weet je zeker dat je deze test wilt voltooien?',
      description: 'Dit zal de winnaar berekenen en de test afsluiten.',
      type: 'warning',
      confirmText: 'Voltooien',
      cancelText: 'Annuleren',
    });
    
    if (!confirmed) return;
    
    await axios.post(`/api/ab-tests/${test._id}/complete`);
    success('A/B test succesvol voltooid');
    fetchTests();
  } catch (err) {
    if (err === false) return; // User cancelled
    showError(err.response?.data?.error || 'Fout bij voltooien van test');
  }
}

function viewTest(test) {
  selectedTest.value = test;
  showResultsModal.value = true;
}

function viewResults(test) {
  selectedTest.value = test;
  showResultsModal.value = true;
}

function closeResultsModal() {
  showResultsModal.value = null;
  showResultsModal.value = false;
}

function getStatusLabel(status) {
  const labels = {
    DRAFT: 'Draft',
    ACTIVE: 'Actief',
    PAUSED: 'Gepauzeerd',
    COMPLETED: 'Voltooid',
  };
  return labels[status] || status;
}

function getMetricLabel(metric) {
  const labels = {
    tokenUsage: 'Token Usage',
    responseTime: 'Response Time',
    userRating: 'User Rating',
    custom: 'Custom',
  };
  return labels[metric] || metric;
}

function formatNumber(num) {
  if (!num) return '0';
  return Math.round(num).toLocaleString('nl-NL');
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('nl-NL');
}
</script>

<style scoped>
.ab-tests-page {
  padding: var(--spacing-6);
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-6);
  gap: var(--spacing-4);
}

.page-header h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-2) 0;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
}

.filters {
  display: flex;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
  padding: var(--spacing-4);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  min-width: 200px;
}

.filter-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.filter-group select {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
}

.tests-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--spacing-6);
}

.test-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.test-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-4);
}

.test-title-section {
  flex: 1;
}

.test-title-section h3 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-2) 0;
}

.test-actions {
  display: flex;
  gap: var(--spacing-2);
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.status-draft {
  background: #e5e7eb;
  color: #374151;
}

.status-active {
  background: #d1fae5;
  color: #065f46;
}

.status-paused {
  background: #fef3c7;
  color: #92400e;
}

.status-completed {
  background: #dbeafe;
  color: #1e40af;
}

.test-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-4);
}

.test-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
}

.info-item {
  display: flex;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
}

.info-label {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.info-value {
  color: var(--color-text-primary);
}

.variants-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.variant-summary {
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
}

.variant-a {
  background: rgba(59, 130, 246, 0.1);
  border-left: 3px solid #3b82f6;
}

.variant-b {
  background: rgba(16, 185, 129, 0.1);
  border-left: 3px solid #10b981;
}

.variant-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-2);
}

.variant-label {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.variant-weight {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.variant-stats {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.winner-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-4);
  font-size: var(--font-size-sm);
}

.winner-label {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.winner-variant {
  font-weight: var(--font-weight-semibold);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}

.winner-a {
  background: rgba(59, 130, 246, 0.2);
  color: #1e40af;
}

.winner-b {
  background: rgba(16, 185, 129, 0.2);
  color: #065f46;
}

.confidence {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.test-actions-footer {
  display: flex;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.btn-sm {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-sm);
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: var(--spacing-12);
  color: var(--color-text-secondary);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-4);
}

.modal {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-large {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.modal-content {
  padding: var(--spacing-6);
}

.form-group {
  margin-bottom: var(--spacing-4);
}

.form-group label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-family: inherit;
}

.form-group small {
  display: block;
  margin-top: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.variants-section {
  margin: var(--spacing-6) 0;
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.variants-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-4) 0;
}

.variant-form {
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.variant-form h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-3) 0;
}

.variant-a {
  border-left: 3px solid #3b82f6;
}

.variant-b {
  border-left: 3px solid #10b981;
}

.weight-warning {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: #fef3c7;
  color: #92400e;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-4);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
  margin-top: var(--spacing-6);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-border);
}

.results-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

.result-card {
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.result-card h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-4) 0;
}

.result-stats {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.stat {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.stat-label {
  color: var(--color-text-secondary);
}

.stat-value {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.winner-section {
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-6);
}

.winner-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-3) 0;
}

.winner-display {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.winner-badge-large {
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-lg);
}

.confidence-large {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .tests-grid {
    grid-template-columns: 1fr;
  }
  
  .variants-summary,
  .results-summary {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
  }
}
</style>

