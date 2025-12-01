<template>
  <div class="approval-queue-page">
    <div class="page-header">
      <h1>Goedkeuringswachtrij</h1>
      <p class="page-subtitle">Teksten die wachten op verificatie of goedkeuring</p>
    </div>

    <div v-if="loading" class="loading">Laden...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="!loading && !error && queueItems.length === 0" class="empty-state">
      <div class="empty-icon">✅</div>
      <h3>Geen items in de wachtrij</h3>
      <p>Alle teksten zijn verwerkt. Er zijn momenteel geen teksten die wachten op verificatie of goedkeuring.</p>
    </div>

    <div v-else-if="!loading && !error" class="queue-content">
      <!-- Bulk Actions Bar -->
      <div v-if="queueItems.length > 0" class="bulk-actions-bar">
        <div class="bulk-actions-left">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="toggleSelectAll"
            />
            <span>Selecteer alles ({{ selectedItems.length }} geselecteerd)</span>
          </label>
        </div>
        <div class="bulk-actions-right">
          <button
            v-if="canBulkVerify && selectedItems.length > 0"
            @click="showBulkVerifyModal = true"
            class="btn-bulk btn-verify"
            :disabled="!hasSelectableForVerify"
          >
            ✓ Verifieer geselecteerd ({{ selectedItemsForVerify.length }})
          </button>
          <button
            v-if="canBulkApprove && selectedItems.length > 0"
            @click="showBulkApproveModal = true"
            class="btn-bulk btn-approve"
            :disabled="!hasSelectableForApprove"
          >
            ✅ Keur geselecteerd goed ({{ selectedItemsForApprove.length }})
          </button>
        </div>
      </div>

      <!-- Queue Items -->
      <div class="queue-items">
        <div
          v-for="item in queueItems"
          :key="item.id"
          class="queue-item"
          :class="{ 'selected': selectedItems.includes(item.id) }"
        >
          <div class="queue-item-header">
            <label class="item-checkbox">
              <input
                type="checkbox"
                :checked="selectedItems.includes(item.id)"
                @change="toggleSelectItem(item.id)"
                :disabled="!isSelectable(item)"
              />
            </label>
            <div class="item-info">
              <div class="item-title">
                <span class="item-project">{{ item.project?.name || 'Onbekend' }}</span>
                <span class="item-team">{{ item.team?.name || 'Onbekend' }}</span>
                <span :class="['status-badge', `status-${item.approvalStatus?.toLowerCase() || 'draft'}`]">
                  {{ getStatusLabel(item.approvalStatus) }}
                </span>
              </div>
              <div class="item-meta">
                <span>LVL: {{ item.lvl?.name || 'N/A' }}</span>
                <span>Door: {{ item.user?.email || 'Onbekend' }}</span>
                <span>{{ formatDate(item.createdAt) }}</span>
              </div>
            </div>
            <div class="item-actions">
              <button
                v-if="item.approvalStatus === 'CANDIDATE' && canVerify"
                @click="showVerifyModal(item)"
                class="btn-action btn-verify"
              >
                ✓ Verifieer
              </button>
              <button
                v-if="item.approvalStatus === 'VERIFIED' && canApprove"
                @click="showApproveModal(item)"
                class="btn-action btn-approve"
              >
                ✅ Keur goed
              </button>
              <button
                @click="viewDetails(item)"
                class="btn-action btn-view"
              >
                👁️ Bekijk
              </button>
            </div>
          </div>

          <div class="queue-item-preview">
            <div class="preview-text">
              <strong>Origineel:</strong>
              <p>{{ truncateText(item.originalText, 150) }}</p>
            </div>
            <div class="preview-text">
              <strong>Vereenvoudigd:</strong>
              <p>{{ truncateText(item.simplifiedText, 150) }}</p>
            </div>
            <div v-if="item.comments && item.comments.length > 0" class="preview-comments">
              <strong>Opmerkingen ({{ item.comments.length }}):</strong>
              <p>{{ item.comments[0].text }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="pagination">
        <button
          @click="changePage(pagination.page - 1)"
          :disabled="pagination.page <= 1"
          class="pagination-btn"
        >
          Vorige
        </button>
        <span>
          Pagina {{ pagination.page }} van {{ pagination.totalPages }}
          ({{ pagination.total }} totaal)
        </span>
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

    <!-- Bulk Verify Modal -->
    <div v-if="showBulkVerifyModal" class="modal-overlay" @click="showBulkVerifyModal = false">
      <div class="modal" @click.stop>
        <h3>Bulk Verificatie</h3>
        <p>Je gaat {{ selectedItemsForVerify.length }} teksten verifiëren.</p>
        <textarea
          v-model="bulkVerifyNotes"
          placeholder="Optionele notities voor alle verificaties..."
          rows="4"
          class="modal-textarea"
        ></textarea>
        <div class="modal-actions">
          <button @click="showBulkVerifyModal = false" class="btn-secondary">Annuleren</button>
          <button @click="bulkVerify" class="btn-primary" :disabled="actionLoading">
            Verifieer {{ selectedItemsForVerify.length }} teksten
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Approve Modal -->
    <div v-if="showBulkApproveModal" class="modal-overlay" @click="showBulkApproveModal = false">
      <div class="modal" @click.stop>
        <h3>Bulk Goedkeuring</h3>
        <p>Je gaat {{ selectedItemsForApprove.length }} teksten goedkeuren. Deze zullen worden opgeslagen in de projectbibliotheken.</p>
        <textarea
          v-model="bulkApproveNotes"
          placeholder="Optionele notities voor alle goedkeuringen..."
          rows="4"
          class="modal-textarea"
        ></textarea>
        <div class="modal-actions">
          <button @click="showBulkApproveModal = false" class="btn-secondary">Annuleren</button>
          <button @click="bulkApprove" class="btn-primary" :disabled="actionLoading">
            Keur {{ selectedItemsForApprove.length }} teksten goed
          </button>
        </div>
      </div>
    </div>

    <!-- Detail View Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click="showDetailModal = false">
      <div class="modal detail-modal" @click.stop>
        <div class="modal-header">
          <h3>Tekst Details</h3>
          <button @click="showDetailModal = false" class="btn-close">×</button>
        </div>
        <div v-if="selectedItem" class="detail-content">
          <div class="detail-meta">
            <p><strong>Team:</strong> {{ selectedItem.team?.name || 'Onbekend' }}</p>
            <p><strong>Project:</strong> {{ selectedItem.project?.name || 'Onbekend' }}</p>
            <p><strong>LVL:</strong> {{ selectedItem.lvl?.name || 'Onbekend' }}</p>
            <p><strong>Gebruiker:</strong> {{ selectedItem.user?.email || 'Onbekend' }}</p>
            <p><strong>Datum:</strong> {{ formatDate(selectedItem.createdAt) }}</p>
          </div>
          <div class="detail-text-section">
            <h4>Originele Tekst</h4>
            <pre class="detail-text">{{ selectedItem.originalText }}</pre>
          </div>
          <div class="detail-text-section">
            <h4>Vereenvoudigde Tekst</h4>
            <pre class="detail-text">{{ selectedItem.simplifiedText }}</pre>
          </div>
          <div v-if="selectedItem.comments && selectedItem.comments.length > 0" class="detail-comments">
            <h4>Opmerkingen ({{ selectedItem.comments.length }})</h4>
            <div v-for="comment in selectedItem.comments" :key="comment._id || comment.id" class="comment-item">
              <div class="comment-header">
                <strong>{{ comment.user?.email || 'Onbekend' }}</strong>
                <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
              </div>
              <p class="comment-text">{{ comment.text }}</p>
            </div>
          </div>
          <div class="modal-actions">
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
            <button @click="showDetailModal = false" class="btn-secondary">Sluiten</button>
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

const { hasRole } = useAuth();

const loading = ref(false);
const error = ref(null);
const queueItems = ref([]);
const selectedItems = ref([]);
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

// Modal states
const showVerify = ref(false);
const showApprove = ref(false);
const showBulkVerifyModal = ref(false);
const showBulkApproveModal = ref(false);
const showDetailModal = ref(false);
const verifyNotes = ref('');
const approveNotes = ref('');
const bulkVerifyNotes = ref('');
const bulkApproveNotes = ref('');
const currentItemId = ref(null);
const selectedItem = ref(null);
const actionLoading = ref(false);

// Permission checks
const canVerify = computed(() => hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));
const canApprove = computed(() => hasRole('TEAM_LEADER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN'));
const canBulkVerify = computed(() => canVerify.value);
const canBulkApprove = computed(() => canApprove.value);

// Computed properties for bulk operations
const allSelected = computed(() => {
  const selectableItems = queueItems.value.filter(item => isSelectable(item)).map(item => item.id);
  return selectableItems.length > 0 && selectableItems.every(id => selectedItems.value.includes(id));
});

const selectedItemsForVerify = computed(() => {
  return queueItems.value.filter(item => 
    selectedItems.value.includes(item.id) && 
    item.approvalStatus === 'CANDIDATE' &&
    canVerify.value
  );
});

const selectedItemsForApprove = computed(() => {
  return queueItems.value.filter(item => 
    selectedItems.value.includes(item.id) && 
    item.approvalStatus === 'VERIFIED' &&
    canApprove.value
  );
});

const hasSelectableForVerify = computed(() => selectedItemsForVerify.value.length > 0);
const hasSelectableForApprove = computed(() => selectedItemsForApprove.value.length > 0);

function isSelectable(item) {
  if (item.approvalStatus === 'CANDIDATE' && canVerify.value) return true;
  if (item.approvalStatus === 'VERIFIED' && canApprove.value) return true;
  return false;
}

function toggleSelectAll() {
  const selectableItems = queueItems.value.filter(item => isSelectable(item)).map(item => item.id);
  if (allSelected.value) {
    selectedItems.value = [];
  } else {
    selectedItems.value = [...selectableItems];
  }
}

function toggleSelectItem(itemId) {
  const index = selectedItems.value.indexOf(itemId);
  if (index > -1) {
    selectedItems.value.splice(index, 1);
  } else {
    selectedItems.value.push(itemId);
  }
}

async function fetchQueue() {
  loading.value = true;
  error.value = null;
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
    };
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
    pagination.value = {
      page: response.data.pagination.page,
      limit: response.data.pagination.limit,
      total: response.data.pagination.total,
      totalPages: response.data.pagination.totalPages,
    };
  } catch (err) {
    console.error('Error fetching approval queue:', err);
    error.value = err.response?.data?.error || 'Fout bij het ophalen van de goedkeuringswachtrij';
  } finally {
    loading.value = false;
  }
}

function changePage(newPage) {
  pagination.value.page = newPage;
  selectedItems.value = []; // Clear selection on page change
  fetchQueue();
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
  } catch (err) {
    console.error('Error verifying:', err);
    alert(err.response?.data?.error || 'Fout bij verifiëren');
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
    selectedItems.value = selectedItems.value.filter(id => id !== currentItemId.value);
    await fetchQueue();
    alert('Tekst succesvol goedgekeurd!');
  } catch (err) {
    console.error('Error approving:', err);
    alert(err.response?.data?.error || 'Fout bij goedkeuren');
  } finally {
    actionLoading.value = false;
  }
}

async function bulkVerify() {
  if (selectedItemsForVerify.value.length === 0) return;
  actionLoading.value = true;
  try {
    const logIds = selectedItemsForVerify.value.map(item => item.id);
    const response = await axios.post('/api/request-logs/bulk-verify', {
      logIds,
      notes: bulkVerifyNotes.value,
    });
    showBulkVerifyModal.value = false;
    bulkVerifyNotes.value = '';
    selectedItems.value = [];
    await fetchQueue();
    if (response.data.errors && response.data.errors > 0) {
      alert(`${response.data.verified} teksten geverifieerd, ${response.data.errors} fouten opgetreden.`);
    } else {
      alert(`${response.data.verified} teksten succesvol geverifieerd!`);
    }
  } catch (err) {
    console.error('Error bulk verifying:', err);
    alert(err.response?.data?.error || 'Fout bij bulk verificatie');
  } finally {
    actionLoading.value = false;
  }
}

async function bulkApprove() {
  if (selectedItemsForApprove.value.length === 0) return;
  actionLoading.value = true;
  try {
    const logIds = selectedItemsForApprove.value.map(item => item.id);
    const response = await axios.post('/api/request-logs/bulk-approve', {
      logIds,
      notes: bulkApproveNotes.value,
    });
    showBulkApproveModal.value = false;
    bulkApproveNotes.value = '';
    selectedItems.value = [];
    await fetchQueue();
    if (response.data.errors && response.data.errors > 0) {
      alert(`${response.data.approved} teksten goedgekeurd, ${response.data.errors} fouten opgetreden.`);
    } else {
      alert(`${response.data.approved} teksten succesvol goedgekeurd en opgeslagen in projectbibliotheken!`);
    }
  } catch (err) {
    console.error('Error bulk approving:', err);
    alert(err.response?.data?.error || 'Fout bij bulk goedkeuring');
  } finally {
    actionLoading.value = false;
  }
}

function viewDetails(item) {
  selectedItem.value = item;
  showDetailModal.value = true;
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

onMounted(() => {
  fetchQueue();
});
</script>

<style scoped>
.approval-queue-page {
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

.empty-state {
  text-align: center;
  padding: var(--spacing-12);
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-4);
}

.empty-state h3 {
  font-size: var(--font-size-xl);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.empty-state p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

.bulk-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-6);
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.bulk-actions-left,
.bulk-actions-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.btn-bulk {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.btn-bulk:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-bulk.btn-verify {
  background: #FEF3C7;
  color: #92400E;
}

.btn-bulk.btn-verify:hover:not(:disabled) {
  background: #FDE68A;
}

.btn-bulk.btn-approve {
  background: #D1FAE5;
  color: #065F46;
}

.btn-bulk.btn-approve:hover:not(:disabled) {
  background: #6EE7B7;
}

.queue-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

.queue-item {
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-5);
  transition: all var(--transition-base);
}

.queue-item:hover {
  box-shadow: var(--shadow-md);
}

.queue-item.selected {
  border-color: var(--color-primary);
  background: rgba(59, 130, 246, 0.05);
}

.queue-item-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-4);
}

.item-checkbox {
  flex-shrink: 0;
  margin-top: var(--spacing-1);
}

.item-checkbox input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-2);
}

.item-project {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.item-team {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.item-meta {
  display: flex;
  gap: var(--spacing-4);
  flex-wrap: wrap;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.item-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-shrink: 0;
  flex-wrap: wrap;
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
  white-space: nowrap;
}

.status-candidate {
  background: #DBEAFE;
  color: #1E40AF;
}

.status-verified {
  background: #FEF3C7;
  color: #92400E;
}

.queue-item-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-4);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border);
}

.preview-text {
  font-size: var(--font-size-sm);
}

.preview-text strong {
  display: block;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-1);
  font-size: var(--font-size-xs);
}

.preview-text p {
  color: var(--color-text-secondary);
  margin: 0;
  line-height: var(--line-height-relaxed);
}

.preview-comments {
  font-size: var(--font-size-sm);
  padding: var(--spacing-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.preview-comments strong {
  display: block;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-1);
  font-size: var(--font-size-xs);
}

.preview-comments p {
  color: var(--color-text-secondary);
  margin: 0;
  font-style: italic;
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

.btn-action:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
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

.btn-view {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-4);
  margin-top: var(--spacing-8);
  padding-top: var(--spacing-6);
  border-top: 1px solid var(--color-border);
}

.pagination-btn {
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.detail-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.detail-meta p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.detail-text-section h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-3);
}

.detail-text {
  background: var(--color-bg-secondary);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-primary);
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.detail-comments {
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.detail-comments h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-4);
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

.comment-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  white-space: pre-wrap;
  line-height: var(--line-height-relaxed);
}

@media (max-width: 768px) {
  .approval-queue-page {
    padding: var(--spacing-4) var(--spacing-3);
  }

  .bulk-actions-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .bulk-actions-left,
  .bulk-actions-right {
    width: 100%;
    justify-content: space-between;
  }

  .queue-item-header {
    flex-wrap: wrap;
  }

  .item-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .queue-item-preview {
    grid-template-columns: 1fr;
  }

  .modal {
    padding: var(--spacing-6);
    max-width: 95vw;
  }
}
</style>

