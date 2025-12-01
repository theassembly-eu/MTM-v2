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
      <div class="filter-group">
        <label for="status-filter">Goedkeuringsstatus</label>
        <select id="status-filter" v-model="selectedStatus" @change="fetchRequestLogs">
          <option value="">Alle statussen</option>
          <option value="DRAFT">Concept</option>
          <option value="CANDIDATE">Kandidaat</option>
          <option value="VERIFIED">Geverifieerd</option>
          <option value="APPROVED">Goedgekeurd</option>
          <option value="REJECTED">Afgewezen</option>
        </select>
      </div>
    </div>

    <LoadingSpinner v-if="loading" message="Geschiedenis laden..." />
    <div v-if="error" class="error">{{ error }}</div>
    
    <EmptyState
      v-if="requestLogs.length === 0 && !loading"
      icon="📜"
      title="Geen geschiedenis gevonden"
      description="Er zijn nog geen vereenvoudigde teksten. Begin met het vereenvoudigen van je eerste tekst!"
    />

    <div v-else>
      <div class="pagination-info">
        Pagina {{ pagination.page }} van {{ pagination.totalPages }} 
        ({{ pagination.total }} totaal)
      </div>

      <ul class="results-list">
        <li v-for="log in requestLogs" :key="log.id" class="result-item">
          <div class="result-header">
            <div class="result-header-top">
              <div class="result-meta">
                <strong>Team:</strong> {{ log.team?.name || 'Onbekend' }} | 
                <strong>Project:</strong> {{ log.project?.name || 'Onbekend' }} | 
                <strong>LVL:</strong> {{ log.lvl?.name || 'Onbekend' }}
              </div>
              <span :class="['status-badge', `status-${log.approvalStatus?.toLowerCase() || 'draft'}`]">
                {{ getStatusLabel(log.approvalStatus) }}
              </span>
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

            <!-- Approval Workflow Timeline -->
            <div v-if="log.approvalMeta" class="approval-timeline">
              <h4>Goedkeuringsproces</h4>
              <div class="timeline-item" v-if="log.approvalMeta.taggedAsCandidate">
                <span class="timeline-icon">🏷️</span>
                <div class="timeline-content">
                  <strong>Gemarkeerd als kandidaat</strong>
                  <span class="timeline-meta">
                    door {{ log.approvalMeta.taggedAsCandidate.by?.email || 'Onbekend' }}
                    op {{ formatDate(log.approvalMeta.taggedAsCandidate.at) }}
                  </span>
                </div>
              </div>
              <div class="timeline-item" v-if="log.approvalMeta.verified">
                <span class="timeline-icon">✓</span>
                <div class="timeline-content">
                  <strong>Geverifieerd</strong>
                  <span class="timeline-meta">
                    door {{ log.approvalMeta.verified.by?.email || 'Onbekend' }}
                    op {{ formatDate(log.approvalMeta.verified.at) }}
                  </span>
                  <p v-if="log.approvalMeta.verified.notes" class="timeline-notes">
                    {{ log.approvalMeta.verified.notes }}
                  </p>
                </div>
              </div>
              <div class="timeline-item" v-if="log.approvalMeta.approved">
                <span class="timeline-icon">✅</span>
                <div class="timeline-content">
                  <strong>Goedgekeurd</strong>
                  <span class="timeline-meta">
                    door {{ log.approvalMeta.approved.by?.email || 'Onbekend' }}
                    op {{ formatDate(log.approvalMeta.approved.at) }}
                  </span>
                  <p v-if="log.approvalMeta.approved.notes" class="timeline-notes">
                    {{ log.approvalMeta.approved.notes }}
                  </p>
                </div>
              </div>
              <div class="timeline-item rejected" v-if="log.approvalMeta.rejected">
                <span class="timeline-icon">❌</span>
                <div class="timeline-content">
                  <strong>Afgewezen</strong>
                  <span class="timeline-meta">
                    door {{ log.approvalMeta.rejected.by?.email || 'Onbekend' }}
                    op {{ formatDate(log.approvalMeta.rejected.at) }}
                  </span>
                  <p class="timeline-notes">
                    <strong>Reden:</strong> {{ log.approvalMeta.rejected.reason }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Comments Section -->
            <div v-if="log.comments && log.comments.length > 0" class="comments-section">
              <h4>Opmerkingen ({{ log.comments.length }})</h4>
              <div v-for="comment in log.comments" :key="comment._id || comment.id" class="comment-item">
                <div class="comment-header">
                  <strong>{{ comment.user?.email || 'Onbekend' }}</strong>
                  <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
                  <span v-if="comment.edited" class="comment-edited">(bewerkt)</span>
                </div>
                <p class="comment-text">{{ comment.text }}</p>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
              <button
                v-if="log.approvalStatus === 'DRAFT' && canTagCandidate"
                @click="tagAsCandidate(log.id)"
                class="btn-action btn-candidate"
                :disabled="actionLoading === log.id"
              >
                🏷️ Markeer als kandidaat
              </button>
              <button
                v-if="log.approvalStatus === 'CANDIDATE' && canVerify"
                @click="showVerifyModal(log)"
                class="btn-action btn-verify"
                :disabled="actionLoading === log.id"
              >
                ✓ Verifieer
              </button>
              <button
                v-if="log.approvalStatus === 'VERIFIED' && canApprove"
                @click="showApproveModal(log)"
                class="btn-action btn-approve"
                :disabled="actionLoading === log.id"
              >
                ✅ Keur goed
              </button>
              <button
                v-if="(log.approvalStatus === 'CANDIDATE' || log.approvalStatus === 'VERIFIED') && canReject"
                @click="showRejectModal(log)"
                class="btn-action btn-reject"
                :disabled="actionLoading === log.id"
              >
                ❌ Wijzen af
              </button>
              <button
                @click="showCommentModal(log)"
                class="btn-action btn-comment"
              >
                💬 Opmerking toevoegen
              </button>
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

    <!-- Verify Modal -->
    <div v-if="showVerify" class="modal-overlay" @click="showVerify = false">
      <div class="modal" @click.stop>
        <h3>Tekst Verifiëren</h3>
        <p>Controleer de tekst op nauwkeurigheid en AI-hallucinaties.</p>
        <textarea
          v-model="verifyNotes"
          placeholder="Optionele notities bij verificatie..."
          rows="4"
          class="modal-textarea"
        ></textarea>
        <div class="modal-actions">
          <button @click="showVerify = false" class="btn-secondary">Annuleren</button>
          <button @click="verifyText" class="btn-primary" :disabled="actionLoading">
            Verifieer
          </button>
        </div>
      </div>
    </div>

    <!-- Approve Modal -->
    <div v-if="showApprove" class="modal-overlay" @click="showApprove = false">
      <div class="modal" @click.stop>
        <h3>Tekst Goedkeuren</h3>
        <p>Deze tekst zal worden opgeslagen in de goedgekeurde bibliotheek van het project.</p>
        <textarea
          v-model="approveNotes"
          placeholder="Optionele notities bij goedkeuring..."
          rows="4"
          class="modal-textarea"
        ></textarea>
        <div class="modal-actions">
          <button @click="showApprove = false" class="btn-secondary">Annuleren</button>
          <button @click="approveText" class="btn-primary" :disabled="actionLoading">
            Keur goed
          </button>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div v-if="showReject" class="modal-overlay" @click="showReject = false">
      <div class="modal" @click.stop>
        <h3>Tekst Afwijzen</h3>
        <p>Geef een reden op voor de afwijzing.</p>
        <textarea
          v-model="rejectReason"
          placeholder="Reden voor afwijzing (verplicht)..."
          rows="4"
          class="modal-textarea"
          required
        ></textarea>
        <div class="modal-actions">
          <button @click="showReject = false" class="btn-secondary">Annuleren</button>
          <button @click="rejectText" class="btn-danger" :disabled="!rejectReason.trim() || actionLoading">
            Wijzen af
          </button>
        </div>
      </div>
    </div>

    <!-- Comment Modal -->
    <div v-if="showComment" class="modal-overlay" @click="showComment = false">
      <div class="modal" @click.stop>
        <h3>Opmerking Toevoegen</h3>
        <textarea
          v-model="commentText"
          placeholder="Voeg een opmerking toe..."
          rows="6"
          class="modal-textarea"
        ></textarea>
        <div class="modal-actions">
          <button @click="showComment = false" class="btn-secondary">Annuleren</button>
          <button @click="addComment" class="btn-primary" :disabled="!commentText.trim() || actionLoading">
            Toevoegen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import axios from 'axios';
import { useAuth } from '../composables/useAuth.js';
import { useToast } from '../composables/useToast.js';
import EmptyState from './common/EmptyState.vue';
import LoadingSpinner from './common/LoadingSpinner.vue';

const { user, hasRole } = useAuth();
const { success, error: showError } = useToast();

const requestLogs = ref([]);
const loading = ref(true);
const error = ref(null);
const searchQuery = ref('');
const selectedProjectId = ref('');
const selectedTeamId = ref('');
const selectedStatus = ref('');
const projects = ref([]);
const teams = ref([]);
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

// Modal states
const showVerify = ref(false);
const showApprove = ref(false);
const showReject = ref(false);
const showComment = ref(false);
const verifyNotes = ref('');
const approveNotes = ref('');
const rejectReason = ref('');
const commentText = ref('');
const currentLogId = ref(null);
const actionLoading = ref(null);

// Permission checks
const canTagCandidate = computed(() => true); // All authenticated users
const canVerify = computed(() => hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));
const canApprove = computed(() => hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));
const canReject = computed(() => hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));

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

    if (selectedStatus.value) {
      params.approvalStatus = selectedStatus.value;
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
      approvalStatus: log.approvalStatus,
      approvalMeta: log.approvalMeta,
      comments: log.comments || [],
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

function getStatusLabel(status) {
  const labels = {
    DRAFT: 'Concept',
    CANDIDATE: 'Kandidaat',
    VERIFIED: 'Geverifieerd',
    APPROVED: 'Goedgekeurd',
    REJECTED: 'Afgewezen',
  };
  return labels[status] || status;
}

async function tagAsCandidate(logId) {
  actionLoading.value = logId;
  try {
    await axios.put(`/api/request-logs/${logId}/tag-candidate`);
    await fetchRequestLogs();
    success('Tekst gemarkeerd als kandidaat');
  } catch (err) {
    console.error('Error tagging as candidate:', err);
    showError(err.response?.data?.error || 'Fout bij markeren als kandidaat');
  } finally {
    actionLoading.value = null;
  }
}

function showVerifyModal(log) {
  currentLogId.value = log.id;
  verifyNotes.value = '';
  showVerify.value = true;
}

async function verifyText() {
  if (!currentLogId.value) return;
  actionLoading.value = currentLogId.value;
  try {
    await axios.put(`/api/request-logs/${currentLogId.value}/verify`, {
      notes: verifyNotes.value,
    });
    showVerify.value = false;
    verifyNotes.value = '';
    await fetchRequestLogs();
    success('Tekst succesvol geverifieerd');
  } catch (err) {
    console.error('Error verifying:', err);
    showError(err.response?.data?.error || 'Fout bij verifiëren');
  } finally {
    actionLoading.value = null;
  }
}

function showApproveModal(log) {
  currentLogId.value = log.id;
  approveNotes.value = '';
  showApprove.value = true;
}

async function approveText() {
  if (!currentLogId.value) return;
  actionLoading.value = currentLogId.value;
  try {
    await axios.put(`/api/request-logs/${currentLogId.value}/approve`, {
      notes: approveNotes.value,
    });
    showApprove.value = false;
    approveNotes.value = '';
    await fetchRequestLogs();
    success('Tekst succesvol goedgekeurd en opgeslagen in projectbibliotheek!');
  } catch (err) {
    console.error('Error approving:', err);
    showError(err.response?.data?.error || 'Fout bij goedkeuren');
  } finally {
    actionLoading.value = null;
  }
}

function showRejectModal(log) {
  currentLogId.value = log.id;
  rejectReason.value = '';
  showReject.value = true;
}

async function rejectText() {
  if (!currentLogId.value || !rejectReason.value.trim()) return;
  actionLoading.value = currentLogId.value;
  try {
    await axios.put(`/api/request-logs/${currentLogId.value}/reject`, {
      reason: rejectReason.value,
    });
    showReject.value = false;
    rejectReason.value = '';
    await fetchRequestLogs();
    success('Tekst succesvol afgewezen');
  } catch (err) {
    console.error('Error rejecting:', err);
    showError(err.response?.data?.error || 'Fout bij afwijzen');
  } finally {
    actionLoading.value = null;
  }
}

function showCommentModal(log) {
  currentLogId.value = log.id;
  commentText.value = '';
  showComment.value = true;
}

async function addComment() {
  if (!currentLogId.value || !commentText.value.trim()) return;
  actionLoading.value = currentLogId.value;
  try {
    await axios.post(`/api/request-logs/${currentLogId.value}/comments`, {
      text: commentText.value,
    });
    showComment.value = false;
    commentText.value = '';
    await fetchRequestLogs();
    success('Opmerking toegevoegd');
  } catch (err) {
    console.error('Error adding comment:', err);
    showError(err.response?.data?.error || 'Fout bij toevoegen opmerking');
  } finally {
    actionLoading.value = null;
  }
}

onMounted(async () => {
  await Promise.all([fetchTeams(), fetchProjects()]);
  await fetchRequestLogs();
});

watch(selectedProjectId, () => {
  pagination.value.page = 1;
  fetchRequestLogs();
});

watch(selectedStatus, () => {
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

.result-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-4);
  flex-wrap: wrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid transparent;
  transition: all var(--transition-base);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.status-draft {
  background: linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%);
  color: #4B5563;
  border-color: #D1D5DB;
}

.status-candidate {
  background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
  color: #1E40AF;
  border-color: #93C5FD;
}

.status-verified {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  color: #92400E;
  border-color: #FCD34D;
}

.status-approved {
  background: linear-gradient(135deg, #A7F3D0 0%, #6EE7B7 100%);
  color: #064E3B;
  border-color: #34D399;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.status-rejected {
  background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
  color: #991B1B;
  border-color: #FCA5A5;
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

.approval-timeline {
  margin: var(--spacing-6) 0;
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.approval-timeline h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

.timeline-item {
  display: flex;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.timeline-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.timeline-item.rejected {
  border-left: 3px solid var(--color-error);
  padding-left: var(--spacing-3);
}

.timeline-icon {
  font-size: var(--font-size-lg);
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.timeline-content {
  flex: 1;
}

.timeline-content strong {
  display: block;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-1);
}

.timeline-meta {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-2);
}

.timeline-notes {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--spacing-2) 0 0 0;
  font-style: italic;
}

.comments-section {
  margin: var(--spacing-6) 0;
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.comments-section h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-4) 0;
}

.comment-item {
  margin-bottom: var(--spacing-4);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.comment-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-2);
}

.comment-header strong {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.comment-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.comment-edited {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-style: italic;
}

.comment-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  white-space: pre-wrap;
  line-height: var(--line-height-relaxed);
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  margin-top: var(--spacing-6);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border);
}

.btn-action {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}

.btn-action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-candidate {
  background: #DBEAFE;
  color: #1E40AF;
  border-color: #93C5FD;
}

.btn-verify {
  background: #FEF3C7;
  color: #92400E;
  border-color: #FDE68A;
}

.btn-approve {
  background: #D1FAE5;
  color: #065F46;
  border-color: #6EE7B7;
}

.btn-reject {
  background: #FEE2E2;
  color: #991B1B;
  border-color: #FCA5A5;
}

.btn-comment {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--spacing-4);
}

.modal {
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-8);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--color-border);
}

.modal h3 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-top: 0;
  margin-bottom: var(--spacing-4);
}

.modal p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-4);
}

.modal-textarea {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-family: inherit;
  resize: vertical;
  margin-bottom: var(--spacing-6);
}

.modal-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
}

.btn-secondary {
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-text-tertiary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-secondary:hover {
  background: #4B5563;
}

.btn-primary {
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-error);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-danger:hover:not(:disabled) {
  background: #DC2626;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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