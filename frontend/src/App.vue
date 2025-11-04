<script setup>
import { ref, onMounted } from 'vue';

const inputText = ref('');
const simplifiedText = ref('');
const message = ref('Hello from frontend!');
const backendMessage = ref('');

async function fetchBackendMessage() {
  try {
    const response = await fetch('/api/hello');
    const data = await response.json();
    backendMessage.value = data.message;
  } catch (error) {
    console.error('Error fetching backend message:', error);
    backendMessage.value = 'Error fetching message from backend.';
  }
}

async function simplifyText() {
  try {
    const response = await fetch('/api/simplify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: inputText.value }),
    });
    const data = await response.json();
    if (response.ok) {
      simplifiedText.value = data.simplifiedText;
    } else {
      simplifiedText.value = `Error: ${data.error}`;
    }
  } catch (error) {
    console.error('Error simplifying text:', error);
    simplifiedText.value = 'Failed to simplify text.';
  }
}

onMounted(fetchBackendMessage);
</script>

<template>
  <div>
    <h1>MensentaalMachine</h1>
    <p>{{ message }}</p>
    <p>{{ backendMessage }}</p>

    <textarea v-model="inputText" placeholder="Enter complex Dutch text here..." rows="10" cols="50"></textarea>
    <br>
    <button @click="simplifyText">Simplify Text</button>

    <h2>Simplified Text:</h2>
    <p>{{ simplifiedText }}</p>
  </div>
</template>

<style scoped>
/* You can keep or remove existing styles as needed */
</style>