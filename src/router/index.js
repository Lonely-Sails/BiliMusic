import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
	{ path: '/', redirect: '/home' },
	{ path: '/home', name: 'home', component: () => import('../components/views/HomeView.vue') },
	{ path: '/search', name: 'search', component: () => import('../components/views/SearchView.vue') },
	{ path: '/playlist', name: 'playlist', component: () => import('../components/views/PlaylistView.vue') },
	{ path: '/fav', name: 'fav', component: () => import('../components/views/FavView.vue') },
	{ path: '/collection', name: 'collection', component: () => import('../components/views/CollectionView.vue') },
	{ path: '/settings', name: 'settings', component: () => import('../components/views/SettingsView.vue') },
];

const router = createRouter({
	history: createWebHashHistory(),
	routes,
});

export default router;
