import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import './styles/ui.css'
import './utils/icon-init'

// Global error handler for debugging
window.onerror = (msg, url, line, col, err) => {
  console.error('GLOBAL ERROR:', msg, err?.stack)
  return true
}
window.addEventListener('unhandledrejection', (e) => {
  console.error('UNHANDLED REJECTION:', e.reason?.stack || e.reason)
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.config.errorHandler = (err, _instance, info) => {
  console.error('VUE ERROR:', err, info)
}
app.mount('#app')
