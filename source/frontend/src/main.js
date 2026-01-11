import './assets/main.css'
import clickOutside from './directives/clickOutside';

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { userStore } from './stores/userStore';

const app = createApp(App)

userStore.init();

app.use(router)

app.directive('click-outside', clickOutside);

app.mount('#app')
