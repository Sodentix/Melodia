import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '@/api/client'

function requireAuth(_to, _from, next) {
  if (getToken()) {
    next()
  } else {
    next({ name: 'auth' })
  }
}

function requireAuthForOwnProfile(to, _from, next) {
  if (!to.params.username && !getToken()) {
    next({ name: 'auth' })
  } else {
    next()
  }
}

function redirectIfAuthed(_to, _from, next) {
  if (getToken()) {
    next({ name: 'home' })
  } else {
    next()
  }
}

function requireAdmin(to, _from, next) {
  if (!getToken()) {
    next({ name: 'auth' })
    return
  }
  next()
}

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
      meta: { title: 'Home' },
    },
    {
      path: '/game',
      name: 'game-select',
      component: () => import('@/views/GameSelectView.vue'),
      beforeEnter: requireAuth,
      meta: { title: 'Choose Game' },
    },
    {
      path: '/game/play',
      name: 'game',
      component: () => import('@/views/GameView.vue'),
      beforeEnter: requireAuth,
      meta: { title: 'Play' },
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/views/AuthView.vue'),
      alias: ['/login', '/register'],
      beforeEnter: redirectIfAuthed,
      meta: { title: 'Login' },
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('@/views/VerifyEmailView.vue'),
      meta: { title: 'Verify Email' },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
      meta: { title: 'Reset Password' },
    },
    {
      path: '/verify-new-email',
      name: 'verify-new-email',
      component: () => import('@/views/VerifyNewEmailView.vue'),
      meta: { title: 'Verify Email' },
    },
    {
      path: '/profile/:username?',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      beforeEnter: requireAuthForOwnProfile,
      meta: { title: 'Profile' },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      beforeEnter: requireAdmin,
      meta: { title: 'Admin' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      beforeEnter: requireAuth,
      meta: { title: 'Settings' },
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/PrivacyView.vue'),
      meta: { title: 'Privacy Policy' },
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/views/TermsView.vue'),
      meta: { title: 'Terms of Service' },
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

router.beforeEach((to, _from, next) => {
  document.title = to.meta?.title ? `${to.meta.title} | Melodia` : 'Melodia'
  next()
})

export default router
