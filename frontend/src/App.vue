<script setup>
import { ref, onMounted } from 'vue';

const inputText = ref('');
const simplifiedText = ref(''); // Added comment to force rebuild
const selectedLanguage = ref('Dutch'); // New ref for selected language
const selectedTargetAudience = ref('Algemeen'); // New ref for selected target audience
const selectedOutputFormat = ref('Samenvatting'); // New ref for selected output format

// Dictionary management refs
const dictionaryEntries = ref([]);
const newOriginalTerm = ref('');
const newSimplifiedTerm = ref('');
const editingEntryId = ref(null);

// --- Dictionary Management Functions ---
async function fetchDictionaryEntries() {
  try {
    const response = await fetch('/api/dictionary');
    if (response.ok) {
      dictionaryEntries.value = await response.json();
    } else {
      console.error('Fout bij ophalen woordenboek items:', await response.text());
    }
  } catch (error) {
    console.error('Fout bij ophalen woordenboek items:', error);
  }
}

async function addDictionaryEntry() {
  if (!newOriginalTerm.value || !newSimplifiedTerm.value) {
    alert('Beide termen zijn verplicht!');
    return;
  }
  try {
    const response = await fetch('/api/dictionary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalTerm: newOriginalTerm.value, simplifiedTerm: newSimplifiedTerm.value }),
    });
    if (response.ok) {
      newOriginalTerm.value = '';
      newSimplifiedTerm.value = '';
      fetchDictionaryEntries(); // Refresh the list
    } else {
      console.error('Fout bij toevoegen woordenboek item:', await response.text());
    }
  } catch (error) {
    console.error('Fout bij toevoegen woordenboek item:', error);
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
    const response = await fetch(`/api/dictionary/${editingEntryId.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalTerm: newOriginalTerm.value, simplifiedTerm: newSimplifiedTerm.value }),
    });
    if (response.ok) {
      editingEntryId.value = null;
      newOriginalTerm.value = '';
      newSimplifiedTerm.value = '';
      fetchDictionaryEntries(); // Refresh the list
    } else {
      console.error('Fout bij bijwerken woordenboek item:', await response.text());
    }
  } catch (error) {
    console.error('Fout bij bijwerken woordenboek item:', error);
  }
}

async function deleteDictionaryEntry(id) {
  if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return;
  try {
    const response = await fetch(`/api/dictionary/${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      fetchDictionaryEntries(); // Refresh the list
    } else {
      console.error('Fout bij verwijderen woordenboek item:', await response.text());
    }
  } catch (error) {
    console.error('Fout bij verwijderen woordenboek item:', error);
  }
}

// --- Text Simplification Functions ---
async function simplifyText() {
  try {
    const response = await fetch('/api/simplify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: inputText.value, language: selectedLanguage.value, targetAudience: selectedTargetAudience.value, outputFormat: selectedOutputFormat.value }), // Pass selected language, target audience, and output format
    });
    const data = await response.json();
    if (response.ok) {
      simplifiedText.value = data.simplifiedText;
    } else {
      simplifiedText.value = `Fout: ${data.error}`;
    }
  } catch (error) {
    console.error('Fout bij vereenvoudigen tekst:', error);
    simplifiedText.value = 'Niet gelukt om tekst te vereenvoudigen.';
  }
}

onMounted(() => {
  fetchDictionaryEntries(); // Fetch dictionary entries on mount
});
</script>

<template>
  <div>
    <h1>MensentaalMachine</h1>

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
    <button @click="simplifyText">Vereenvoudig Tekst</button>

    <h2>Vereenvoudigde Tekst:</h2>
    <p>{{ simplifiedText }}</p>

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

<style scoped>
/* You can keep or remove existing styles as needed */
</style>