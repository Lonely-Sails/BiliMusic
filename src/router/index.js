import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/search', name: 'search', component: () => import('../views/SearchView.vue') },
  { path: '/playlist', name: 'playlist', component: () => import('../views/PlaylistView.vue') },
  { path: '/fav', name: 'fav', component: () => import('../views/FavView.vue') },
  {
    path: '/collection',
    name: 'collection',
    component: () => import('../views/CollectionView.vue'),
  },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
