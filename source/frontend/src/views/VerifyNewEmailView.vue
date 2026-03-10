<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getApiBase } from '@/api/client'

const route = useRoute()
const router = useRouter()

const { t } = useI18n()

const status = ref('loading')
const message = ref('')

const apiRoot = getApiBase()
const authBase = apiRoot.endsWith('/auth') ? apiRoot : `${apiRoot}/auth`

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token.trim() : ''
  if (!token) {
    status.value = 'error'
    message.value = t('verifyNewEmail.invalidLink')
    return
  }

  try {
    const res = await fetch(`${authBase}/verify-new-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      status.value = 'success'
      message.value = data.message || t('verifyNewEmail.successMessage')
    } else {
      status.value = 'error'
      message.value = data.message || t('verifyNewEmail.invalidLink')
    }
  } catch (_e) {
    status.value = 'error'
    message.value = t('verifyNewEmail.networkError')
  }
})

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
        <p>{{ $t('verifyNewEmail.loading') }}</p>
      </div>

      <div v-else-if="status === 'success'" class="verify-body">
        <div class="verify-icon success" aria-hidden="true">✓</div>
        <h1>{{ $t('verifyNewEmail.successTitle') }}</h1>
        <p class="verify-message">{{ message }}</p>
        <div class="verify-actions">
          <button type="button" class="btn btn--primary" @click="goToLogin">
            {{ $t('verifyNewEmail.toLogin') }}
          </button>
          <button type="button" class="btn btn--ghost" @click="goToHome">
            {{ $t('verifyNewEmail.toHome') }}
          </button>
        </div>
      </div>

      <div v-else class="verify-body">
        <div class="verify-icon error" aria-hidden="true">!</div>
        <h1>{{ $t('verifyNewEmail.errorTitle') }}</h1>
        <p class="verify-message">{{ message }}</p>
        <div class="verify-actions">
          <button type="button" class="btn btn--primary" @click="goToLogin">
            {{ $t('verifyNewEmail.toLogin') }}
          </button>
          <button type="button" class="btn btn--ghost" @click="goToHome">
            {{ $t('verifyNewEmail.toHome') }}
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
  border-radius: 24px;
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
