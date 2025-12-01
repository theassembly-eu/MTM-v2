<template>
  <div class="approval-queue-page">
    <div class="page-header">
      <h1>Goedkeuringsproces</h1>
      <p class="page-subtitle">Beheer en volg het goedkeuringsproces van vereenvoudigde teksten</p>
    </div>

    <!-- Project Filter -->
    <div class="filter-bar">
      <div class="filter-group">
        <label for="project-filter">Project</label>
        <select 
          id="project-filter" 
          v-model="selectedProjectId" 
          @change="fetchQueue"
          class="project-select"
        >
          <option value="">Alle projecten</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>
      <div class="queue-stats">
        <span class="stat-item">
          <strong>{{ itemsByStatus.DRAFT?.length || 0 }}</strong> Concept
        </span>
        <span class="stat-item">
          <strong>{{ itemsByStatus.CANDIDATE?.length || 0 }}</strong> Kandidaat
        </span>
        <span class="stat-item">
          <strong>{{ itemsByStatus.VERIFIED?.length || 0 }}</strong> Geverifieerd
        </span>
        <span class="stat-item">
          <strong>{{ itemsByStatus.APPROVED?.length || 0 }}</strong> Goedgekeurd
        </span>
        <span class="stat-item">
          <strong>{{ itemsByStatus.REJECTED?.length || 0 }}</strong> Afgewezen
        </span>
      </div>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Kanban Board -->
    <div v-if="!loading && !error" class="kanban-board">
      <!-- DRAFT Column -->
      <div class="kanban-column" :class="`column-${status.toLowerCase()}`" v-for="status in statuses" :key="status">
        <div class="column-header">
          <h3 class="column-title">{{ getStatusLabel(status) }}</h3>
          <span class="column-count">{{ itemsByStatus[status]?.length || 0 }}</span>
        </div>
        <div class="column-content">
          <div
            v-for="item in itemsByStatus[status]"
            :key="item.id"
            class="kanban-card"
            @click="viewDetails(item)"
          >
            <div class="card-header">
              <div class="card-project">{{ item.project?.name || 'Onbekend' }}</div>
              <div class="card-meta">
                <span class="card-lvl">{{ item.lvl?.name || 'N/A' }}</span>
                <span class="card-date">{{ formatDateShort(item.createdAt) }}</span>
              </div>
            </div>
            <div class="card-body">
              <div class="card-text-preview">
                <strong>Origineel:</strong>
                <p>{{ truncateText(item.originalText, 100) }}</p>
              </div>
              <div class="card-text-preview">
                <strong>Vereenvoudigd:</strong>
                <p>{{ truncateText(item.simplifiedText, 100) }}</p>
              </div>
            </div>
            <div class="card-footer">
              <div class="card-user">{{ item.user?.email || 'Onbekend' }}</div>
              <div class="card-actions">
                <button
                  v-if="item.approvalStatus === 'DRAFT' && canTagCandidate"
                  @click.stop="tagAsCandidate(item)"
                  class="btn-card-action"
                  title="Markeer als kandidaat"
                >
                  🏷️
                </button>
                <button
                  v-if="item.approvalStatus === 'CANDIDATE' && canVerify"
                  @click.stop="showVerifyModal(item)"
                  class="btn-card-action"
                  title="Verifieer"
                >
                  ✓
                </button>
                <button
                  v-if="item.approvalStatus === 'VERIFIED' && canApprove"
                  @click.stop="showApproveModal(item)"
                  class="btn-card-action"
                  title="Keur goed"
                >
                  ✅
                </button>
                <button
                  v-if="(item.approvalStatus === 'CANDIDATE' || item.approvalStatus === 'VERIFIED') && canReject"
                  @click.stop="showRejectModal(item)"
                  class="btn-card-action btn-reject"
                  title="Wijs af"
                >
                  ✕
                </button>
              </div>
            </div>
            <div v-if="item.comments && item.comments.length > 0" class="card-comments-indicator">
              💬 {{ item.comments.length }}
            </div>
          </div>
          <div v-if="!itemsByStatus[status] || itemsByStatus[status].length === 0" class="column-empty">
            Geen items
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click="showDetailModal = false">
      <div class="modal detail-modal" @click.stop>
        <div class="modal-header">
          <h3>Tekst Details</h3>
          <button @click="showDetailModal = false" class="btn-close">×</button>
        </div>
        <div v-if="selectedItem" class="detail-content">
          <!-- Metadata -->
          <div class="detail-meta-grid">
            <div class="meta-item">
              <strong>Project:</strong> {{ selectedItem.project?.name || 'Onbekend' }}
            </div>
            <div class="meta-item">
              <strong>Team:</strong> {{ selectedItem.team?.name || 'Onbekend' }}
            </div>
            <div class="meta-item">
              <strong>LVL:</strong> {{ selectedItem.lvl?.name || 'Onbekend' }}
            </div>
            <div class="meta-item">
              <strong>Gebruiker:</strong> {{ selectedItem.user?.email || 'Onbekend' }}
            </div>
            <div class="meta-item">
              <strong>Datum:</strong> {{ formatDate(selectedItem.createdAt) }}
            </div>
            <div class="meta-item">
              <strong>Status:</strong>
              <span :class="['status-badge', `status-${selectedItem.approvalStatus?.toLowerCase() || 'draft'}`]">
                {{ getStatusLabel(selectedItem.approvalStatus) }}
              </span>
            </div>
          </div>

          <!-- Original Text -->
          <div class="detail-section">
            <h4>Originele Tekst</h4>
            <div class="detail-text">{{ selectedItem.originalText }}</div>
          </div>

          <!-- Simplified Text -->
          <div class="detail-section">
            <h4>Vereenvoudigde Tekst</h4>
            <div class="detail-text">{{ selectedItem.simplifiedText }}</div>
          </div>

          <!-- Approval Timeline -->
          <div v-if="selectedItem.approvalMeta" class="detail-section">
            <h4>Goedkeuringsproces</h4>
            <div class="timeline">
              <div v-if="selectedItem.approvalMeta.taggedAsCandidate" class="timeline-item">
                <div class="timeline-icon">🏷️</div>
                <div class="timeline-content">
                  <strong>Gemarkeerd als kandidaat</strong>
                  <p class="timeline-meta">
                    door {{ selectedItem.approvalMeta.taggedAsCandidate.by?.email || 'Onbekend' }}
                    op {{ formatDate(selectedItem.approvalMeta.taggedAsCandidate.at) }}
                  </p>
                </div>
              </div>
              <div v-if="selectedItem.approvalMeta.verified" class="timeline-item">
                <div class="timeline-icon">✓</div>
                <div class="timeline-content">
                  <strong>Geverifieerd</strong>
                  <p class="timeline-meta">
                    door {{ selectedItem.approvalMeta.verified.by?.email || 'Onbekend' }}
                    op {{ formatDate(selectedItem.approvalMeta.verified.at) }}
                  </p>
                  <p v-if="selectedItem.approvalMeta.verified.notes" class="timeline-notes">
                    {{ selectedItem.approvalMeta.verified.notes }}
                  </p>
                </div>
              </div>
              <div v-if="selectedItem.approvalMeta.approved" class="timeline-item">
                <div class="timeline-icon">✅</div>
                <div class="timeline-content">
                  <strong>Goedgekeurd</strong>
                  <p class="timeline-meta">
                    door {{ selectedItem.approvalMeta.approved.by?.email || 'Onbekend' }}
                    op {{ formatDate(selectedItem.approvalMeta.approved.at) }}
                  </p>
                  <p v-if="selectedItem.approvalMeta.approved.notes" class="timeline-notes">
                    {{ selectedItem.approvalMeta.approved.notes }}
                  </p>
                </div>
              </div>
              <div v-if="selectedItem.approvalMeta.rejected" class="timeline-item rejected">
                <div class="timeline-icon">✕</div>
                <div class="timeline-content">
                  <strong>Afgewezen</strong>
                  <p class="timeline-meta">
                    door {{ selectedItem.approvalMeta.rejected.by?.email || 'Onbekend' }}
                    op {{ formatDate(selectedItem.approvalMeta.rejected.at) }}
                  </p>
                  <p v-if="selectedItem.approvalMeta.rejected.reason" class="timeline-notes">
                    <strong>Reden:</strong> {{ selectedItem.approvalMeta.rejected.reason }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Comments -->
          <div class="detail-section">
            <h4>Opmerkingen ({{ selectedItem.comments?.length || 0 }})</h4>
            <div v-if="!selectedItem.comments || selectedItem.comments.length === 0" class="no-comments">
              Geen opmerkingen
            </div>
            <div v-else class="comments-list">
              <div v-for="comment in selectedItem.comments" :key="comment._id || comment.id" class="comment-item">
                <div class="comment-header">
                  <strong>{{ comment.user?.email || 'Onbekend' }}</strong>
                  <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
                </div>
                <p class="comment-text">{{ comment.text }}</p>
              </div>
            </div>
            <div class="add-comment-section">
              <textarea
                v-model="newCommentText"
                placeholder="Voeg een opmerking toe..."
                rows="3"
                class="comment-input"
              ></textarea>
              <button @click="addComment" class="btn-add-comment" :disabled="!newCommentText.trim()">
                Opmerking toevoegen
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <button
              v-if="selectedItem.approvalStatus === 'DRAFT' && canTagCandidate"
              @click="tagAsCandidate(selectedItem)"
              class="btn-primary"
            >
              🏷️ Markeer als kandidaat
            </button>
            <button
              v-if="selectedItem.approvalStatus === 'CANDIDATE' && canVerify"
              @click="showVerifyModal(selectedItem)"
              class="btn-verify"
            >
              ✓ Verifieer
            </button>
            <button
              v-if="selectedItem.approvalStatus === 'VERIFIED' && canApprove"
              @click="showApproveModal(selectedItem)"
              class="btn-approve"
            >
              ✅ Keur goed
            </button>
            <button
              v-if="(selectedItem.approvalStatus === 'CANDIDATE' || selectedItem.approvalStatus === 'VERIFIED') && canReject"
              @click="showRejectModal(selectedItem)"
              class="btn-reject"
            >
              ✕ Wijs af
            </button>
            <button @click="showDetailModal = false" class="btn-secondary">Sluiten</button>
          </div>
        </div>
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
          <button @click="rejectText" class="btn-reject" :disabled="actionLoading || !rejectReason.trim()">
            Wijs af
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuth } from '../../composables/useAuth.js';
import { useToast } from '../../composables/useToast.js';

const { hasRole } = useAuth();
const { success, error: showError } = useToast();

const loading = ref(false);
const error = ref(null);
const queueItems = ref([]);
const projects = ref([]);
const selectedProjectId = ref('');

// Modal states
const showVerify = ref(false);
const showApprove = ref(false);
const showReject = ref(false);
const showDetailModal = ref(false);
const verifyNotes = ref('');
const approveNotes = ref('');
const rejectReason = ref('');
const newCommentText = ref('');
const currentItemId = ref(null);
const selectedItem = ref(null);
const actionLoading = ref(false);

// Status order for Kanban columns
const statuses = ['DRAFT', 'CANDIDATE', 'VERIFIED', 'APPROVED', 'REJECTED'];

// Permission checks
const canTagCandidate = computed(() => hasRole('TEAM_MEMBER') || hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));
const canVerify = computed(() => hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));
const canApprove = computed(() => hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));
const canReject = computed(() => hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));

// Group items by status
const itemsByStatus = computed(() => {
  const grouped = {};
  statuses.forEach(status => {
    grouped[status] = queueItems.value.filter(item => item.approvalStatus === status);
  });
  return grouped;
});

async function fetchProjects() {
  try {
    const response = await axios.get('/api/projects');
    projects.value = response.data.map(p => ({
      id: p._id || p.id,
      name: p.name,
    }));
  } catch (err) {
    console.error('Error fetching projects:', err);
  }
}

async function fetchQueue() {
  loading.value = true;
  error.value = null;
  try {
    const params = {};
    if (selectedProjectId.value) {
      params.projectId = selectedProjectId.value;
    }
    const response = await axios.get('/api/request-logs/approval-queue', { params });
    queueItems.value = response.data.data.map(item => ({
      id: item._id || item.id,
      user: item.user,
      team: item.team,
      project: item.project,
      lvl: item.lvl,
      originalText: item.originalText,
      simplifiedText: item.simplifiedText,
      approvalStatus: item.approvalStatus,
      approvalMeta: item.approvalMeta,
      comments: item.comments || [],
      createdAt: item.createdAt,
    }));
  } catch (err) {
    console.error('Error fetching approval queue:', err);
    error.value = err.response?.data?.error || 'Fout bij het ophalen van de goedkeuringswachtrij';
  } finally {
    loading.value = false;
  }
}

function viewDetails(item) {
  selectedItem.value = item;
  newCommentText.value = '';
  showDetailModal.value = true;
}

async function tagAsCandidate(item) {
  try {
    await axios.put(`/api/request-logs/${item.id}/tag-candidate`);
    await fetchQueue();
    if (showDetailModal.value && selectedItem.value?.id === item.id) {
      await fetchQueue(); // Refresh selected item
      const updated = queueItems.value.find(i => i.id === item.id);
      if (updated) selectedItem.value = updated;
    }
    success('Tekst gemarkeerd als kandidaat');
  } catch (err) {
    console.error('Error tagging as candidate:', err);
    showError(err.response?.data?.error || 'Fout bij markeren als kandidaat');
  }
}

function showVerifyModal(item) {
  currentItemId.value = item.id;
  verifyNotes.value = '';
  showVerify.value = true;
  showDetailModal.value = false;
}

async function verifyText() {
  if (!currentItemId.value) return;
  actionLoading.value = true;
  try {
    await axios.put(`/api/request-logs/${currentItemId.value}/verify`, {
      notes: verifyNotes.value,
    });
    showVerify.value = false;
    verifyNotes.value = '';
    await fetchQueue();
    if (selectedItem.value?.id === currentItemId.value) {
      const updated = queueItems.value.find(i => i.id === currentItemId.value);
      if (updated) selectedItem.value = updated;
    }
    success('Tekst succesvol geverifieerd');
  } catch (err) {
    console.error('Error verifying:', err);
    showError(err.response?.data?.error || 'Fout bij verifiëren');
  } finally {
    actionLoading.value = false;
  }
}

function showApproveModal(item) {
  currentItemId.value = item.id;
  approveNotes.value = '';
  showApprove.value = true;
  showDetailModal.value = false;
}

async function approveText() {
  if (!currentItemId.value) return;
  actionLoading.value = true;
  try {
    await axios.put(`/api/request-logs/${currentItemId.value}/approve`, {
      notes: approveNotes.value,
    });
    showApprove.value = false;
    approveNotes.value = '';
    await fetchQueue();
    if (selectedItem.value?.id === currentItemId.value) {
      const updated = queueItems.value.find(i => i.id === currentItemId.value);
      if (updated) selectedItem.value = updated;
    }
    success('Tekst succesvol goedgekeurd en opgeslagen in projectbibliotheek!');
  } catch (err) {
    console.error('Error approving:', err);
    showError(err.response?.data?.error || 'Fout bij goedkeuren');
  } finally {
    actionLoading.value = false;
  }
}

function showRejectModal(item) {
  currentItemId.value = item.id;
  rejectReason.value = '';
  showReject.value = true;
  showDetailModal.value = false;
}

async function rejectText() {
  if (!currentItemId.value || !rejectReason.value.trim()) return;
  actionLoading.value = true;
  try {
    await axios.put(`/api/request-logs/${currentItemId.value}/reject`, {
      reason: rejectReason.value.trim(),
    });
    showReject.value = false;
    rejectReason.value = '';
    await fetchQueue();
    if (selectedItem.value?.id === currentItemId.value) {
      const updated = queueItems.value.find(i => i.id === currentItemId.value);
      if (updated) selectedItem.value = updated;
    }
    success('Tekst succesvol afgewezen');
  } catch (err) {
    console.error('Error rejecting:', err);
    showError(err.response?.data?.error || 'Fout bij afwijzen');
  } finally {
    actionLoading.value = false;
  }
}

async function addComment() {
  if (!selectedItem.value || !newCommentText.value.trim()) return;
  try {
    await axios.post(`/api/request-logs/${selectedItem.value.id}/comments`, {
      text: newCommentText.value.trim(),
    });
    newCommentText.value = '';
    await fetchQueue();
    const updated = queueItems.value.find(i => i.id === selectedItem.value.id);
    if (updated) selectedItem.value = updated;
    success('Opmerking toegevoegd');
  } catch (err) {
    console.error('Error adding comment:', err);
    showError(err.response?.data?.error || 'Fout bij toevoegen opmerking');
  }
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

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
  if (!dateString) return 'Onbekend';
  return new Date(dateString).toLocaleString('nl-BE');
}

function formatDateShort(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' });
}

onMounted(() => {
  fetchProjects();
  fetchQueue();
});
</script>

<style scoped>
.approval-queue-page {
  max-width: 100%;
  margin: 0 auto;
  padding: var(--spacing-8) var(--spacing-4);
  min-height: 100vh;
  background: var(--color-bg-secondary);
}

.page-header {
  margin-bottom: var(--spacing-6);
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

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-4);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-6);
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.filter-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.project-select {
  padding: var(--spacing-2) var(--spacing-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  min-width: 200px;
}

.project-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.queue-stats {
  display: flex;
  gap: var(--spacing-4);
  flex-wrap: wrap;
}

.stat-item {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.stat-item strong {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  margin-right: var(--spacing-1);
}

.loading {
  text-align: center;
  padding: var(--spacing-10);
  color: var(--color-text-secondary);
}

.error-message {
  background: #FEF2F2;
  color: var(--color-error);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-6);
  border: 1px solid #FECACA;
}

.kanban-board {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--spacing-4);
  overflow-x: auto;
  padding-bottom: var(--spacing-4);
}

.kanban-column {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  min-width: 280px;
  max-height: calc(100vh - 300px);
}

.column-header {
  padding: var(--spacing-4);
  border-bottom: 2px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.column-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.column-count {
  background: var(--color-text-tertiary);
  color: var(--color-text-inverse);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.column-empty {
  text-align: center;
  padding: var(--spacing-8);
  color: var(--color-text-tertiary);
  font-style: italic;
  font-size: var(--font-size-sm);
}

.kanban-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-3);
  cursor: pointer;
  transition: all var(--transition-base);
  position: relative;
}

.kanban-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.card-header {
  margin-bottom: var(--spacing-2);
}

.card-project {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-1);
}

.card-meta {
  display: flex;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.card-body {
  margin-bottom: var(--spacing-2);
}

.card-text-preview {
  margin-bottom: var(--spacing-2);
}

.card-text-preview strong {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-1);
}

.card-text-preview p {
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  margin: 0;
  line-height: var(--line-height-relaxed);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--spacing-2);
  border-top: 1px solid var(--color-border);
}

.card-user {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.card-actions {
  display: flex;
  gap: var(--spacing-1);
}

.btn-card-action {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-base);
  padding: var(--spacing-1);
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-base);
}

.btn-card-action:hover {
  background: var(--color-bg-secondary);
}

.btn-card-action.btn-reject {
  color: var(--color-error);
}

.card-comments-indicator {
  position: absolute;
  top: var(--spacing-2);
  right: var(--spacing-2);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

/* Column-specific colors */
.column-draft .column-header {
  background: #F3F4F6;
  border-bottom-color: #9CA3AF;
}

.column-candidate .column-header {
  background: #DBEAFE;
  border-bottom-color: #3B82F6;
}

.column-verified .column-header {
  background: #FEF3C7;
  border-bottom-color: #F59E0B;
}

.column-approved .column-header {
  background: #D1FAE5;
  border-bottom-color: #10B981;
}

.column-rejected .column-header {
  background: #FEE2E2;
  border-bottom-color: #EF4444;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-draft {
  background: #F3F4F6;
  color: #4B5563;
}

.status-candidate {
  background: #DBEAFE;
  color: #1E40AF;
}

.status-verified {
  background: #FEF3C7;
  color: #92400E;
}

.status-approved {
  background: #D1FAE5;
  color: #065F46;
}

.status-rejected {
  background: #FEE2E2;
  color: #991B1B;
}

/* Modal Styles */
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
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--color-border);
}

.detail-modal {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-6);
}

.modal h3 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.modal p {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-4);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: var(--font-size-2xl);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
}

.btn-close:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.meta-item {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.meta-item strong {
  color: var(--color-text-primary);
  display: block;
  margin-bottom: var(--spacing-1);
  font-size: var(--font-size-xs);
}

.detail-section {
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.detail-section h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-3) 0;
}

.detail-text {
  background: var(--color-bg-primary);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-primary);
  max-height: 300px;
  overflow-y: auto;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.timeline-item {
  display: flex;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
}

.timeline-item.rejected {
  border-left-color: var(--color-error);
}

.timeline-icon {
  font-size: var(--font-size-xl);
  flex-shrink: 0;
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
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.timeline-notes {
  margin-top: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-style: italic;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.comment-item {
  padding: var(--spacing-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.comment-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  white-space: pre-wrap;
  line-height: var(--line-height-relaxed);
}

.no-comments {
  text-align: center;
  padding: var(--spacing-4);
  color: var(--color-text-tertiary);
  font-style: italic;
  font-size: var(--font-size-sm);
}

.add-comment-section {
  margin-top: var(--spacing-4);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border);
}

.comment-input {
  width: 100%;
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-family: inherit;
  resize: vertical;
  margin-bottom: var(--spacing-3);
}

.comment-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-add-comment {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-add-comment:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-add-comment:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  flex-wrap: wrap;
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

.btn-verify {
  background: #FEF3C7;
  color: #92400E;
}

.btn-verify:hover:not(:disabled) {
  background: #FDE68A;
}

.btn-approve {
  background: #D1FAE5;
  color: #065F46;
}

.btn-approve:hover:not(:disabled) {
  background: #6EE7B7;
}

.btn-reject {
  background: #FEE2E2;
  color: #991B1B;
}

.btn-reject:hover:not(:disabled) {
  background: #FECACA;
}

@media (max-width: 1400px) {
  .kanban-board {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1024px) {
  .kanban-board {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .approval-queue-page {
    padding: var(--spacing-4) var(--spacing-3);
  }

  .kanban-board {
    grid-template-columns: 1fr;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .queue-stats {
    justify-content: space-between;
  }

  .modal {
    padding: var(--spacing-6);
    max-width: 95vw;
  }
}
</style>
