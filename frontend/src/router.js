import { createRouter, createWebHistory } from 'vue-router';
import Home from './components/Home.vue';
import HistoryPage from './components/HistoryPage.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/history',
    name: 'History',
    component: HistoryPage,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;