<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getApiBase } from '@/api/client'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const mode = computed(() => (route.query.token ? 'reset' : 'request'))

const requestEmail = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const status = ref(null)
const message = ref('')
const passwordErrors = ref([])

const apiRoot = getApiBase()
const authBase = apiRoot.endsWith('/auth') ? apiRoot : `${apiRoot}/auth`

async function submitRequest() {
  if (!requestEmail.value.trim()) {
    message.value = t('reset.enterEmail')
    status.value = 'error'
    return
  }
  loading.value = true
  status.value = null
  message.value = ''
  try {
    const res = await fetch(`${authBase}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: requestEmail.value.trim().toLowerCase() }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      status.value = 'success'
      message.value = data.message || t('reset.requestSuccess')
    } else {
      status.value = 'error'
      message.value = data.message || t('reset.requestFailed')
    }
  } catch (_e) {
    status.value = 'error'
    message.value = t('reset.networkError')
  } finally {
    loading.value = false
  }
}

async function submitReset() {
  const token = typeof route.query.token === 'string' ? route.query.token.trim() : ''
  if (!token) {
    message.value = t('reset.invalidLink')
    status.value = 'error'
    return
  }
  if (newPassword.value.length < 12) {
    message.value = t('reset.passwordMin')
    status.value = 'error'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    message.value = t('reset.passwordMismatch')
    status.value = 'error'
    return
  }
  loading.value = true
  status.value = null
  message.value = ''
  passwordErrors.value = []
  try {
    const res = await fetch(`${authBase}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token, newPassword: newPassword.value }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      status.value = 'success'
      message.value = data.message || t('reset.resetSuccess')
    } else {
      status.value = 'error'
      message.value = data.message || t('reset.invalidLink')
      if (Array.isArray(data.errors)) passwordErrors.value = data.errors
    }
  } catch (_e) {
    status.value = 'error'
    message.value = t('reset.networkError')
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  router.push({ name: 'auth' })
}
</script>

<template>
  <div class="reset-page">
    <div class="page-bg"></div>
    <div class="reset-card glass-card">
      <p class="brand brand-text">Melodia</p>

      <template v-if="mode === 'request'">
        <h1>{{ $t('reset.title') }}</h1>
        <p class="reset-hint">{{ $t('reset.hint') }}</p>
        <form class="reset-form" @submit.prevent="submitRequest">
          <label for="reset-email">{{ $t('reset.email') }}</label>
          <input
            id="reset-email"
            v-model="requestEmail"
            type="email"
            :placeholder="$t('auth.placeholderEmail')"
            :disabled="loading"
            required
          />
          <p v-if="message" class="reset-feedback" :class="status">{{ message }}</p>
          <button type="submit" class="btn btn--primary" :disabled="loading">
            {{ loading ? $t('reset.sending') : $t('reset.requestLink') }}
          </button>
        </form>
      </template>

      <template v-else>
        <h1>{{ $t('reset.newPassword') }}</h1>
        <p class="reset-hint">{{ $t('reset.newPasswordHint') }}</p>
        <form class="reset-form" @submit.prevent="submitReset">
          <label for="reset-new">{{ $t('reset.newPasswordLabel') }}</label>
          <input
            id="reset-new"
            v-model="newPassword"
            type="password"
            :placeholder="$t('reset.placeholderNew')"
            :disabled="loading"
            required
          />
          <label for="reset-confirm">{{ $t('reset.confirmLabel') }}</label>
          <input
            id="reset-confirm"
            v-model="confirmPassword"
            type="password"
            :placeholder="$t('reset.placeholderConfirm')"
            :disabled="loading"
            required
          />
          <ul v-if="passwordErrors.length" class="password-errors">
            <li v-for="err in passwordErrors" :key="err">{{ err }}</li>
          </ul>
          <p v-if="message" class="reset-feedback" :class="status">{{ message }}</p>
          <button type="submit" class="btn btn--primary" :disabled="loading">
            {{ loading ? $t('reset.saving') : $t('reset.savePassword') }}
          </button>
        </form>
      </template>

      <p class="reset-footer">
        <button type="button" class="btn btn--ghost" @click="goToLogin">
          {{ $t('reset.toLogin') }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.reset-page {
  min-height: calc(100vh - 5rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  padding-top: 7rem;
  position: relative;
}

.reset-card {
  width: 100%;
  max-width: 420px;
  padding: 2.4rem 2.4rem 2.8rem;
  border-radius: 24px;
}

.reset-card .brand {
  margin-bottom: 1.5rem;
}

.reset-card h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f4f6ff;
  margin: 0 0 0.5rem 0;
}

.reset-hint {
  color: rgba(234, 238, 255, 0.7);
  font-size: 0.9rem;
  margin: 0 0 1.25rem 0;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reset-form label {
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.7);
}

.reset-form input {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.95rem;
}

.reset-form input:focus {
  outline: none;
  border-color: rgba(5, 217, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(5, 217, 255, 0.12);
}

.reset-feedback {
  padding: 0.5rem 0;
  font-size: 0.9rem;
}

.reset-feedback.success { color: #50ffd2; }
.reset-feedback.error { color: #ff4f83; }

.password-errors {
  margin: 0;
  padding-left: 1.2rem;
  color: #ff4f83;
  font-size: 0.85rem;
}

.btn.btn--primary {
  margin-top: 0.25rem;
}

.reset-footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn.btn--ghost {
  background: none;
  border: none;
  text-decoration: underline;
}

.btn.btn--ghost:hover { color: #05d9ff; }
</style>
