<template>
  <div class="simplify-page">
    <div class="page-header">
      <h1>Tekst Vereenvoudigen</h1>
      <p class="page-subtitle">Vereenvoudig complexe teksten met contextuele AI-ondersteuning</p>
    </div>

    <form @submit.prevent="handleSimplify" class="simplify-form">
      <!-- Team Selection -->
      <div class="form-group">
        <label for="team-select">Team *</label>
        <select 
          id="team-select" 
          v-model="selectedTeamId" 
          required
          @change="onTeamChange"
          :disabled="loading || loadingTeams"
        >
          <option value="">Selecteer een team</option>
          <option v-for="team in availableTeams" :key="team.id" :value="team.id">
            {{ team.name }}
          </option>
        </select>
      </div>

      <!-- Project Selection -->
      <div class="form-group">
        <label for="project-select">Project *</label>
        <select 
          id="project-select" 
          v-model="selectedProjectId" 
          required
          @change="onProjectChange"
          :disabled="!selectedTeamId || loading || loadingProjects"
        >
          <option value="">Selecteer eerst een team</option>
          <option v-for="project in availableProjects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>

      <!-- LVL Selection -->
      <div class="form-group">
        <label for="lvl-select">Communicatieniveau (LVL) *</label>
        <select 
          id="lvl-select" 
          v-model="selectedLvlId" 
          required
          :disabled="!selectedProjectId || loading || loadingLvls"
          @change="onLvlChange"
        >
          <option value="">Selecteer eerst een project</option>
          <option v-for="lvl in availableLvls" :key="lvl.id" :value="lvl.id">
            {{ lvl.name }} ({{ lvl.code }})
          </option>
        </select>
      </div>

      <!-- Place Selection (optional, only if LVL has places) -->
      <div class="form-group" v-if="availablePlaces.length > 0">
        <label for="place-select">Plaats (optioneel)</label>
        <select 
          id="place-select" 
          v-model="selectedPlace" 
          :disabled="!selectedLvlId || loading"
        >
          <option value="">Geen specifieke plaats</option>
          <option v-for="place in availablePlaces" :key="place" :value="place">
            {{ place }}
          </option>
        </select>
        <small class="form-hint">Selecteer een specifieke plaats voor extra context</small>
      </div>

      <!-- Target Audience -->
      <div class="form-group">
        <label for="target-audience-select">Doelgroep *</label>
        <select 
          id="target-audience-select" 
          v-model="selectedTargetAudienceId" 
          required
          :disabled="loading || loadingTargetAudiences"
        >
          <option value="">Selecteer doelgroep</option>
          <option v-for="audience in targetAudiences" :key="audience.id" :value="audience.id">
            {{ audience.name }}
          </option>
        </select>
      </div>

      <!-- Output Format -->
      <div class="form-group">
        <label for="output-format-select">Output Formaat *</label>
        <select 
          id="output-format-select" 
          v-model="selectedOutputFormatId" 
          required
          :disabled="loading || loadingOutputFormats"
        >
          <option value="">Selecteer output formaat</option>
          <option v-for="format in outputFormats" :key="format.id" :value="format.id">
            {{ format.name }}
          </option>
        </select>
      </div>

      <!-- Language -->
      <div class="form-group">
        <label for="language-select">Taal *</label>
        <select 
          id="language-select" 
          v-model="selectedLanguageId" 
          required
          :disabled="loading || loadingLanguages"
        >
          <option value="">Selecteer taal</option>
          <option v-for="lang in languages" :key="lang.id" :value="lang.id">
            {{ lang.name }}
          </option>
        </select>
      </div>

      <!-- Text Input -->
      <div class="form-group">
        <label for="text-input">Tekst om te vereenvoudigen *</label>
        <textarea 
          id="text-input"
          v-model="inputText" 
          placeholder="Voer hier complexe tekst in..." 
          rows="10" 
          required
          :disabled="loading"
        ></textarea>
        <div class="char-count">{{ inputText.length }} karakters</div>
      </div>

      <!-- Optional Context Fields -->
      <div class="optional-section">
        <h3>Optionele Context</h3>

        <!-- Geographic Context -->
        <div class="form-group">
          <label for="geo-context">Geografische Context</label>
          <input 
            id="geo-context"
            type="text" 
            v-model="geoContext" 
            placeholder="Bijv. Stad Gent, Provincie Antwerpen"
            :disabled="loading"
          />
        </div>

        <!-- Include Keywords -->
        <div class="form-group">
          <label>Te Gebruiken Trefwoorden</label>
          <div class="keyword-input">
            <input 
              type="text" 
              v-model="newIncludeKeyword" 
              @keyup.enter="addIncludeKeyword"
              placeholder="Voeg trefwoord toe en druk Enter"
              :disabled="loading"
            />
            <button type="button" @click="addIncludeKeyword" :disabled="loading">Toevoegen</button>
          </div>
          <div class="keyword-tags">
            <span 
              v-for="(keyword, index) in includeKeywords" 
              :key="index" 
              class="keyword-tag"
            >
              {{ keyword }}
              <button type="button" @click="removeIncludeKeyword(index)" :disabled="loading">×</button>
            </span>
          </div>
        </div>

        <!-- Avoid Keywords -->
        <div class="form-group">
          <label>Te Vermijden Trefwoorden</label>
          <div class="keyword-input">
            <input 
              type="text" 
              v-model="newAvoidKeyword" 
              @keyup.enter="addAvoidKeyword"
              placeholder="Voeg trefwoord toe en druk Enter"
              :disabled="loading"
            />
            <button type="button" @click="addAvoidKeyword" :disabled="loading">Toevoegen</button>
          </div>
          <div class="keyword-tags">
            <span 
              v-for="(keyword, index) in avoidKeywords" 
              :key="index" 
              class="keyword-tag"
            >
              {{ keyword }}
              <button type="button" @click="removeAvoidKeyword(index)" :disabled="loading">×</button>
            </span>
          </div>
        </div>

        <!-- References -->
        <div class="form-group" v-if="availableReferences.length > 0">
          <label>Referenties (optioneel)</label>
          <div class="references-list">
            <label 
              v-for="ref in availableReferences" 
              :key="ref.id" 
              class="reference-checkbox"
            >
              <input 
                type="checkbox" 
                :value="ref.id" 
                v-model="selectedReferenceIds"
                :disabled="loading"
              />
              <span>{{ ref.title }} ({{ ref.type }})</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <button type="submit" :disabled="loading || !isFormValid" class="submit-button">
        <span v-if="loading">Aan het vereenvoudigen...</span>
        <span v-else>Vereenvoudig Tekst</span>
      </button>

      <div v-if="loading" class="loading-indicator">
        <div class="spinner"></div>
        <p>De tekst wordt vereenvoudigd. Dit kan even duren...</p>
      </div>
    </form>

    <!-- Error Display -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Result Display -->
    <div v-if="simplifiedText" class="result-section">
      <h2>Vereenvoudigde Tekst:</h2>
      <div class="result-container">
        <div class="result-text" v-html="formatSimplifiedText(simplifiedText)"></div>
      </div>

      <!-- Context Summary -->
      <div class="context-summary">
        <h3>Context Samenvatting:</h3>
        <ul>
          <li><strong>Team:</strong> {{ selectedTeamName }}</li>
          <li><strong>Project:</strong> {{ selectedProjectName }}</li>
          <li><strong>LVL:</strong> {{ selectedLvlName }}</li>
          <li><strong>Doelgroep:</strong> {{ selectedTargetAudienceName }}</li>
          <li><strong>Output Formaat:</strong> {{ selectedOutputFormatName }}</li>
          <li><strong>Taal:</strong> {{ selectedLanguageName }}</li>
          <li v-if="geoContext"><strong>Geografische Context:</strong> {{ geoContext }}</li>
          <li v-if="includeKeywords.length > 0"><strong>Te Gebruiken Trefwoorden:</strong> {{ includeKeywords.join(', ') }}</li>
          <li v-if="avoidKeywords.length > 0"><strong>Te Vermijden Trefwoorden:</strong> {{ avoidKeywords.join(', ') }}</li>
          <li v-if="selectedReferenceIds.length > 0"><strong>Referenties:</strong> {{ selectedReferenceNames.join(', ') }}</li>
          <li v-if="resultMeta?.tokensUsed"><strong>Tokens Gebruikt:</strong> {{ resultMeta.tokensUsed }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import { useAuth } from '../composables/useAuth.js';

const { user, userTeams } = useAuth();

const appVersion = ref('2.0.0');
const loading = ref(false);
const error = ref(null);

// Form data
const selectedTeamId = ref('');
const selectedProjectId = ref('');
const selectedLvlId = ref('');
const selectedPlace = ref('');
const selectedTargetAudienceId = ref('');
const selectedOutputFormatId = ref('');
const selectedLanguageId = ref('');
const inputText = ref('');
const geoContext = ref('');
const includeKeywords = ref([]);
const avoidKeywords = ref([]);
const newIncludeKeyword = ref('');
const newAvoidKeyword = ref('');
const selectedReferenceIds = ref([]);

// Data
const teams = ref([]);
const projects = ref([]);
const lvls = ref([]);
const targetAudiences = ref([]);
const outputFormats = ref([]);
const languages = ref([]);
const references = ref([]);

// Loading states
const loadingTeams = ref(false);
const loadingProjects = ref(false);
const loadingLvls = ref(false);
const loadingTargetAudiences = ref(false);
const loadingOutputFormats = ref(false);
const loadingLanguages = ref(false);

// Results
const simplifiedText = ref('');
const resultMeta = ref(null);

// Computed
const availableTeams = computed(() => {
  // If user is SUPER_ADMIN or ADMIN, show all teams
  if (user.value?.role === 'SUPER_ADMIN' || user.value?.role === 'ADMIN') {
    return teams.value;
  }
  
  // Otherwise, filter teams by user's teams
  if (!user.value || !user.value.teams || user.value.teams.length === 0) {
    return [];
  }
  
  const userTeamIds = user.value.teams.map(t => String(t.id || t));
  return teams.value.filter(team => userTeamIds.includes(String(team.id)));
});

const availableProjects = computed(() => {
  if (!selectedTeamId.value) return [];
  return projects.value.filter(p => p.team?.id === selectedTeamId.value || p.team === selectedTeamId.value);
});

const availableLvls = computed(() => {
  if (!selectedProjectId.value) return [];
  const project = projects.value.find(p => String(p.id) === String(selectedProjectId.value));
  if (!project) {
    console.log('Project not found:', selectedProjectId.value);
    return [];
  }
  
  if (!project.lvls || !Array.isArray(project.lvls) || project.lvls.length === 0) {
    console.log('No LVLs found for project:', project);
    return [];
  }
  
  // Normalize project LVL IDs to strings for comparison
  const projectLvlIds = project.lvls.map(pl => String(pl)).filter(Boolean);
  
  if (projectLvlIds.length === 0) {
    console.log('No valid LVL IDs in project:', project);
    return [];
  }
  
  // Filter LVLs that match project's LVLs
  const filtered = lvls.value.filter(lvl => {
    const lvlId = String(lvl.id);
    const matches = projectLvlIds.includes(lvlId);
    if (!matches) {
      console.log('LVL mismatch:', { lvlId, projectLvlIds, lvlName: lvl.name });
    }
    return matches;
  });
  
  console.log('Available LVLs for project:', {
    projectId: selectedProjectId.value,
    projectName: project.name,
    projectLvlIds,
    projectLvlCount: projectLvlIds.length,
    allLvlIds: lvls.value.map(l => String(l.id)),
    filtered: filtered.map(l => `${l.name} (${l.id})`),
    filteredCount: filtered.length,
  });
  
  return filtered;
});

const availableReferences = computed(() => {
  if (!selectedProjectId.value) return [];
  return references.value.filter(ref => ref.project === selectedProjectId.value);
});

const availablePlaces = computed(() => {
  if (!selectedLvlId.value) return [];
  const lvl = lvls.value.find(l => l.id === selectedLvlId.value);
  return lvl?.places || [];
});

const isFormValid = computed(() => {
  return selectedTeamId.value && 
         selectedProjectId.value && 
         selectedLvlId.value && 
         selectedTargetAudienceId.value && 
         selectedOutputFormatId.value && 
         selectedLanguageId.value && 
         inputText.value.trim().length > 0;
});

const selectedTeamName = computed(() => {
  const team = teams.value.find(t => t.id === selectedTeamId.value);
  return team?.name || '';
});

const selectedProjectName = computed(() => {
  const project = projects.value.find(p => p.id === selectedProjectId.value);
  return project?.name || '';
});

const selectedLvlName = computed(() => {
  const lvl = lvls.value.find(l => l.id === selectedLvlId.value);
  return lvl ? `${lvl.name} (${lvl.code})` : '';
});

const selectedTargetAudienceName = computed(() => {
  const audience = targetAudiences.value.find(a => a.id === selectedTargetAudienceId.value);
  return audience?.name || '';
});

const selectedOutputFormatName = computed(() => {
  const format = outputFormats.value.find(f => f.id === selectedOutputFormatId.value);
  return format?.name || '';
});

const selectedLanguageName = computed(() => {
  const lang = languages.value.find(l => l.id === selectedLanguageId.value);
  return lang?.name || '';
});

const selectedReferenceNames = computed(() => {
  return availableReferences.value
    .filter(ref => selectedReferenceIds.value.includes(ref.id))
    .map(ref => ref.title);
});

// Methods
async function fetchTeams() {
  loadingTeams.value = true;
  try {
    const response = await axios.get('/api/teams');
    teams.value = response.data.map(team => ({
      id: team._id || team.id,
      name: team.name,
    }));
  } catch (err) {
    console.error('Error fetching teams:', err);
  } finally {
    loadingTeams.value = false;
  }
}

async function fetchProjects() {
  if (!selectedTeamId.value) return;
  loadingProjects.value = true;
  try {
    const response = await axios.get(`/api/projects?teamId=${selectedTeamId.value}`);
    projects.value = response.data.map(project => {
      // Normalize LVLs - handle both populated objects and ObjectIds
      let normalizedLvls = [];
      if (project.lvls && Array.isArray(project.lvls)) {
        normalizedLvls = project.lvls.map(lvl => {
          if (typeof lvl === 'string') return String(lvl);
          if (lvl && typeof lvl === 'object') {
            return String(lvl._id || lvl.id || lvl);
          }
          return String(lvl);
        });
      }
      
      return {
        id: String(project._id || project.id),
        name: project.name,
        team: project.team?._id || project.team || project.teamId,
        lvls: normalizedLvls,
      };
    });
    console.log('Fetched projects:', projects.value);
  } catch (err) {
    console.error('Error fetching projects:', err);
  } finally {
    loadingProjects.value = false;
  }
}

async function fetchLvls() {
  loadingLvls.value = true;
  try {
    const response = await axios.get('/api/lvls');
    lvls.value = response.data.map(lvl => ({
      id: lvl._id || lvl.id,
      name: lvl.name,
      code: lvl.code,
      places: lvl.places || [],
    }));
  } catch (err) {
    console.error('Error fetching LVLs:', err);
  } finally {
    loadingLvls.value = false;
  }
}

async function fetchTargetAudiences() {
  loadingTargetAudiences.value = true;
  try {
    const response = await axios.get('/api/target-audiences');
    targetAudiences.value = response.data.map(a => ({
      id: a._id || a.id,
      name: a.name,
    }));
  } catch (err) {
    console.error('Error fetching target audiences:', err);
  } finally {
    loadingTargetAudiences.value = false;
  }
}

async function fetchOutputFormats() {
  loadingOutputFormats.value = true;
  try {
    const response = await axios.get('/api/output-formats');
    outputFormats.value = response.data.map(f => ({
      id: f._id || f.id,
      name: f.name,
    }));
  } catch (err) {
    console.error('Error fetching output formats:', err);
  } finally {
    loadingOutputFormats.value = false;
  }
}

async function fetchLanguages() {
  loadingLanguages.value = true;
  try {
    const response = await axios.get('/api/languages');
    languages.value = response.data.map(l => ({
      id: l._id || l.id,
      name: l.name,
      code: l.code,
    }));
    // Set default to Dutch if available
    const dutch = languages.value.find(l => l.code === 'DUTCH');
    if (dutch) {
      selectedLanguageId.value = dutch.id;
    }
  } catch (err) {
    console.error('Error fetching languages:', err);
  } finally {
    loadingLanguages.value = false;
  }
}

async function fetchReferences() {
  if (!selectedProjectId.value) {
    references.value = [];
    return;
  }
  try {
    const response = await axios.get(`/api/projects/${selectedProjectId.value}/references`);
    references.value = response.data.map(ref => ({
      id: ref._id || ref.id,
      title: ref.title,
      type: ref.type,
      project: ref.project?._id || ref.project || ref.projectId,
    }));
  } catch (err) {
    console.error('Error fetching references:', err);
  }
}

function onTeamChange() {
  selectedProjectId.value = '';
  selectedLvlId.value = '';
  selectedReferenceIds.value = [];
  fetchProjects();
}

function onProjectChange() {
  selectedLvlId.value = '';
  selectedPlace.value = '';
  selectedReferenceIds.value = [];
  fetchReferences();
}

function onLvlChange() {
  selectedPlace.value = '';
}

function addIncludeKeyword() {
  const keyword = newIncludeKeyword.value.trim();
  if (keyword && !includeKeywords.value.includes(keyword)) {
    includeKeywords.value.push(keyword);
    newIncludeKeyword.value = '';
  }
}

function removeIncludeKeyword(index) {
  includeKeywords.value.splice(index, 1);
}

function addAvoidKeyword() {
  const keyword = newAvoidKeyword.value.trim();
  if (keyword && !avoidKeywords.value.includes(keyword)) {
    avoidKeywords.value.push(keyword);
    newAvoidKeyword.value = '';
  }
}

function removeAvoidKeyword(index) {
  avoidKeywords.value.splice(index, 1);
}

function formatSimplifiedText(text) {
  // Replace line breaks with <br> and preserve --- separators
  return text
    .replace(/\n/g, '<br>')
    .replace(/---/g, '<hr class="separator">');
}

async function handleSimplify() {
  if (!isFormValid.value) {
    error.value = 'Vul alle verplichte velden in';
    return;
  }

  loading.value = true;
  error.value = null;
  simplifiedText.value = '';

  try {
    const response = await axios.post('/api/simplify', {
      text: inputText.value,
      teamId: selectedTeamId.value,
      projectId: selectedProjectId.value,
      lvlId: selectedLvlId.value,
      place: selectedPlace.value || undefined,
      targetAudienceId: selectedTargetAudienceId.value,
      outputFormatId: selectedOutputFormatId.value,
      languageId: selectedLanguageId.value,
      geoContext: geoContext.value || undefined,
      includeKeywords: includeKeywords.value.length > 0 ? includeKeywords.value : undefined,
      avoidKeywords: avoidKeywords.value.length > 0 ? avoidKeywords.value : undefined,
      referenceIds: selectedReferenceIds.value.length > 0 ? selectedReferenceIds.value : undefined,
    });

    simplifiedText.value = response.data.simplifiedText;
    resultMeta.value = response.data.meta;

    // Scroll to result
    setTimeout(() => {
      const resultSection = document.querySelector('.result-section');
      if (resultSection) {
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  } catch (err) {
    console.error('Error simplifying text:', err);
    error.value = err.response?.data?.error || 'Fout bij het vereenvoudigen van de tekst. Probeer het opnieuw.';
    if (err.response?.status === 429) {
      error.value = 'Te veel verzoeken. Wacht even en probeer het later opnieuw.';
    }
  } finally {
    loading.value = false;
  }
}

// Watch for project changes to fetch references
watch(selectedProjectId, (newVal) => {
  if (newVal) {
    fetchReferences();
  }
});

// Initialize data - wait for auth to be ready
onMounted(async () => {
  // Wait for authentication to be ready
  const { isAuthenticated, checkAuth } = useAuth();
  
  // If not authenticated, try to check auth first
  if (!isAuthenticated.value) {
    const authResult = await checkAuth();
    if (!authResult) {
      console.error('Authentication failed, redirecting to login');
      return;
    }
  }
  
  // Wait a bit to ensure user data is fully loaded
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Now fetch data
  await Promise.all([
    fetchTeams(),
    fetchLvls(),
    fetchTargetAudiences(),
    fetchOutputFormats(),
    fetchLanguages(),
  ]);
  
  console.log('Data loaded:', {
    teamsCount: teams.value.length,
    userTeams: user.value?.teams,
    userRole: user.value?.role,
  });
});
</script>

<style scoped>
.form-hint {
  display: block;
  margin-top: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-style: italic;
}
.simplify-page {
  max-width: 900px;
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

.simplify-form {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-8);
  margin-bottom: var(--spacing-8);
  box-shadow: var(--shadow-sm);
}

.form-group {
  margin-bottom: var(--spacing-6);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.form-group select,
.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.form-group select:focus,
.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.form-group select:disabled,
.form-group input:disabled,
.form-group textarea:disabled {
  background-color: var(--color-bg-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}

.form-group textarea {
  min-height: 180px;
  resize: vertical;
  font-family: var(--font-family);
  line-height: var(--line-height-relaxed);
}

.char-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-2);
  text-align: right;
}

.optional-section {
  margin-top: var(--spacing-8);
  padding-top: var(--spacing-8);
  border-top: 1px solid var(--color-border);
}

.optional-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-6);
}

.keyword-input {
  display: flex;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
}

.keyword-input input {
  flex: 1;
}

.keyword-input button {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  min-height: var(--spacing-8);
}

.keyword-tag {
  background: var(--color-bg-tertiary);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.keyword-tag button {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-size: var(--font-size-lg);
  line-height: 1;
  padding: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: all var(--transition-base);
}

.keyword-tag button:hover:not(:disabled) {
  color: var(--color-error);
  background-color: var(--color-bg-secondary);
}

.references-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  max-height: 200px;
  overflow-y: auto;
  padding: var(--spacing-2);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.reference-checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  cursor: pointer;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  transition: background-color var(--transition-base);
  font-size: var(--font-size-sm);
}

.reference-checkbox:hover {
  background: var(--color-bg-tertiary);
}

.reference-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.submit-button {
  width: 100%;
  padding: var(--spacing-4) var(--spacing-6);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  margin-top: var(--spacing-6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
}

.loading-indicator {
  text-align: center;
  margin-top: var(--spacing-6);
  padding: var(--spacing-6);
}

.loading-indicator p {
  margin-top: var(--spacing-4);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.error-message {
  background-color: #FEF2F2;
  color: var(--color-error);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-6);
  border: 1px solid #FECACA;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
}

.result-section {
  margin-top: var(--spacing-10);
  padding-top: var(--spacing-8);
  border-top: 2px solid var(--color-primary);
}

.result-section h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-6);
}

.result-container {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  margin-top: var(--spacing-4);
  text-align: left;
}

.result-text {
  line-height: var(--line-height-relaxed);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.result-text :deep(.separator) {
  border: none;
  border-top: 2px solid var(--color-primary);
  margin: var(--spacing-6) 0;
  opacity: 0.3;
}

.context-summary {
  margin-top: var(--spacing-6);
  padding: var(--spacing-6);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.context-summary h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-top: 0;
  margin-bottom: var(--spacing-4);
}

.context-summary ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.context-summary li {
  padding: var(--spacing-3) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.context-summary li:last-child {
  border-bottom: none;
}

.context-summary strong {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  margin-right: var(--spacing-2);
}

@media (max-width: 768px) {
  .simplify-page {
    padding: var(--spacing-4) var(--spacing-3);
  }
  
  .simplify-form {
    padding: var(--spacing-6);
  }
  
  .page-header h1 {
    font-size: var(--font-size-3xl);
  }
}
</style>

