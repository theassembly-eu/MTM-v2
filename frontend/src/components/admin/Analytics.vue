<template>
  <div class="analytics-page">
    <div class="page-header">
      <h1>Analytics Dashboard</h1>
      <p class="page-subtitle">Platform gebruik en statistieken</p>
    </div>

    <!-- Date Filter -->
    <div class="filters card">
      <div class="filter-group">
        <label for="start-date">Vanaf Datum</label>
        <input 
          id="start-date"
          type="date" 
          v-model="startDate" 
          @change="fetchAnalytics"
        />
      </div>
      <div class="filter-group">
        <label for="end-date">Tot Datum</label>
        <input 
          id="end-date"
          type="date" 
          v-model="endDate" 
          @change="fetchAnalytics"
        />
      </div>
      <div class="filter-group">
        <button @click="resetFilters" class="btn-secondary">Reset</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="!loading && !error && analytics" class="analytics-content">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="card-icon">📊</div>
          <div class="card-content">
            <h3>Totale Requests</h3>
            <p class="card-value">{{ analytics.summary.totalRequests }}</p>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon">👥</div>
          <div class="card-content">
            <h3>Actieve Gebruikers</h3>
            <p class="card-value">{{ analytics.summary.totalUsers }}</p>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon">🏢</div>
          <div class="card-content">
            <h3>Teams</h3>
            <p class="card-value">{{ analytics.summary.totalTeams }}</p>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon">📁</div>
          <div class="card-content">
            <h3>Projecten</h3>
            <p class="card-value">{{ analytics.summary.totalProjects }}</p>
          </div>
        </div>
        <div v-if="analytics.summary.totalTokens > 0" class="summary-card">
          <div class="card-icon">🔢</div>
          <div class="card-content">
            <h3>Totale Tokens</h3>
            <p class="card-value">{{ formatNumber(analytics.summary.totalTokens) }}</p>
            <p class="card-subtitle">Gemiddeld: {{ formatNumber(Math.round(analytics.summary.avgTokens)) }}</p>
          </div>
        </div>
      </div>

      <!-- Charts Row 1 -->
      <div class="charts-row">
        <div class="chart-card">
          <h2>Requests Over Tijd</h2>
          <div class="chart-wrapper">
            <LineChart 
              v-if="analytics.requestsOverTime.length > 0"
              :data="requestsOverTimeChartData"
              :options="lineChartOptions"
            />
            <div v-else class="no-data">Geen data beschikbaar</div>
          </div>
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="charts-row">
        <div class="chart-card">
          <h2>Requests per Gebruiker (Top 10)</h2>
          <div class="chart-wrapper">
            <BarChart 
              v-if="analytics.requestsPerUser.length > 0"
              :data="requestsPerUserChartData"
              :options="barChartOptions"
            />
            <div v-else class="no-data">Geen data beschikbaar</div>
          </div>
        </div>
        <div class="chart-card">
          <h2>Requests per Team (Top 10)</h2>
          <div class="chart-wrapper">
            <BarChart 
              v-if="analytics.requestsPerTeam.length > 0"
              :data="requestsPerTeamChartData"
              :options="barChartOptions"
            />
            <div v-else class="no-data">Geen data beschikbaar</div>
          </div>
        </div>
      </div>

      <!-- Charts Row 3 -->
      <div class="charts-row">
        <div class="chart-card">
          <h2>LVL Gebruik</h2>
          <div class="chart-wrapper">
            <DoughnutChart 
              v-if="analytics.lvlUsage.length > 0"
              :data="lvlUsageChartData"
              :options="doughnutChartOptions"
            />
            <div v-else class="no-data">Geen data beschikbaar</div>
          </div>
        </div>
        <div class="chart-card">
          <h2>Populaire Trefwoorden (Top 20)</h2>
          <div class="chart-wrapper">
            <BarChart 
              v-if="analytics.popularKeywords.length > 0"
              :data="popularKeywordsChartData"
              :options="barChartOptions"
            />
            <div v-else class="no-data">Geen data beschikbaar</div>
          </div>
        </div>
      </div>

      <!-- Tables -->
      <div class="tables-row">
        <div class="table-card">
          <h2>Requests per Project (Top 10)</h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in analytics.requestsPerProject" :key="item.projectId">
                <td>{{ item.projectName }}</td>
                <td>{{ item.count }}</td>
              </tr>
              <tr v-if="analytics.requestsPerProject.length === 0">
                <td colspan="2" class="no-data">Geen data beschikbaar</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const LineChart = Line;
const BarChart = Bar;
const DoughnutChart = Doughnut;

const loading = ref(false);
const error = ref(null);
const analytics = ref(null);
const startDate = ref('');
const endDate = ref('');

// Chart options
const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
    },
  },
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
      },
    },
  },
};

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
    },
  },
};

// Chart data computed properties
const requestsOverTimeChartData = computed(() => {
  if (!analytics.value?.requestsOverTime) return null;
  return {
    labels: analytics.value.requestsOverTime.map(item => item.date),
    datasets: [
      {
        label: 'Requests',
        data: analytics.value.requestsOverTime.map(item => item.count),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };
});

const requestsPerUserChartData = computed(() => {
  if (!analytics.value?.requestsPerUser) return null;
  return {
    labels: analytics.value.requestsPerUser.map(item => item.userName || item.userEmail),
    datasets: [
      {
        label: 'Requests',
        data: analytics.value.requestsPerUser.map(item => item.count),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  };
});

const requestsPerTeamChartData = computed(() => {
  if (!analytics.value?.requestsPerTeam) return null;
  return {
    labels: analytics.value.requestsPerTeam.map(item => item.teamName),
    datasets: [
      {
        label: 'Requests',
        data: analytics.value.requestsPerTeam.map(item => item.count),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
      },
    ],
  };
});

const lvlUsageChartData = computed(() => {
  if (!analytics.value?.lvlUsage) return null;
  const colors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
  ];
  return {
    labels: analytics.value.lvlUsage.map(item => `${item.lvlName} (${item.lvlCode})`),
    datasets: [
      {
        data: analytics.value.lvlUsage.map(item => item.count),
        backgroundColor: analytics.value.lvlUsage.map((_, index) => 
          colors[index % colors.length]
        ),
      },
    ],
  };
});

const popularKeywordsChartData = computed(() => {
  if (!analytics.value?.popularKeywords) return null;
  return {
    labels: analytics.value.popularKeywords.map(item => item.keyword),
    datasets: [
      {
        label: 'Gebruik',
        data: analytics.value.popularKeywords.map(item => item.count),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
      },
    ],
  };
});

async function fetchAnalytics() {
  loading.value = true;
  error.value = null;
  try {
    const params = {};
    if (startDate.value) params.startDate = startDate.value;
    if (endDate.value) params.endDate = endDate.value;
    
    const response = await axios.get('/api/analytics', { params });
    analytics.value = response.data;
  } catch (err) {
    console.error('Error fetching analytics:', err);
    error.value = err.response?.data?.error || 'Fout bij het ophalen van analytics';
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  startDate.value = '';
  endDate.value = '';
  fetchAnalytics();
}

function formatNumber(num) {
  return new Intl.NumberFormat('nl-NL').format(num);
}

onMounted(() => {
  fetchAnalytics();
});
</script>

<style scoped>
.analytics-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--spacing-8) var(--spacing-4);
}

.page-header {
  margin-bottom: var(--spacing-8);
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
  display: flex;
  gap: var(--spacing-4);
  align-items: flex-end;
  margin-bottom: var(--spacing-8);
  padding: var(--spacing-6);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.filter-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.filter-group input {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-8);
}

.summary-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
}

.card-icon {
  font-size: var(--font-size-3xl);
}

.card-content h3 {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-1) 0;
}

.card-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.card-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: var(--spacing-1) 0 0 0;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: var(--spacing-6);
  margin-bottom: var(--spacing-6);
}

.chart-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chart-card h2 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
  flex-shrink: 0;
}

.chart-wrapper {
  height: 300px;
  min-height: 300px;
  max-height: 300px;
  position: relative;
  flex: 1 1 auto;
  overflow: hidden;
}

.chart-wrapper canvas {
  max-height: 100% !important;
}

.tables-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-6);
  margin-bottom: var(--spacing-6);
}

.table-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
}

.table-card h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: var(--spacing-3);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.data-table th {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.data-table td {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.no-data {
  text-align: center;
  color: var(--color-text-tertiary);
  font-style: italic;
  padding: var(--spacing-8);
}

.loading {
  text-align: center;
  padding: var(--spacing-8);
  color: var(--color-text-secondary);
}

.error-message {
  background: var(--color-error);
  color: var(--color-text-inverse);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-4);
}

.card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.btn-secondary {
  padding: var(--spacing-2) var(--spacing-4);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary);
}

@media (max-width: 1024px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
  
  .summary-cards {
    grid-template-columns: 1fr;
  }
  
  .chart-wrapper {
    height: 250px;
    min-height: 250px;
    max-height: 250px;
  }
}
</style>

