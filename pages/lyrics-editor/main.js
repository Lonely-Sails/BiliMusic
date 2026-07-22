import { createApp } from 'vue'
import App from './App.vue'
import '../../src/utils/icon-init'

const app = createApp(App)
app.config.errorHandler = (err, _instance, info) => {
  console.error('LYRICS EDITOR ERROR:', err, info)
}
app.mount('#app')
