import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../components/views/HomeView.vue'
import SearchView from '../components/views/SearchView.vue'
import PlaylistView from '../components/views/PlaylistView.vue'
import FavView from '../components/views/FavView.vue'
import SettingsView from '../components/views/SettingsView.vue'

const routes = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'home', component: HomeView },
  { path: '/search', name: 'search', component: SearchView },
  { path: '/playlist', name: 'playlist', component: PlaylistView },
  { path: '/fav', name: 'fav', component: FavView },
  { path: '/settings', name: 'settings', component: SettingsView }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
