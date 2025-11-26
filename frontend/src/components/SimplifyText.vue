<template>
  <div class="simplify-page">
    <img 
      src="https://assets.nationbuilder.com/vooruit/sites/3/meta_images/original/Vooruit_thumbnail.jpg?1619535283" 
      alt="Vooruit Logo" 
      class="logo"
    />
    <h1>MensentaalMachine v{{ appVersion }}</h1>

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
          <option v-for="team in userTeams" :key="team.id" :value="team.id">
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
        >
          <option value="">Selecteer eerst een project</option>
          <option v-for="lvl in availableLvls" :key="lvl.id" :value="lvl.id">
            {{ lvl.name }} ({{ lvl.code }})
          </option>
        </select>
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
const availableProjects = computed(() => {
  if (!selectedTeamId.value) return [];
  return projects.value.filter(p => p.team?.id === selectedTeamId.value || p.team === selectedTeamId.value);
});

const availableLvls = computed(() => {
  if (!selectedProjectId.value) return [];
  const project = projects.value.find(p => p.id === selectedProjectId.value);
  if (!project || !project.lvls || project.lvls.length === 0) {
    console.log('No LVLs found for project:', project);
    return [];
  }
  
  // Normalize project LVL IDs to strings for comparison
  const projectLvlIds = project.lvls.map(pl => String(pl));
  
  // Filter LVLs that match project's LVLs
  const filtered = lvls.value.filter(lvl => {
    const lvlId = String(lvl.id);
    return projectLvlIds.includes(lvlId);
  });
  
  console.log('Available LVLs for project:', {
    projectId: selectedProjectId.value,
    projectLvlIds,
    allLvlIds: lvls.value.map(l => String(l.id)),
    filtered: filtered.map(l => l.name),
  });
  
  return filtered;
});

const availableReferences = computed(() => {
  if (!selectedProjectId.value) return [];
  return references.value.filter(ref => ref.project === selectedProjectId.value);
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
    projects.value = response.data.map(project => ({
      id: project._id || project.id,
      name: project.name,
      team: project.team?._id || project.team || project.teamId,
      // Normalize LVLs - they might be objects with _id/id or just strings
      lvls: (project.lvls || []).map(lvl => {
        if (typeof lvl === 'string') return lvl;
        return lvl._id || lvl.id || lvl;
      }),
    }));
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
  selectedReferenceIds.value = [];
  fetchReferences();
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

// Initialize data
onMounted(async () => {
  await Promise.all([
    fetchTeams(),
    fetchLvls(),
    fetchTargetAudiences(),
    fetchOutputFormats(),
    fetchLanguages(),
  ]);
});
</script>

<style scoped>
.simplify-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.logo {
  max-width: 150px;
  margin-bottom: 1rem;
}

h1 {
  font-size: 2.5em;
  margin-bottom: 2rem;
  color: #000;
}

h2 {
  font-size: 1.8em;
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: #000;
}

h3 {
  font-size: 1.3em;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.simplify-form {
  text-align: left;
  background: #f8f8f8;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #000;
  margin-bottom: 0.5rem;
}

.form-group select,
.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1em;
  box-sizing: border-box;
  background-color: #fdfdfd;
  color: #333;
}

.form-group select:focus,
.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #FF0000;
  box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
}

.form-group select:disabled,
.form-group input:disabled,
.form-group textarea:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-group textarea {
  min-height: 150px;
  resize: vertical;
  font-family: inherit;
}

.char-count {
  font-size: 0.9em;
  color: #666;
  margin-top: 0.5rem;
}

.optional-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #ddd;
}

.keyword-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.keyword-input input {
  flex: 1;
}

.keyword-input button {
  padding: 12px 20px;
  background: #FF0000;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.keyword-input button:hover:not(:disabled) {
  background: #cc0000;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.keyword-tag {
  background: #e0e0e0;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9em;
}

.keyword-tag button {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 1.2em;
  line-height: 1;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.keyword-tag button:hover:not(:disabled) {
  color: #FF0000;
}

.references-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.reference-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
}

.reference-checkbox:hover {
  background: #f0f0f0;
}

.reference-checkbox input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.submit-button {
  width: 100%;
  padding: 14px 24px;
  font-size: 1.2em;
  font-weight: 600;
  background-color: #FF0000;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.2s ease;
  margin-top: 1rem;
}

.submit-button:hover:not(:disabled) {
  background-color: #cc0000;
  transform: translateY(-2px);
}

.submit-button:disabled {
  background-color: #999;
  cursor: not-allowed;
  transform: none;
}

.loading-indicator {
  text-align: center;
  margin-top: 2rem;
  padding: 2rem;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #FF0000;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background-color: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid #fcc;
}

.result-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 3px solid #FF0000;
}

.result-container {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 2rem;
  margin-top: 1rem;
  text-align: left;
}

.result-text {
  line-height: 1.8;
  color: #333;
}

.result-text :deep(.separator) {
  border: none;
  border-top: 2px solid #FF0000;
  margin: 1.5rem 0;
}

.context-summary {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f0f0f0;
  border-radius: 8px;
}

.context-summary h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.context-summary ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.context-summary li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #ddd;
}

.context-summary li:last-child {
  border-bottom: none;
}

.context-summary strong {
  color: #000;
  margin-right: 0.5rem;
}
</style>

