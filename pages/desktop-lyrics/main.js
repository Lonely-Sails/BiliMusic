import { createApp } from 'vue'
import App from './App.vue'
import '../../src/utils/icon-init'

const app = createApp(App)
app.config.errorHandler = (err, _instance, info) => {
  console.error('DESKTOP LYRICS ERROR:', err, info)
}
app.mount('#app')
