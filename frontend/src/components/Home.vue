<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

const inputText = ref('');
const simplifiedText = ref('');
const selectedLanguage = ref('Dutch');
const selectedTargetAudience = ref('Algemeen');
const selectedOutputFormat = ref('Samenvatting');
const appVersion = ref('1.0.2');
const isLoading = ref(false);

const dictionaryEntries = ref([]);
const newOriginalTerm = ref('');
const newSimplifiedTerm = ref('');
const editingEntryId = ref(null);

const parsedSimplifiedText = computed(() => {
  if (!simplifiedText.value) return { tldr: [], suggestedCopy: '' };

  const parts = simplifiedText.value.split('---').map(part => part.trim()).filter(part => part.length > 0);

  let tldr = [];
  let suggestedCopy = '';

  if (parts.length >= 4) {
    tldr = parts.slice(0, 3);
    suggestedCopy = parts.slice(3).join('---').trim();
  } else if (parts.length > 0) {
    suggestedCopy = simplifiedText.value;
  }

  return { tldr, suggestedCopy };
});

async function fetchDictionaryEntries() {
  try {
    const response = await axios.get('/api/dictionary');
    dictionaryEntries.value = response.data;
  } catch (error) {
    console.error('Fout bij ophalen woordenboek items:', error);
    alert(`Netwerkfout bij ophalen woordenboek items: ${error.message}`);
  }
}

async function addDictionaryEntry() {
  if (!newOriginalTerm.value || !newSimplifiedTerm.value) {
    alert('Beide termen zijn verplicht!');
    return;
  }
  try {
    await axios.post('/api/dictionary', { originalTerm: newOriginalTerm.value, simplifiedTerm: newSimplifiedTerm.value });
    newOriginalTerm.value = '';
    newSimplifiedTerm.value = '';
    fetchDictionaryEntries();
  } catch (error) {
    console.error('Fout bij toevoegen woordenboek item:', error);
    alert(`Fout bij toevoegen: ${error.response.data.message}`);
  }
}

function editDictionaryEntry(entry) {
  editingEntryId.value = entry._id;
  newOriginalTerm.value = entry.originalTerm;
  newSimplifiedTerm.value = entry.simplifiedTerm;
}

async function updateDictionaryEntry() {
  if (!editingEntryId.value || !newOriginalTerm.value || !newSimplifiedTerm.value) {
    alert('Beide termen zijn verplicht voor bewerken!');
    return;
  }
  try {
    await axios.put(`/api/dictionary/${editingEntryId.value}`, { originalTerm: newOriginalTerm.value, simplifiedTerm: newSimplifiedTerm.value });
    editingEntryId.value = null;
    newOriginalTerm.value = '';
    newSimplifiedTerm.value = '';
    fetchDictionaryEntries();
  } catch (error) {
    console.error('Fout bij bijwerken woordenboek item:', error);
    alert(`Fout bij bijwerken: ${error.response.data.message}`);
  }
}

async function deleteDictionaryEntry(id) {
  if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return;
  try {
    await axios.delete(`/api/dictionary/${id}`);
    fetchDictionaryEntries();
  } catch (error) {
    console.error('Fout bij verwijderen woordenboek item:', error);
    alert(`Fout bij verwijderen: ${error.response.data.message}`);
  }
}

async function simplifyText() {
  isLoading.value = true;
  try {
    const response = await axios.post('/api/simplify', {
      text: inputText.value,
      language: selectedLanguage.value,
      targetAudience: selectedTargetAudience.value,
      outputFormat: selectedOutputFormat.value,
    });
    simplifiedText.value = response.data.simplifiedText;
  } catch (error) {
    console.error('Fout bij vereenvoudigen tekst:', error);
    simplifiedText.value = `Niet gelukt om tekst te vereenvoudigen: ${error.response.data.error}`;
  } finally {
    isLoading.value = false;
  }
}

async function saveResult() {
  if (!simplifiedText.value || !inputText.value) {
    alert('Er is geen resultaat om op te slaan.');
    return;
  }
  try {
    await axios.post('/api/saved-results', {
      originalText: inputText.value,
      simplifiedText: simplifiedText.value,
      targetAudience: selectedTargetAudience.value,
      outputFormat: selectedOutputFormat.value,
    });
    alert('Resultaat opgeslagen!');
  } catch (error) {
    console.error('Fout bij opslaan resultaat:', error);
    if (error.response) {
      alert(`Fout bij opslaan: ${error.response.data.message}`);
    } else {
      alert('Fout bij opslaan: Netwerkfout. Kon de server niet bereiken.');
    }
  }
}

onMounted(() => {
  fetchDictionaryEntries();
});
</script>

<template>
  <div>
    <img src="https://assets.nationbuilder.com/vooruit/sites/3/meta_images/original/Vooruit_thumbnail.jpg?1619535283" alt="Vooruit Logo" style="max-width: 150px; margin-bottom: 1rem;">
    <h1>MensentaalMachine v{{ appVersion }}</h1>

    <label for="language-select">Selecteer Taal:</label>
    <select id="language-select" v-model="selectedLanguage">
      <option value="Dutch">Nederlands</option>
      <option value="English">Engels</option>
      <option value="French">Frans</option>
    </select>
    <br>

    <label for="target-audience-select">Doelgroep:</label>
    <select id="target-audience-select" v-model="selectedTargetAudience">
      <option value="Algemeen">Algemeen</option>
      <option value="Jongeren">Jongeren</option>
      <option value="Ouderen">Ouderen</option>
    </select>
    <br>

    <label for="output-format-select">Output Formaat:</label>
    <select id="output-format-select" v-model="selectedOutputFormat">
      <option value="Samenvatting">Samenvatting</option>
      <option value="Korte versie (Instagram-achtig)">Korte versie (Instagram-achtig)</option>
      <option value="Medium versie (LinkedIn-achtig)">Medium versie (LinkedIn-achtig)</option>
      <option value="Opsommingstekens">Opsommingstekens</option>
    </select>
    <br>

    <textarea v-model="inputText" placeholder="Voer hier complexe Nederlandse tekst in..." rows="10" cols="50"></textarea>
    <br>
    <button @click="simplifyText" :disabled="isLoading">Vereenvoudig Tekst</button>
    <div v-if="isLoading" class="loading-indicator">Aan het vereenvoudigen...</div>

    <h2>Vereenvoudigde Tekst:</h2>
    <div v-if="simplifiedText">
      <div class="simplified-text-container">
        <div class="tldr-section">
          <h3>Samenvatting voor Marketeers (TLDR):</h3>
          <p v-for="(part, index) in parsedSimplifiedText.tldr" :key="index" v-html="part"></p>
        </div>
        <div class="suggested-copy-section">
          <h3>Voorgestelde Tekst:</h3>
          <p v-html="parsedSimplifiedText.suggestedCopy"></p>
        </div>
      </div>
      <button @click="saveResult">Opslaan in geschiedenis</button>
    </div>
    <p v-else>Nog geen vereenvoudigde tekst.</p>

    <hr>

    <section>
      <h2>Woordenboek Beheer</h2>
      <div>
        <input type="text" v-model="newOriginalTerm" placeholder="Originele Term">
        <input type="text" v-model="newSimplifiedTerm" placeholder="Vereenvoudigde Term">
        <button v-if="!editingEntryId" @click="addDictionaryEntry">Toevoegen</button>
        <button v-else @click="updateDictionaryEntry">Bijwerken</button>
      </div>

      <h3>Bestaande Items</h3>
      <ul>
        <li v-for="entry in dictionaryEntries" :key="entry._id">
          {{ entry.originalTerm }} -> {{ entry.simplifiedTerm }}
          <button @click="editDictionaryEntry(entry)">Bewerken</button>
          <button @click="deleteDictionaryEntry(entry._id)">Verwijderen</button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
/* You can keep or remove existing styles as needed */
</style>