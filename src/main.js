import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import { i18n } from './i18n.js'

const app = createApp(App)

app.use(createPinia())
app.use(ui)
app.use(i18n)

app.mount('#app')
