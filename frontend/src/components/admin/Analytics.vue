<template>
  <div class="analytics-page">
    <div class="page-header">
      <h1>Analytics Dashboard</h1>
      <p class="page-subtitle">Platform gebruik, statistieken en prompt management inzichten</p>
    </div>

    <!-- LVL Filter Indicator (for ADMIN users) -->
    <div v-if="isAdmin && userLvls.length > 0" class="filter-indicator">
      <div class="filter-indicator-content">
        <div class="filter-indicator-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </div>
        <div class="filter-indicator-text">
          <span class="filter-indicator-label">Gefilterd op administratieve niveaus:</span>
          <div class="filter-lvl-badges">
            <span 
              v-for="lvl in userLvls" 
              :key="lvl.id" 
              class="lvl-badge"
            >
              {{ lvl.name }}
              <span class="lvl-code">({{ lvl.code }})</span>
            </span>
          </div>
        </div>
      </div>
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
      <!-- Tabs Navigation -->
      <div class="tabs-container">
        <div class="tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
            <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="tab-panel">
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

        <!-- Prompt Analytics Tab -->
        <div v-if="activeTab === 'prompts'" class="tab-panel">
          <div class="insights-header">
            <h2>Prompt Management Inzichten</h2>
            <p class="insights-subtitle">Analyse van prompt gebruik om optimalisaties te identificeren</p>
          </div>

          <!-- Prompt Summary Cards -->
          <div class="summary-cards">
            <div class="summary-card highlight">
              <div class="card-icon">📝</div>
              <div class="card-content">
                <h3>Output Formaten</h3>
                <p class="card-value">{{ promptAnalytics?.outputFormatUsage?.length || 0 }}</p>
                <p class="card-subtitle">Unieke formaten gebruikt</p>
              </div>
            </div>
            <div class="summary-card highlight">
              <div class="card-icon">🔬</div>
              <div class="card-content">
                <h3>Research Mode</h3>
                <p class="card-value">{{ researchModePercentage }}%</p>
                <p class="card-subtitle">{{ researchModeStats?.enabled || 0 }} van {{ totalResearchRequests }} requests</p>
              </div>
            </div>
            <div class="summary-card highlight">
              <div class="card-icon">🎯</div>
              <div class="card-content">
                <h3>Doelgroepen</h3>
                <p class="card-value">{{ promptAnalytics?.targetAudienceUsage?.length || 0 }}</p>
                <p class="card-subtitle">Actieve doelgroepen</p>
              </div>
            </div>
            <div class="summary-card highlight">
              <div class="card-icon">📚</div>
              <div class="card-content">
                <h3>Referenties</h3>
                <p class="card-value">{{ promptAnalytics?.referenceUsage?.length || 0 }}</p>
                <p class="card-subtitle">Meest gebruikt</p>
              </div>
            </div>
          </div>

          <!-- Output Format Analysis -->
          <div class="charts-row">
            <div class="chart-card">
              <h2>Output Formaat Distributie</h2>
              <div class="chart-wrapper">
                <DoughnutChart 
                  v-if="outputFormatChartData"
                  :data="outputFormatChartData"
                  :options="doughnutChartOptions"
                />
                <div v-else class="no-data">Geen data beschikbaar</div>
              </div>
            </div>
            <div class="chart-card">
              <h2>Token Gebruik per Formaat</h2>
              <div class="chart-wrapper">
                <BarChart 
                  v-if="tokenUsageByFormatChartData"
                  :data="tokenUsageByFormatChartData"
                  :options="barChartOptions"
                />
                <div v-else class="no-data">Geen data beschikbaar</div>
              </div>
            </div>
          </div>

          <!-- Research Mode Analysis -->
          <div class="charts-row">
            <div class="chart-card">
              <h2>Research Mode Adoptie</h2>
              <div class="chart-wrapper">
                <DoughnutChart 
                  v-if="researchModeChartData"
                  :data="researchModeChartData"
                  :options="doughnutChartOptions"
                />
                <div v-else class="no-data">Geen data beschikbaar</div>
              </div>
              <div v-if="researchModeStats" class="chart-insights">
                <div class="insight-item">
                  <span class="insight-label">Gemiddeld Tokens (Research):</span>
                  <span class="insight-value">{{ formatNumber(researchModeStats.enabledAvgTokens) }}</span>
                </div>
                <div class="insight-item">
                  <span class="insight-label">Gemiddeld Tokens (Normaal):</span>
                  <span class="insight-value">{{ formatNumber(researchModeStats.disabledAvgTokens) }}</span>
                </div>
                <div class="insight-item highlight">
                  <span class="insight-label">Verschil:</span>
                  <span class="insight-value">{{ formatNumber(researchModeStats.enabledAvgTokens - researchModeStats.disabledAvgTokens) }} tokens</span>
                </div>
              </div>
            </div>
            <div class="chart-card">
              <h2>Doelgroep Distributie</h2>
              <div class="chart-wrapper">
                <BarChart 
                  v-if="targetAudienceChartData"
                  :data="targetAudienceChartData"
                  :options="barChartOptions"
                />
                <div v-else class="no-data">Geen data beschikbaar</div>
              </div>
            </div>
          </div>

          <!-- Tables -->
          <div class="tables-row">
            <div class="table-card">
              <h2>Output Formaten Gebruik</h2>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Formaat</th>
                    <th>Requests</th>
                    <th>Gem. Tokens</th>
                    <th>% van Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in promptAnalytics?.outputFormatUsage" :key="item.formatId">
                    <td><strong>{{ item.formatName }}</strong></td>
                    <td>{{ item.count }}</td>
                    <td>{{ formatNumber(item.avgTokens) }}</td>
                    <td>{{ formatPercentage(item.count, analytics.summary.totalRequests) }}%</td>
                  </tr>
                  <tr v-if="!promptAnalytics?.outputFormatUsage?.length">
                    <td colspan="4" class="no-data">Geen data beschikbaar</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="table-card">
              <h2>Meest Gebruikte Referenties</h2>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Referentie</th>
                    <th>Gebruik</th>
                    <th>% van Requests</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in promptAnalytics?.referenceUsage" :key="item.referenceId">
                    <td>{{ item.referenceTitle }}</td>
                    <td>{{ item.count }}</td>
                    <td>{{ formatPercentage(item.count, analytics.summary.totalRequests) }}%</td>
                  </tr>
                  <tr v-if="!promptAnalytics?.referenceUsage?.length">
                    <td colspan="3" class="no-data">Geen data beschikbaar</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Actionable Insights -->
          <div class="insights-section">
            <h2>💡 Actiepunten & Aanbevelingen</h2>
            <div class="insights-grid">
              <div v-if="hasLowResearchModeUsage" class="insight-card warning">
                <div class="insight-icon">⚠️</div>
                <div class="insight-content">
                  <h3>Research Mode Onderbenut</h3>
                  <p>Research Mode wordt slechts {{ researchModePercentage }}% van de tijd gebruikt. Overweeg gebruikers te informeren over de voordelen voor complexe teksten.</p>
                </div>
              </div>
              <div v-if="hasUnbalancedFormatUsage" class="insight-card info">
                <div class="insight-icon">📊</div>
                <div class="insight-content">
                  <h3>Ongebalanceerd Formaat Gebruik</h3>
                  <p>Eén output formaat wordt veel vaker gebruikt dan anderen. Overweeg gebruikers te informeren over alternatieve formaten.</p>
                </div>
              </div>
              <div v-if="hasHighTokenUsage" class="insight-card warning">
                <div class="insight-icon">💰</div>
                <div class="insight-content">
                  <h3>Hoge Token Gebruik</h3>
                  <p>Gemiddeld {{ formatNumber(Math.round(analytics.summary.avgTokens)) }} tokens per request. Overweeg prompt optimalisatie om kosten te verlagen.</p>
                </div>
              </div>
              <div v-if="hasLowReferenceUsage" class="insight-card info">
                <div class="insight-icon">📚</div>
                <div class="insight-content">
                  <h3>Referenties Onderbenut</h3>
                  <p>Referenties worden weinig gebruikt. Overweeg gebruikers te trainen over het belang van contextuele referenties.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Template Analytics Tab -->
        <div v-if="activeTab === 'templates'" class="tab-panel">
          <h2>Template Performance & Usage</h2>
          
          <!-- Template Usage Summary -->
          <div class="summary-cards">
            <div v-for="usage in templateUsageData" :key="usage.source" class="summary-card">
              <div class="card-icon">{{ usage.source === 'templates' ? '📝' : '⚙️' }}</div>
              <div class="card-content">
                <h3>{{ usage.source === 'templates' ? 'Template-Based' : 'Hardcoded' }}</h3>
                <p class="card-value">{{ usage.count }}</p>
                <p class="card-subtitle">Requests</p>
                <p class="card-subtitle">Avg Tokens: {{ formatNumber(usage.avgTokens) }}</p>
              </div>
            </div>
          </div>

          <!-- Template Usage Chart -->
          <div class="charts-row">
            <div class="chart-card">
              <h2>Template vs Hardcoded Usage</h2>
              <div class="chart-wrapper">
                <DoughnutChart 
                  v-if="templateUsageChartData"
                  :data="templateUsageChartData"
                  :options="doughnutChartOptions"
                />
                <div v-else class="no-data">Geen data beschikbaar</div>
              </div>
            </div>
            <div class="chart-card">
              <h2>Prompt Section Inclusion Rate</h2>
              <div class="chart-wrapper">
                <BarChart 
                  v-if="sectionUsageChartData"
                  :data="sectionUsageChartData"
                  :options="barChartOptions"
                />
                <div v-else class="no-data">Geen data beschikbaar</div>
              </div>
            </div>
          </div>

          <!-- Section Usage Table -->
          <div class="tables-row">
            <div class="table-card">
              <h2>Prompt Section Usage</h2>
              <table>
                <thead>
                  <tr>
                    <th>Section Type</th>
                    <th>Total Requests</th>
                    <th>Included</th>
                    <th>Inclusion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="section in sectionUsageData" :key="section.sectionType">
                    <td>{{ formatSectionType(section.sectionType) }}</td>
                    <td>{{ section.total }}</td>
                    <td>{{ section.included }}</td>
                    <td>
                      <span :class="section.inclusionRate >= 80 ? 'good' : section.inclusionRate >= 50 ? 'warning' : 'bad'">
                        {{ section.inclusionRate }}%
                      </span>
                    </td>
                  </tr>
                  <tr v-if="!sectionUsageData || sectionUsageData.length === 0">
                    <td colspan="4" class="no-data">Geen data beschikbaar</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- A/B Test Participation -->
          <div v-if="abTestParticipationData && abTestParticipationData.length > 0" class="tables-row">
            <div class="table-card">
              <h2>A/B Test Participation</h2>
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Template</th>
                    <th>Total Requests</th>
                    <th>Variant A</th>
                    <th>Variant B</th>
                    <th>Avg Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="test in abTestParticipationData" :key="test.testId">
                    <td>{{ test.testName }}</td>
                    <td>{{ test.templateName }}</td>
                    <td>{{ test.count }}</td>
                    <td>{{ test.variantA }}</td>
                    <td>{{ test.variantB }}</td>
                    <td>{{ formatNumber(test.avgTokens) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Template Version Performance -->
          <div v-if="templateVersionPerformanceData && templateVersionPerformanceData.length > 0" class="tables-row">
            <div class="table-card">
              <h2>Template Section Performance</h2>
              <table>
                <thead>
                  <tr>
                    <th>Section Type</th>
                    <th>Status</th>
                    <th>Requests</th>
                    <th>Avg Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="perf in templateVersionPerformanceData" :key="`${perf.sectionType}-${perf.included}`">
                    <td>{{ formatSectionType(perf.sectionType) }}</td>
                    <td>
                      <span :class="perf.included ? 'badge-active' : 'badge-inactive'">
                        {{ perf.included ? 'Included' : 'Excluded' }}
                      </span>
                    </td>
                    <td>{{ perf.count }}</td>
                    <td>{{ formatNumber(perf.avgTokens) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuth } from '../../composables/useAuth.js';
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

const { user, hasRole } = useAuth();

const loading = ref(false);
const error = ref(null);
const analytics = ref(null);
const startDate = ref('');
const endDate = ref('');
const activeTab = ref('overview');

// User role and LVL information
const isAdmin = computed(() => hasRole('ADMIN'));
const isSuperAdmin = computed(() => hasRole('SUPER_ADMIN'));
const userLvls = computed(() => {
  if (!user.value || !user.value.lvls || !Array.isArray(user.value.lvls)) return [];
  // Handle both object format (from login) and ID format
  return user.value.lvls.map(lvl => {
    if (typeof lvl === 'object' && lvl !== null) {
      return {
        id: lvl.id || lvl._id,
        name: lvl.name || 'Unknown',
        code: lvl.code || '',
      };
    }
    return { id: lvl, name: 'Unknown', code: '' };
  });
});

const tabs = computed(() => [
  { id: 'overview', label: 'Overzicht', icon: '📊' },
  { 
    id: 'prompts', 
    label: 'Prompt Analytics', 
    icon: '🔍',
    badge: analytics.value?.promptAnalytics ? 'Nieuw' : null
  },
  { 
    id: 'templates', 
    label: 'Template Analytics', 
    icon: '📝',
    badge: analytics.value?.promptAnalytics?.templateUsage ? 'Nieuw' : null
  },
]);

// Computed properties for prompt analytics
const promptAnalytics = computed(() => analytics.value?.promptAnalytics);
const researchModeStats = computed(() => promptAnalytics.value?.researchModeStats);
const totalResearchRequests = computed(() => 
  (researchModeStats.value?.enabled || 0) + (researchModeStats.value?.disabled || 0)
);
const researchModePercentage = computed(() => {
  if (!totalResearchRequests.value) return 0;
  return Math.round((researchModeStats.value?.enabled || 0) / totalResearchRequests.value * 100);
});

// Chart data for prompt analytics
const outputFormatChartData = computed(() => {
  if (!promptAnalytics.value?.outputFormatUsage?.length) return null;
  const colors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
  ];
  return {
    labels: promptAnalytics.value.outputFormatUsage.map(item => item.formatName),
    datasets: [{
      data: promptAnalytics.value.outputFormatUsage.map(item => item.count),
      backgroundColor: promptAnalytics.value.outputFormatUsage.map((_, index) => 
        colors[index % colors.length]
      ),
    }],
  };
});

const tokenUsageByFormatChartData = computed(() => {
  if (!promptAnalytics.value?.tokenUsageByFormat?.length) return null;
  return {
    labels: promptAnalytics.value.tokenUsageByFormat.map(item => item.formatName),
    datasets: [{
      label: 'Gemiddeld Tokens',
      data: promptAnalytics.value.tokenUsageByFormat.map(item => item.avgTokens),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    }],
  };
});

const researchModeChartData = computed(() => {
  if (!researchModeStats.value) return null;
  return {
    labels: ['Research Mode Aan', 'Research Mode Uit'],
    datasets: [{
      data: [researchModeStats.value.enabled, researchModeStats.value.disabled],
      backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(156, 163, 175, 0.8)'],
    }],
  };
});

const targetAudienceChartData = computed(() => {
  if (!promptAnalytics.value?.targetAudienceUsage?.length) return null;
  return {
    labels: promptAnalytics.value.targetAudienceUsage.map(item => item.audienceName),
    datasets: [{
      label: 'Gebruik',
      data: promptAnalytics.value.targetAudienceUsage.map(item => item.count),
      backgroundColor: 'rgba(139, 92, 246, 0.8)',
    }],
  };
});

// Template Analytics computed properties
const templateUsageData = computed(() => {
  if (!promptAnalytics.value?.templateUsage?.length) return [];
  return promptAnalytics.value.templateUsage;
});

const templateUsageChartData = computed(() => {
  if (!templateUsageData.value.length) return null;
  return {
    labels: templateUsageData.value.map(item => 
      item.source === 'templates' ? 'Template-Based' : 'Hardcoded'
    ),
    datasets: [{
      data: templateUsageData.value.map(item => item.count),
      backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(156, 163, 175, 0.8)'],
    }],
  };
});

const sectionUsageData = computed(() => {
  if (!promptAnalytics.value?.sectionUsage?.length) return [];
  return promptAnalytics.value.sectionUsage;
});

const sectionUsageChartData = computed(() => {
  if (!sectionUsageData.value.length) return null;
  return {
    labels: sectionUsageData.value.map(item => formatSectionType(item.sectionType)),
    datasets: [{
      label: 'Inclusion Rate (%)',
      data: sectionUsageData.value.map(item => item.inclusionRate),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    }],
  };
});

const abTestParticipationData = computed(() => {
  if (!promptAnalytics.value?.abTestParticipation?.length) return [];
  return promptAnalytics.value.abTestParticipation;
});

const templateVersionPerformanceData = computed(() => {
  if (!promptAnalytics.value?.templateVersionPerformance?.length) return [];
  return promptAnalytics.value.templateVersionPerformance;
});

function formatSectionType(type) {
  const typeMap = {
    'role': 'Role Definition',
    'lvlContext': 'LVL Context',
    'place': 'Place Context',
    'targetAudience': 'Target Audience',
    'outputFormat': 'Output Format',
    'geoContext': 'Geographic Context',
    'projectContext': 'Project Context',
    'includeKeywords': 'Include Keywords',
    'avoidKeywords': 'Avoid Keywords',
    'references': 'References',
    'dictionary': 'Dictionary',
    'baseInstructions': 'Base Instructions',
    'outputStructure': 'Output Structure',
    'content': 'Content',
    'imageSuggestion': 'Image Suggestion',
  };
  return typeMap[type] || type;
}

// Insights computed properties
const hasLowResearchModeUsage = computed(() => researchModePercentage.value < 10 && totalResearchRequests.value > 10);
const hasUnbalancedFormatUsage = computed(() => {
  if (!promptAnalytics.value?.outputFormatUsage?.length) return false;
  const counts = promptAnalytics.value.outputFormatUsage.map(item => item.count);
  const max = Math.max(...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  return max / total > 0.7; // One format used >70% of the time
});
const hasHighTokenUsage = computed(() => analytics.value?.summary?.avgTokens > 2000);
const hasLowReferenceUsage = computed(() => {
  if (!analytics.value?.summary?.totalRequests) return false;
  const totalRefUsage = promptAnalytics.value?.referenceUsage?.reduce((sum, item) => sum + item.count, 0) || 0;
  return totalRefUsage / analytics.value.summary.totalRequests < 0.2; // <20% of requests use references
});

// Chart options
const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 },
    },
  },
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 },
    },
  },
};

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right' },
  },
};

// Chart data computed properties (existing)
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

function formatPercentage(value, total) {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100);
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

.filter-indicator {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4) var(--spacing-5);
  margin-bottom: var(--spacing-6);
  backdrop-filter: blur(10px);
  transition: all var(--transition-base);
}

.filter-indicator:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.filter-indicator-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
}

.filter-indicator-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-indicator-icon svg {
  width: 100%;
  height: 100%;
}

.filter-indicator-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.filter-indicator-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  letter-spacing: 0.01em;
}

.filter-lvl-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  align-items: center;
}

.lvl-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
  transition: all var(--transition-base);
}

.lvl-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.lvl-code {
  opacity: 0.85;
  font-weight: var(--font-weight-normal);
  font-size: 0.9em;
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

/* Tabs */
.tabs-container {
  margin-bottom: var(--spacing-6);
  border-bottom: 2px solid var(--color-border);
}

.tabs {
  display: flex;
  gap: var(--spacing-2);
  overflow-x: auto;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-6);
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
  position: relative;
}

.tab-button:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.tab-icon {
  font-size: var(--font-size-lg);
}

.tab-badge {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.tab-content {
  margin-top: var(--spacing-6);
}

.tab-panel {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  transition: all var(--transition-base);
}

.summary-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.summary-card.highlight {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, var(--color-bg-primary) 0%, rgba(59, 130, 246, 0.05) 100%);
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

.chart-insights {
  margin-top: var(--spacing-4);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.insight-item {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.insight-item.highlight {
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.insight-label {
  color: var(--color-text-secondary);
}

.insight-value {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
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

.insights-header {
  margin-bottom: var(--spacing-6);
}

.insights-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-2) 0;
}

.insights-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin: 0;
}

.insights-section {
  margin-top: var(--spacing-8);
  padding-top: var(--spacing-8);
  border-top: 2px solid var(--color-border);
}

.insights-section h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-6) 0;
}

/* Template Analytics Styles */
.badge-active {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  background: #e8f5e9;
  color: #388e3c;
}

.badge-inactive {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  background: #ffebee;
  color: #d32f2f;
}

.good {
  color: #388e3c;
  font-weight: 600;
}

.warning {
  color: #f57c00;
  font-weight: 600;
}

.bad {
  color: #d32f2f;
  font-weight: 600;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-4);
}

.insight-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  display: flex;
  gap: var(--spacing-4);
  transition: all var(--transition-base);
}

.insight-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.insight-card.warning {
  border-left: 4px solid var(--color-warning);
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, var(--color-bg-primary) 100%);
}

.insight-card.info {
  border-left: 4px solid var(--color-primary);
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.05) 0%, var(--color-bg-primary) 100%);
}

.insight-icon {
  font-size: var(--font-size-2xl);
  flex-shrink: 0;
}

.insight-content h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-2) 0;
}

.insight-content p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-relaxed);
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
  .filter-indicator-content {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-3);
  }

  .filter-indicator-icon {
    align-self: flex-start;
  }
  .charts-row {
    grid-template-columns: 1fr;
  }
  
  .insights-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .filter-indicator {
    padding: var(--spacing-3) var(--spacing-4);
  }

  .filter-indicator-label {
    font-size: var(--font-size-xs);
  }

  .lvl-badge {
    font-size: 0.7rem;
    padding: var(--spacing-1) var(--spacing-2);
  }
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
  
  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
