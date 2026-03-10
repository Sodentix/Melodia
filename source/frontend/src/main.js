import './assets/main.css'
import clickOutside from './directives/clickOutside';

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { userStore } from './stores/userStore'
const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  console.error('Vue error', err, info)
  // Don't set appError here - RouterViewWithErrorBoundary's onErrorCaptured handles
  // component tree errors. The global handler can catch async/watcher errors that
  // would otherwise show "Something went wrong" on every page.
}

userStore.init();

app.use(i18n)
app.use(router)

app.directive('click-outside', clickOutside);

app.mount('#app')
