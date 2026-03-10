<script setup>
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { getApiBase } from '@/api/client'
import FooterComponent from '@/components/FooterComponent.vue'

const router = useRouter()

const mode = ref('login')
const loginForm = reactive({
  email: '',
  password: '',
})
const registerForm = reactive({
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
})
const loading = ref(false)
const feedback = reactive({
  type: null,
  text: '',
})
const passwordErrors = ref([])

const { t } = useI18n()
const USERNAME_PATTERN = /^[a-z0-9_.-]+$/
const usernameRules = computed(() => {
  const u = (registerForm.username || '').trim().toLowerCase()
  return [{ text: t('auth.ruleUsername'), met: !u || USERNAME_PATTERN.test(u) }]
})
const passwordRules = computed(() => {
  const p = registerForm.password || ''
  const uc = (p.match(/[A-Z]/g) || []).length
  const num = (p.match(/[0-9]/g) || []).length
  const sp = (p.match(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/g) || []).length
  return [
    { text: t('auth.ruleMinLength'), met: p.length >= 12 },
    { text: t('auth.ruleUppercase'), met: uc >= 2 },
    { text: t('auth.ruleDigits'), met: num >= 2 },
    { text: t('auth.ruleSpecial'), met: sp >= 2 },
  ]
})

const apiRoot = getApiBase()
const authBase = apiRoot.endsWith('/auth') ? apiRoot : `${apiRoot}/auth`

const isRegister = computed(() => mode.value === 'register')

const clearFeedback = () => {
  feedback.type = null
  feedback.text = ''
  passwordErrors.value = []
}

const setFeedback = (type, text) => {
  feedback.type = type
  feedback.text = text
}

const switchMode = (nextMode) => {
  if (loading.value || mode.value === nextMode) return
  mode.value = nextMode
  clearFeedback()
}

const handleLogin = async () => {
  if (loading.value) return
  clearFeedback()

  const payload = {
    email: loginForm.email.trim().toLowerCase(),
    password: loginForm.password,
  }

  if (!payload.email || !payload.password) {
    setFeedback('error', t('auth.fillEmailPassword'))
    return
  }

  loading.value = true
  try {
    const response = await fetch(`${authBase}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (Array.isArray(data.errors)) passwordErrors.value = data.errors
      setFeedback('error', data.message || t('auth.loginFailed'))
      return
    }

    if (data.token) localStorage.setItem('melodia_token', data.token)
    if (data.user) localStorage.setItem('melodia_user', JSON.stringify(data.user))
    window.dispatchEvent(new CustomEvent('melodia-auth-changed'))

    setFeedback('success', t('auth.loginSuccess'))
    await router.push('/home')
  } catch (error) {
    console.error('Login request failed:', error)
    setFeedback('error', t('auth.networkError'))
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (loading.value) return
  clearFeedback()

  const payload = {
    firstName: registerForm.firstName.trim(),
    lastName: registerForm.lastName.trim(),
    username: registerForm.username.trim().toLowerCase(),
    email: registerForm.email.trim().toLowerCase(),
    password: registerForm.password,
  }

  const missing = Object.entries(payload)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    setFeedback('error', t('auth.fillFields', { fields: missing.join(', ') }))
    return
  }

  loading.value = true
  let shouldPrefillLogin = false

  try {
    const response = await fetch(`${authBase}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      passwordErrors.value = Array.isArray(data.errors) ? data.errors : []
      setFeedback('error', data.message || t('auth.registerFailed'))
      return
    }

    passwordErrors.value = []
    shouldPrefillLogin = true
    setFeedback('success', data.message || t('auth.registerSuccess'))
    mode.value = 'login'
  } catch (error) {
    console.error('Signup request failed:', error)
    setFeedback('error', t('auth.networkError'))
  } finally {
    if (shouldPrefillLogin) {
      loginForm.email = payload.email
      loginForm.password = ''
      registerForm.firstName = ''
      registerForm.lastName = ''
      registerForm.username = ''
      registerForm.email = ''
      registerForm.password = ''
    }
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-bg"></div>

    <div class="auth-layout">
      <!-- Brand panel (desktop) -->
      <aside class="brand-panel">
        <div class="brand-content">
          <h1 class="brand-logo">Melodia</h1>
          <p class="brand-tagline">{{ $t('auth.brandTagline') || 'Your music. Your game.' }}</p>
        </div>
      </aside>

      <!-- Form panel -->
      <main class="form-panel">
        <div class="form-card">
          <div class="tabs" role="tablist" :aria-label="$t('auth.modeToggleAria')">
            <button
              type="button"
              role="tab"
              class="tab"
              :class="{ active: !isRegister }"
              :aria-selected="!isRegister"
              :disabled="loading"
              @click="switchMode('login')"
            >
              {{ $t('auth.login') }}
            </button>
            <button
              type="button"
              role="tab"
              class="tab"
              :class="{ active: isRegister }"
              :aria-selected="isRegister"
              :disabled="loading"
              @click="switchMode('register')"
            >
              {{ $t('auth.register') }}
            </button>
            <span class="tab-indicator" :class="{ right: isRegister }" aria-hidden="true" />
          </div>

          <!-- Login -->
          <template v-if="!isRegister">
            <h2 class="form-title">{{ $t('auth.welcomeBack') }}</h2>
            <p class="form-subtitle">{{ $t('auth.welcomeBackSub') }}</p>
            <form class="auth-form" autocomplete="on" @submit.prevent="handleLogin">
              <div class="field">
                <label for="login-email">{{ $t('auth.email') }}</label>
                <input
                  id="login-email"
                  v-model.trim="loginForm.email"
                  type="email"
                  :placeholder="$t('auth.placeholderEmail')"
                  :disabled="loading"
                  required
                />
              </div>
              <div class="field">
                <label for="login-password">{{ $t('auth.password') }}</label>
                <input
                  id="login-password"
                  v-model="loginForm.password"
                  type="password"
                  :placeholder="$t('auth.placeholderPassword')"
                  :disabled="loading"
                  required
                />
              </div>
              <router-link :to="{ name: 'reset-password' }" class="forgot-link">
                {{ $t('auth.forgotPassword') }}
              </router-link>
              <p v-if="feedback.text" class="feedback" :class="`feedback--${feedback.type}`">
                {{ feedback.text }}
              </p>
              <button type="submit" class="submit-btn" :disabled="loading">
                <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
                <span v-else>{{ $t('auth.login') }}</span>
              </button>
            </form>
          </template>

          <!-- Register -->
          <template v-else>
            <h2 class="form-title">{{ $t('auth.createAccount') }}</h2>
            <p class="form-subtitle">{{ $t('auth.createAccountSub') }}</p>
            <form class="auth-form" autocomplete="on" @submit.prevent="handleRegister">
              <div class="field-row">
                <div class="field">
                  <label for="register-first-name">{{ $t('auth.firstName') }}</label>
                  <input
                    id="register-first-name"
                    v-model.trim="registerForm.firstName"
                    type="text"
                    :placeholder="$t('auth.placeholderFirstName')"
                    :disabled="loading"
                    required
                  />
                </div>
                <div class="field">
                  <label for="register-last-name">{{ $t('auth.lastName') }}</label>
                  <input
                    id="register-last-name"
                    v-model.trim="registerForm.lastName"
                    type="text"
                    :placeholder="$t('auth.placeholderLastName')"
                    :disabled="loading"
                    required
                  />
                </div>
              </div>
              <div class="field">
                <label for="register-username">{{ $t('auth.username') }}</label>
                <input
                  id="register-username"
                  v-model.trim="registerForm.username"
                  type="text"
                  :placeholder="$t('auth.placeholderUsername')"
                  :disabled="loading"
                  required
                />
                <small class="hint">{{ $t('auth.usernameHint') }}</small>
                <ul v-if="registerForm.username" class="validation-rules">
                  <li v-for="(r, i) in usernameRules" :key="i" :class="r.met ? 'met' : ''">
                    <span class="rule-icon">{{ r.met ? '✓' : '✗' }}</span>
                    {{ r.text }}
                  </li>
                </ul>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="register-email">{{ $t('auth.email') }}</label>
                  <input
                    id="register-email"
                    v-model.trim="registerForm.email"
                    type="email"
                    :placeholder="$t('auth.placeholderEmail')"
                    :disabled="loading"
                    required
                  />
                </div>
                <div class="field">
                  <label for="register-password">{{ $t('auth.password') }}</label>
                  <input
                    id="register-password"
                    v-model="registerForm.password"
                    type="password"
                    :placeholder="$t('auth.placeholderPasswordMin')"
                    :disabled="loading"
                    required
                  />
                </div>
              </div>
              <ul v-if="registerForm.password" class="validation-rules">
                <li v-for="(r, i) in passwordRules" :key="i" :class="r.met ? 'met' : ''">
                  <span class="rule-icon">{{ r.met ? '✓' : '✗' }}</span>
                  {{ r.text }}
                </li>
              </ul>
              <ul v-if="passwordErrors.length" class="password-errors">
                <li v-for="err in passwordErrors" :key="err">{{ err }}</li>
              </ul>
              <p v-if="feedback.text" class="feedback" :class="`feedback--${feedback.type}`">
                {{ feedback.text }}
              </p>
              <button type="submit" class="submit-btn" :disabled="loading">
                <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
                <span v-else>{{ $t('auth.register') }}</span>
              </button>
            </form>
          </template>
        </div>
      </main>
    </div>

    <FooterComponent />
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-top: 5rem;
  position: relative;
}

.auth-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(ellipse 70% 60% at 15% 30%, rgba(255, 79, 219, 0.15), transparent 50%),
    radial-gradient(ellipse 50% 50% at 85% 70%, rgba(5, 217, 255, 0.12), transparent 50%),
    linear-gradient(180deg, #05060c 0%, #080a14 40%, #060818 100%);
  pointer-events: none;
}

.auth-layout {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem 3rem;
  gap: 3rem;
}

/* Brand panel - desktop only */
.brand-panel {
  display: none;
}

.brand-content {
  max-width: 360px;
}

.brand-logo {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 1rem 0;
  background: linear-gradient(135deg, #ff4fdb, #05d9ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.brand-tagline {
  font-size: 1.15rem;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
  margin: 0;
}

/* Form panel */
.form-panel {
  width: 100%;
  max-width: 440px;
}

.form-card {
  background: rgba(10, 12, 28, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24px;
  padding: 2rem 2rem 2.5rem;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 79, 219, 0.06);
  backdrop-filter: blur(24px);
}

.tabs {
  position: relative;
  display: flex;
  padding: 4px;
  margin-bottom: 1.75rem;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.tab {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 0.7rem 1.25rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.25s ease;
}

.tab:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.9);
}

.tab.active {
  color: #0a0c14;
}

.tab:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.tab-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  border-radius: 10px;
  background: linear-gradient(135deg, #ff4fdb, #05d9ff);
  box-shadow: 0 4px 16px rgba(5, 217, 255, 0.3);
  transform: translateX(0);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tab-indicator.right {
  transform: translateX(100%);
}

.form-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #f4f6ff;
  margin: 0 0 0.35rem 0;
}

.form-subtitle {
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.6);
  margin: 0 0 1.5rem 0;
  line-height: 1.4;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.75);
}

.field input {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.field input:focus {
  outline: none;
  border-color: rgba(5, 217, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(5, 217, 255, 0.12);
}

.field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.hint {
  font-size: 0.72rem;
  color: rgba(234, 238, 255, 0.5);
  margin-top: 0.2rem;
}

.validation-rules {
  list-style: none;
  margin: 0.4rem 0 0;
  padding: 0;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.validation-rules li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 121, 131, 0.9);
}

.validation-rules li.met {
  color: rgba(80, 255, 210, 0.9);
}

.rule-icon {
  font-weight: 700;
  min-width: 1em;
}

.password-errors {
  margin: 0;
  padding-left: 1.2rem;
  color: #ff6b8a;
  font-size: 0.85rem;
  line-height: 1.4;
}

.forgot-link {
  font-size: 0.85rem;
  color: rgba(234, 238, 255, 0.7);
  text-decoration: none;
  margin: -0.25rem 0 0;
}

.forgot-link:hover {
  color: #05d9ff;
}

.feedback {
  margin: 0;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
}

.feedback--success {
  background: rgba(80, 255, 210, 0.12);
  color: #a8ffe8;
}

.feedback--error {
  background: rgba(255, 79, 131, 0.12);
  color: #ffd9e5;
}

.submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.85rem 1.5rem;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #ff4fdb, #05d9ff);
  color: #050505;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 8px 24px rgba(5, 217, 255, 0.25);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 32px rgba(5, 217, 255, 0.35);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(5, 16, 28, 0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: auth-spin 0.7s linear infinite;
}

@keyframes auth-spin {
  to { transform: rotate(360deg); }
}

/* Desktop: split layout with brand panel */
@media (min-width: 768px) {
  .auth-layout {
    max-width: 960px;
    margin: 0 auto;
    justify-content: space-between;
    gap: 3rem;
  }

  .brand-panel {
    display: block;
    flex: 1;
    max-width: 340px;
  }

  .form-panel {
    flex: 0 0 420px;
    max-width: none;
  }
}

/* Mobile */
@media (max-width: 600px) {
  .auth-layout {
    padding: 1.5rem 1rem 2rem;
  }

  .form-card {
    padding: 1.5rem 1.25rem 2rem;
  }

  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
