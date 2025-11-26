import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import './utils/axios.js' // Initialize axios configuration

createApp(App).use(router).mount('#app')
