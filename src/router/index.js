import { createRouter, createWebHashHistory } from 'vue-router'
import SearchView from '../components/SearchView.vue'
import PlaylistView from '../components/PlaylistView.vue'
import FavView from '../components/FavView.vue'
import LyricsView from '../components/LyricsView.vue'
import SettingsView from '../components/SettingsView.vue'

const routes = [
  { path: '/', redirect: '/playlist' },
  { path: '/search', name: 'search', component: SearchView },
  { path: '/playlist', name: 'playlist', component: PlaylistView },
  { path: '/fav', name: 'fav', component: FavView },
  { path: '/lyrics', name: 'lyrics', component: LyricsView },
  { path: '/settings', name: 'settings', component: SettingsView }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
