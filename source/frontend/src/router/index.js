import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/home'
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/game',
      name: 'game-select',
      component: () => import('@/views/GameSelectView.vue'),
    },
    {
      path: '/game/play',
      name: 'game',
      component: () => import('@/views/GameView.vue'),
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/views/AuthView.vue'),
      alias: ['/login', '/register'],
    },
    {
      path: '/profile/:username?',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
    }
  ],

  scrollBehavior(to, from, savedPosition) {
    // Wenn es eine gespeicherte Position gibt (z. B. beim "Zurück"-Button)
    if (savedPosition) {
      return savedPosition
    }

    // Wenn ein Hash wie #features in der URL ist
    if (to.hash) {
      return {
        el: to.hash,        // scrollt zum Element mit dieser ID
        behavior: 'smooth', 
      }
    }

    // Standard: immer nach oben scrollen
    return { top: 0, behavior: 'smooth' }
  },
})

export default router
