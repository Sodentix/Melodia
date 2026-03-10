<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getApiBase } from '@/api/client'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const status = ref('loading') // 'loading' | 'success' | 'error'
const message = ref('')

// Request new link form (shown on error)
const resendEmail = ref('')
const resendLoading = ref(false)
const resendSuccess = ref('')
const resendError = ref('')

const apiRoot = getApiBase()
const authBase = apiRoot.endsWith('/auth') ? apiRoot : `${apiRoot}/auth`

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token.trim() : ''
  if (!token) {
    status.value = 'error'
    message.value = t('verify.invalidLink')
    return
  }

  try {
    const res = await fetch(`${authBase}/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      status.value = 'success'
      message.value = data.message || t('verify.successMessage')
    } else {
      status.value = 'error'
      message.value = data.message || t('verify.invalidLink')
    }
  } catch (_e) {
    status.value = 'error'
    message.value = t('verify.networkError')
  }
})

async function requestNewLink() {
  const email = resendEmail.value.trim().toLowerCase()
  if (!email) return
  resendLoading.value = true
  resendSuccess.value = ''
  resendError.value = ''
  try {
    const res = await fetch(`${authBase}/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      resendSuccess.value = t('verify.resendSuccess')
      resendEmail.value = ''
    } else {
      resendError.value = data.message || t('verify.resendError')
    }
  } catch (_e) {
    resendError.value = t('verify.resendError')
  } finally {
    resendLoading.value = false
  }
}

function goToLogin() {
  router.push({ name: 'auth' })
}

function goToHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="verify-page">
    <div class="page-bg"></div>
    <div class="verify-card glass-card">
      <p class="brand brand-text">Melodia</p>

      <div v-if="status === 'loading'" class="verify-body" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>{{ $t('verify.loading') }}</p>
      </div>

      <div v-else-if="status === 'success'" class="verify-body">
        <div class="verify-icon success" aria-hidden="true">✓</div>
        <h1>{{ $t('verify.successTitle') }}</h1>
        <p class="verify-message">{{ message }}</p>
        <div class="verify-actions">
          <button type="button" class="btn btn--primary" @click="goToLogin">
            {{ $t('verify.toLogin') }}
          </button>
          <button type="button" class="btn btn--ghost" @click="goToHome">
            {{ $t('verify.toHome') }}
          </button>
        </div>
      </div>

      <div v-else class="verify-body">
        <div class="verify-icon error" aria-hidden="true">!</div>
        <h1>{{ $t('verify.errorTitle') }}</h1>
        <p class="verify-message">{{ message }}</p>
        <p class="verify-hint">{{ $t('verify.errorHint') }}</p>

        <div class="verify-resend">
          <p class="verify-resend-label">{{ $t('verify.requestNewLink') }}</p>
          <form class="verify-resend-form" @submit.prevent="requestNewLink">
            <input
              v-model="resendEmail"
              type="email"
              :placeholder="$t('auth.placeholderEmail')"
              class="verify-input"
              :disabled="resendLoading"
              required
            />
            <button type="submit" class="btn btn--primary" :disabled="resendLoading">
              {{ resendLoading ? '...' : $t('verify.resendButton') }}
            </button>
          </form>
          <p v-if="resendSuccess" class="verify-resend-success">{{ resendSuccess }}</p>
          <p v-if="resendError" class="verify-resend-error">{{ resendError }}</p>
        </div>

        <div class="verify-actions">
          <button type="button" class="btn btn--primary" @click="goToLogin">
            {{ $t('verify.toLogin') }}
          </button>
          <button type="button" class="btn btn--ghost" @click="goToHome">
            {{ $t('verify.toHome') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verify-page {
  min-height: calc(100vh - 5rem);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  padding-top: 7rem;
  position: relative;
}

.verify-card {
  width: 100%;
  max-width: 420px;
  padding: 2.4rem 2.4rem 2.8rem;
}

.brand {
  font-size: 1.35rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  font-weight: 600;
  background: linear-gradient(120deg, #cf2dff 5%, #05d9ff 95%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 2rem;
}

.verify-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.verify-body h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f4f6ff;
  margin: 0;
}

.verify-message {
  color: rgba(234, 238, 255, 0.85);
  font-size: 0.95rem;
  margin: 0;
}

.verify-hint {
  color: rgba(234, 238, 255, 0.6);
  font-size: 0.88rem;
  margin: 0;
}

.verify-resend {
  width: 100%;
  margin-top: 0.5rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.verify-resend-label {
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.85);
  margin: 0 0 0.75rem 0;
}

.verify-resend-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.verify-input {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 0.9rem;
}

.verify-input:focus {
  outline: none;
  border-color: rgba(5, 217, 255, 0.5);
}

.verify-resend-success {
  margin: 0.5rem 0 0;
  font-size: 0.88rem;
  color: #50ffd2;
}

.verify-resend-error {
  margin: 0.5rem 0 0;
  font-size: 0.88rem;
  color: #ff4f83;
}

.verify-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 700;
}

.verify-icon.success {
  background: rgba(80, 255, 210, 0.2);
  border: 1px solid rgba(80, 255, 210, 0.4);
  color: #50ffd2;
}

.verify-icon.error {
  background: rgba(255, 79, 131, 0.2);
  border: 1px solid rgba(255, 79, 131, 0.4);
  color: #ff4f83;
}

.verify-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.16);
  border-top-color: #05d9ff;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

</style>
