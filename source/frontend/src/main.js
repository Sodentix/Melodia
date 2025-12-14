import './assets/main.css'
import clickOutside from './directives/clickOutside';

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(router)

app.directive('click-outside', clickOutside);

app.mount('#app')
