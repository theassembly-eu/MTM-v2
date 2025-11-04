<script setup>
import { ref, onMounted } from 'vue';

const inputText = ref('');
const simplifiedText = ref(''); // Added comment to force rebuild and update logo
const selectedLanguage = ref('Dutch'); // New ref for selected language
const selectedTargetAudience = ref('Algemeen'); // New ref for selected target audience
const selectedOutputFormat = ref('Samenvatting'); // New ref for selected output format

const appVersion = ref('1.0.1'); // Set app version from package.json

// Dictionary management refs
const dictionaryEntries = ref([]);
const newOriginalTerm = ref('');
const newSimplifiedTerm = ref('');
const editingEntryId = ref(null);

// --- Dictionary Management Functions ---
async function fetchDictionaryEntries() {
  console.log('Fetching dictionary entries...');
  try {
    const response = await fetch('/api/dictionary');
    if (response.ok) {
      dictionaryEntries.value = await response.json();
      console.log('Fetched dictionary entries:', dictionaryEntries.value);
    } else {
      const errorText = await response.text();
      console.error('Fout bij ophalen woordenboek items:', errorText);
      alert(`Fout bij ophalen woordenboek items: ${errorText}`);
    }
  } catch (error) {
    console.error('Fout bij ophalen woordenboek items:', error);
    alert(`Netwerkfout bij ophalen woordenboek items: ${error.message}`);
  }
}

async function addDictionaryEntry() {
  console.log('Attempting to add dictionary entry...');
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
      console.log('Dictionary entry added successfully.');
      newOriginalTerm.value = '';
      newSimplifiedTerm.value = '';
      fetchDictionaryEntries(); // Refresh the list
    } else {
      const errorText = await response.text();
      console.error('Fout bij toevoegen woordenboek item:', errorText);
      alert(`Fout bij toevoegen: ${errorText}`);
    }
  } catch (error) {
    console.error('Fout bij toevoegen woordenboek item:', error);
    alert(`Netwerkfout: ${error.message}`);
  }
}

function editDictionaryEntry(entry) {
  console.log('Editing dictionary entry:', entry);
  editingEntryId.value = entry._id;
  newOriginalTerm.value = entry.originalTerm;
  newSimplifiedTerm.value = entry.simplifiedTerm;
}

async function updateDictionaryEntry() {
  console.log('Attempting to update dictionary entry...');
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
      console.log('Dictionary entry updated successfully.');
      editingEntryId.value = null;
      newOriginalTerm.value = '';
      newSimplifiedTerm.value = '';
      fetchDictionaryEntries(); // Refresh the list
    } else {
      const errorText = await response.text();
      console.error('Fout bij bijwerken woordenboek item:', errorText);
      alert(`Fout bij bijwerken: ${errorText}`);
    }
  } catch (error) {
    console.error('Fout bij bijwerken woordenboek item:', error);
    alert(`Netwerkfout bij bijwerken: ${error.message}`);
  }
}

async function deleteDictionaryEntry(id) {
  console.log('Attempting to delete dictionary entry:', id);
  if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return;
  try {
    const response = await fetch(`/api/dictionary/${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      console.log('Dictionary entry deleted successfully.');
      fetchDictionaryEntries(); // Refresh the list
    } else {
      const errorText = await response.text();
      console.error('Fout bij verwijderen woordenboek item:', errorText);
      alert(`Fout bij verwijderen: ${errorText}`);
    }
  } catch (error) {
    console.error('Fout bij verwijderen woordenboek item:', error);
    alert(`Netwerkfout bij verwijderen: ${error.message}`);
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