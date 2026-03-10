<script setup>
import { useRoute } from 'vue-router'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Navbar from '@/components/NavbarComponent.vue'
import RouterViewWithErrorBoundary from '@/components/RouterViewWithErrorBoundary.vue'
import { userStore } from './stores/userStore'
import { getApiBase, getToken } from '@/api/client'
import axios from 'axios'

const { locale } = useI18n()

const isInitializing = ref(true)

function getEffectiveTheme() {
  const pref = userStore.user?.settings?.theme ?? 'dark'
  if (pref === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref === 'light' ? 'light' : 'dark'
}

function applyTheme() {
  if (typeof document === 'undefined') return
  const theme = getEffectiveTheme()
  document.documentElement.setAttribute('data-theme', theme)
}

let systemThemeQuery = null
function watchSystemTheme() {
  if (typeof window === 'undefined') return
  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeQuery.addEventListener('change', applyTheme)
}
function unwatchSystemTheme() {
  if (systemThemeQuery) {
    systemThemeQuery.removeEventListener('change', applyTheme)
    systemThemeQuery = null
  }
}

async function validateSession() {
  const token = getToken()

  if (!token) {
    userStore.clearUser()
    isInitializing.value = false
    return
  }

  try {
    const base = getApiBase()
    const { data } = await axios.get(`${base}/auth/isAuthed`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (data?.loggedIn && data.user) {
      userStore.setUser(data.user)
    } else {
      userStore.clearUser()
    }
  } catch (_e) {
    userStore.clearUser()
  } finally {
    isInitializing.value = false
  }
}

function onAuthChanged() {
  const token = getToken()
  if (!token) {
    userStore.clearUser()
    return
  }
  try {
    const raw = localStorage.getItem('melodia_user')
    if (raw) {
      const user = JSON.parse(raw)
      userStore.setUser(user)
    }
  } catch {
    userStore.clearUser()
  }
}

watch(
  () => userStore.user?.settings?.theme,
  () => applyTheme(),
  { immediate: false }
)

watch(
  () => userStore.user?.settings?.language,
  (lang) => {
    locale.value = (lang && ['de', 'en', 'fr'].includes(lang)) ? lang : 'de'
  },
  { immediate: true }
)

onMounted(() => {
  applyTheme()
  watchSystemTheme()
  validateSession()
  window.addEventListener('melodia-auth-changed', onAuthChanged)
})

onBeforeUnmount(() => {
  unwatchSystemTheme()
  window.removeEventListener('melodia-auth-changed', onAuthChanged)
})

const route = useRoute()
const showNavbar = computed(() => {
  return route.name !== 'game'
})
</script>

<template>
  <div v-if="isInitializing" class="loading-screen" aria-live="polite" aria-busy="true">
    <span class="loading-spinner" aria-hidden="true"></span>
    <span>{{ $t('common.loading') }}</span>
  </div>

  <div v-else>
    <Navbar v-if="showNavbar"/>
    <RouterViewWithErrorBoundary />
  </div>
</template>

<style scoped>
.loading-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: var(--bg, #050505);
  color: var(--text, rgba(255,255,255,0.78));
  font-weight: 500;
}
.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent-cyan, #00ecff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>