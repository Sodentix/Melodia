<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getApiBase, getToken, clearSession } from '@/api/client'
import { userStore } from '@/stores/userStore'

const { t } = useI18n()
const apiRoot = getApiBase()
const usersBase = apiRoot.endsWith('/users') ? apiRoot : `${apiRoot}/users`

const loading = ref(true)
const saving = ref(false)
const feedback = ref(null)
const error = ref(null)

const theme = ref('dark')
const language = ref('de')
const soundEnabled = ref(true)
const notifications = ref(true)
const showStatsOnHome = ref(true)
const reducedMotion = ref(false)

const showDeleteConfirm = ref(false)
const deletePassword = ref('')
const deleteLoading = ref(false)

const themeOptions = computed(() => [
  { value: 'dark', label: t('settings.themeDark') },
  { value: 'light', label: t('settings.themeLight') },
  { value: 'system', label: t('settings.themeSystem') },
])
const languageOptions = computed(() => [
  { value: 'de', label: t('settings.languageDe') },
  { value: 'en', label: t('settings.languageEn') },
  { value: 'fr', label: t('settings.languageFr') },
])

onMounted(async () => {
  loading.value = true
  error.value = null
  const token = getToken()
  if (!token || !usersBase) {
    loading.value = false
    error.value = t('settings.pleaseLogin')
    return
  }
  try {
    const res = await fetch(`${usersBase}/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      credentials: 'include',
    })
    if (!res.ok) {
      error.value = t('settings.loadError')
      return
    }
    const data = await res.json()
    const s = data.settings || {}
    theme.value = s.theme ?? 'dark'
    language.value = s.language ?? 'de'
    soundEnabled.value = s.soundEnabled !== false
    notifications.value = s.notifications !== false
    showStatsOnHome.value = s.showStatsOnHome !== false
    reducedMotion.value = Boolean(s.reducedMotion)
    if (data.userRole) userStore.user = { ...userStore.user, userRole: data.userRole }
    if (data.settings) userStore.setUser({ ...userStore.user, settings: data.settings })
  } catch (_e) {
    error.value = t('settings.networkError')
  } finally {
    loading.value = false
  }
})

async function save() {
  if (!usersBase) return
  const token = getToken()
  if (!token) {
    feedback.value = { type: 'error', text: t('settings.pleaseLogin') }
    return
  }
  saving.value = true
  feedback.value = null
  try {
    const res = await fetch(`${usersBase}/me/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        theme: theme.value,
        language: language.value,
        soundEnabled: soundEnabled.value,
        notifications: notifications.value,
        showStatsOnHome: showStatsOnHome.value,
        reducedMotion: reducedMotion.value,
      }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      feedback.value = { type: 'error', text: data.message || t('settings.saveError') }
      return
    }
    feedback.value = { type: 'success', text: t('settings.saveSuccess') }
    if (userStore.user) {
      userStore.setUser({
        ...userStore.user,
        ...(data.user || {}),
        settings: data.settings || userStore.user.settings,
      })
    }
  } catch (_e) {
    feedback.value = { type: 'error', text: t('settings.networkError') }
  } finally {
    saving.value = false
  }
}

async function deleteAccount() {
  if (!usersBase) return
  const token = getToken()
  if (!token) {
    feedback.value = { type: 'error', text: t('settings.pleaseLogin') }
    return
  }
  if (!deletePassword.value.trim()) {
    feedback.value = { type: 'error', text: t('settings.deleteAccountConfirm') }
    return
  }
  deleteLoading.value = true
  feedback.value = null
  try {
    const res = await fetch(`${usersBase}/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({ password: deletePassword.value }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      feedback.value = { type: 'error', text: data.message || t('settings.deleteError') }
      return
    }
    showDeleteConfirm.value = false
    deletePassword.value = ''
    clearSession()
    userStore.clearUser()
    window.dispatchEvent(new CustomEvent('melodia-auth-changed'))
    feedback.value = { type: 'success', text: t('settings.deleteAccountSuccess') }
    setTimeout(() => {
      window.location.href = '/'
    }, 1500)
  } catch (_e) {
    feedback.value = { type: 'error', text: t('settings.networkError') }
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="page-bg"></div>
    <div class="card glass-card settings-card">
      <h1 class="card__title">{{ $t('settings.title') }}</h1>

      <div v-if="loading" class="page-loading">
        <div class="spinner" aria-hidden="true"></div>
        <p>{{ $t('settings.loading') }}</p>
      </div>

      <div v-else-if="error" class="page-error">
        <p>{{ error }}</p>
      </div>

      <template v-else>
        <p v-if="feedback" class="feedback" :class="`feedback--${feedback.type}`">
          {{ feedback.text }}
        </p>

        <div class="settings-form">
          <section class="settings-section">
            <h2 class="settings-section__title">{{ $t('settings.appearance') }}</h2>
            <div class="form-row">
              <label for="setting-theme" class="form-label">{{ $t('settings.theme') }}</label>
              <select id="setting-theme" v-model="theme" class="form-select">
                <option v-for="opt in themeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="form-row">
              <label for="setting-language" class="form-label">{{ $t('settings.language') }}</label>
              <select id="setting-language" v-model="language" class="form-select">
                <option v-for="opt in languageOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </section>

          <section class="settings-section">
            <h2 class="settings-section__title">{{ $t('settings.audio') }}</h2>
            <div class="form-row form-row--switch">
              <label for="setting-sound" class="form-label">{{ $t('settings.sound') }}</label>
              <input id="setting-sound" v-model="soundEnabled" type="checkbox" />
            </div>
          </section>

          <section class="settings-section">
            <h2 class="settings-section__title">{{ $t('settings.preferences') }}</h2>
            <div class="form-row form-row--switch">
              <label for="setting-notifications" class="form-label">{{ $t('settings.notifications') }}</label>
              <input id="setting-notifications" v-model="notifications" type="checkbox" />
            </div>
            <div class="form-row form-row--switch">
              <label for="setting-show-stats" class="form-label">{{ $t('settings.showStatsOnHome') }}</label>
              <input id="setting-show-stats" v-model="showStatsOnHome" type="checkbox" />
            </div>
            <div class="form-row form-row--switch">
              <label for="setting-reduced-motion" class="form-label">{{ $t('settings.reducedMotion') }}</label>
              <input id="setting-reduced-motion" v-model="reducedMotion" type="checkbox" />
            </div>
          </section>

          <button type="button" class="btn btn--primary" :disabled="saving" @click="save">
            {{ saving ? $t('settings.saving') : $t('common.save') }}
          </button>

          <div class="danger-zone">
            <h2 class="danger-zone__title">{{ $t('settings.deleteAccount') }}</h2>
            <p class="danger-zone__desc">{{ $t('settings.deleteAccountDesc') }}</p>
            <div v-if="!showDeleteConfirm">
              <button type="button" class="btn btn--danger" @click="showDeleteConfirm = true">
                {{ $t('settings.deleteAccountButton') }}
              </button>
            </div>
            <div v-else class="danger-zone__form">
              <p class="danger-zone__hint">{{ $t('settings.deleteAccountConfirm') }}</p>
              <input
                v-model="deletePassword"
                type="password"
                :placeholder="$t('settings.deleteAccountPlaceholder')"
                class="danger-zone__input form-input"
                :disabled="deleteLoading"
              >
              <div class="danger-zone__actions">
                <button type="button" class="btn btn--ghost" :disabled="deleteLoading" @click="showDeleteConfirm = false; deletePassword = ''">
                  {{ $t('common.cancel') }}
                </button>
                <button type="button" class="btn btn--danger" :disabled="deleteLoading || !deletePassword.trim()" @click="deleteAccount">
                  {{ deleteLoading ? $t('settings.deleting') : $t('settings.deleteAccountButton') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: calc(100vh - 5rem);
  padding: 3rem 2rem;
  padding-top: 7rem;
  position: relative;
}

.settings-card {
  max-width: 560px;
  margin: 0 auto;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.settings-section {
  padding-top: 0.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.settings-section__title {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.85);
  margin: 0 0 0.75rem 0;
}

.btn.btn--primary {
  align-self: flex-start;
  margin-top: 0.5rem;
}
</style>
