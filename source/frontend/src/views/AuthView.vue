<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

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

const apiRoot = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : ''

const authBase = apiRoot.endsWith('/auth') ? apiRoot : `${apiRoot}/auth`

const isRegister = computed(() => mode.value === 'register')

const panelHeading = computed(() =>
  isRegister.value ? 'Schon zurück?' : 'Neu bei Melodia?'
)

const panelCopy = computed(() =>
  isRegister.value
    ? 'Melde dich an und knüpfe an deine letzten Chart-Erfolge an.'
    : 'Erstelle dein Konto und stürze dich in die Beat-Battles.'
)

const panelCta = computed(() =>
  isRegister.value ? 'Zum Login wechseln' : 'Jetzt registrieren'
)

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
  if (loading.value || mode.value === nextMode) {
    return
  }
  mode.value = nextMode
  clearFeedback()
}

const toggleMode = () => {
  switchMode(isRegister.value ? 'login' : 'register')
}

const handleLogin = async () => {
  if (loading.value) {
    return
  }

  clearFeedback()

  const payload = {
    email: loginForm.email.trim().toLowerCase(),
    password: loginForm.password,
  }

  if (!payload.email || !payload.password) {
    setFeedback('error', 'Bitte fuelle E-Mail und Passwort aus.')
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
      if (Array.isArray(data.errors)) {
        passwordErrors.value = data.errors
      }
      setFeedback('error', data.message || 'Login fehlgeschlagen.')
      return
    }

    if (data.token) {
      localStorage.setItem('melodia_token', data.token)
    }
    if (data.user) {
      localStorage.setItem('melodia_user', JSON.stringify(data.user))
    }
    window.dispatchEvent(new CustomEvent('melodia-auth-changed'))

    setFeedback('success', 'Login erfolgreich. Weiterleitung...')
    await router.push('/home')
  } catch (error) {
    console.error('Login request failed:', error)
    setFeedback('error', 'Netzwerkfehler. Bitte versuche es erneut.')
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (loading.value) {
    return
  }

  clearFeedback()

  const payload = {
    firstName: registerForm.firstName.trim(),
    lastName: registerForm.lastName.trim(),
    username: registerForm.username.trim().toLowerCase(),
    email: registerForm.email.trim().toLowerCase(),
    password: registerForm.password,
  }

  console.log('Register payload:', payload)

  const missing = Object.entries(payload)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    setFeedback('error', `Bitte fuelle folgende Felder aus: ${missing.join(', ')}`)
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
      setFeedback('error', data.message || 'Registrierung fehlgeschlagen.')
      return
    }

    passwordErrors.value = []
    shouldPrefillLogin = true

    setFeedback(
      'success',
      data.message || 'Registrierung erfolgreich. Bitte E-Mail bestaetigen.'
    )

    mode.value = 'login'
  } catch (error) {
    console.error('Signup request failed:', error)
    setFeedback('error', 'Netzwerkfehler. Bitte versuche es erneut.')
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
    <div class="auth-card" :class="{ 'show-register': isRegister, loading: loading }">
      <header class="card-header">
        <p class="brand">
          <span>Melodia</span>
        </p>
        <div
          class="mode-toggle"
          role="tablist"
          aria-label="Zwischen Login und Registrierung wechseln"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="!isRegister"
            :class="{ active: !isRegister }"
            :disabled="loading"
            @click="switchMode('login')"
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="isRegister"
            :class="{ active: isRegister }"
            :disabled="loading"
            @click="switchMode('register')"
          >
            Register
          </button>
          <span class="mode-indicator" :class="{ right: isRegister }" aria-hidden="true" />
        </div>
      </header>

      <div class="card-body">
        <div class="form-window">
          <div v-if="feedback.text" class="form-feedback" :class="feedback.type">
            <p>{{ feedback.text }}</p>
          </div>

          <div class="form-wrapper">
            <section class="form-container login" aria-live="polite">
              <header class="form-headline">
                <h2>Willkommen zurück</h2>
                <p>Logge dich ein und starte die nächste Session.</p>
              </header>
              <form class="form" autocomplete="on" @submit.prevent="handleLogin">
                <div class="split-fields">
                  <div class="field">
                    <label for="login-email">E-Mail-Adresse</label>
                    <input
                      id="login-email"
                      v-model.trim="loginForm.email"
                      type="email"
                      name="email"
                      autocomplete="email"
                      placeholder="name@email.com"
                      :disabled="loading"
                      required
                    >
                  </div>
                  <div class="field">
                    <label for="login-password">Passwort</label>
                    <input
                      id="login-password"
                      v-model="loginForm.password"
                      type="password"
                      name="password"
                      autocomplete="current-password"
                      placeholder="********"
                      :disabled="loading"
                      required
                    >
                  </div>
                </div>
                <div class="form-footer">
                  <a href="#" class="ghost-link">Passwort vergessen?</a>
                  <button type="submit" class="primary-action" :disabled="loading">
                    Login
                  </button>
                </div>
              </form>
            </section>

            <section class="form-container register" aria-live="polite">
              <header class="form-headline">
                <h2>Account erstellen</h2>
                <p>Sichere dir deinen Namen in den Charts.</p>
              </header>
              <form class="form" autocomplete="on" @submit.prevent="handleRegister">
                <div class="split-fields">
                  <div class="field">
                    <label for="register-first-name">Vorname</label>
                    <input
                      id="register-first-name"
                      v-model.trim="registerForm.firstName"
                      type="text"
                      name="firstName"
                      autocomplete="given-name"
                      placeholder="Max"
                      :disabled="loading"
                      required
                    >
                  </div>
                  <div class="field">
                    <label for="register-last-name">Nachname</label>
                    <input
                      id="register-last-name"
                      v-model.trim="registerForm.lastName"
                      type="text"
                      name="lastName"
                      autocomplete="family-name"
                      placeholder="Mustermann"
                      :disabled="loading"
                      required
                    >
                  </div>
                </div>
                <div class="field">
                  <label for="register-username">Username</label>
                  <input
                    id="register-username"
                    v-model.trim="registerForm.username"
                    type="text"
                    name="username"
                    autocomplete="nickname"
                    placeholder="beatmaster"
                    :disabled="loading"
                    required
                  >
                  <small class="field-hint">
                    Kleinschreibung, Zahlen und _.- sind erlaubt.
                  </small>
                </div>
                <div class="split-fields">
                  <div class="field">
                    <label for="register-email">E-Mail-Adresse</label>
                    <input
                      id="register-email"
                      v-model.trim="registerForm.email"
                      type="email"
                      name="email"
                      autocomplete="email"
                      placeholder="name@email.com"
                      :disabled="loading"
                      required
                    >
                  </div>
                  <div class="field">
                    <label for="register-password">Passwort</label>
                    <input
                      id="register-password"
                      v-model="registerForm.password"
                      type="password"
                      name="password"
                      autocomplete="new-password"
                      placeholder="Mindestens 12 Zeichen"
                      :disabled="loading"
                      required
                    >
                  </div>
                </div>
                <ul v-if="passwordErrors.length" class="password-errors">
                  <li v-for="error in passwordErrors" :key="error">
                    {{ error }}
                  </li>
                </ul>
                <button type="submit" class="primary-action" :disabled="loading">
                  Registrieren
                </button>
              </form>
            </section>
          </div>
        </div>

        <aside class="cta-panel" aria-live="polite">
          <h3>{{ panelHeading }}</h3>
          <p>{{ panelCopy }}</p>
          <button
            type="button"
            class="ghost-action"
            :disabled="loading"
            @click="toggleMode"
          >
            {{ panelCta }}
          </button>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
:root {
  --the-background-color: rbg(39, 39, 39);
  --height-navbar: 5rem;
}


/* .auth-page {
  position: relative;
  margin: 2.5rem 0;
  height: calc(100vh - 5rem - 5rem);
  min-height: calc(100vh - 5rem - 5rem);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  background-color: rgb(10, 6, 33);
  overflow: hidden;
  color: #f4f6ff;
} */


.auth-page {
  position: absolute;
  display: flex;
  margin-top: var(--height-navbar);
  left: 3%;
  bottom: 0;
  width: 94%;
  height: 90%;
  align-items: center;
  justify-content: center;
  background-color: var(--the-background-color);
}

  


.auth-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  pointer-events: none;
}


.auth-card {
  position: relative;
  width: 100%;
  background: rgba(0, 0, 0, 0.82);
  border-radius: 32px;
  padding: 2.4rem 2.8rem 2.8rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 30px 70px rgba(9, 12, 34, 0.45);
  backdrop-filter: blur(22px);
  display: flex;
  flex-direction: column;
  gap: 2.4rem;
  overflow: hidden;
  transition: transform 0.4s ease;
}

.auth-card.loading {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
}

.brand span {
  font-size: 1.35rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  font-weight: 600;
  background: linear-gradient(120deg, #cf2dff 5%, #05d9ff 95%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 18px rgba(0, 140, 255, 0.35);
}

.mode-toggle {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  padding: 0.25rem;
  border-radius: 999px;
  background: rgb(10, 6, 33);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 6px rgba(255, 255, 255, 0.05), 0 8px 26px rgba(0, 0, 0, 0.35);
}

.mode-toggle button {
  position: relative;
  z-index: 2;
  border: none;
  background: transparent;
  color: rgba(232, 238, 254, 0.6);
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.55rem 1.2rem;
  cursor: pointer;
  border-radius: 999px;
  transition: color 0.3s ease;
}

.mode-toggle button.active {
  color: #0b0c14;
}

.mode-toggle button:disabled {
  cursor: default;
  color: rgba(232, 238, 254, 0.35);
}

.mode-indicator {
  position: absolute;
  inset: 3px;
  width: calc(50% - 6px);
  border-radius: 999px;
  background: linear-gradient(120deg, #ff4fdb, #05d9ff);
  box-shadow: 0 15px 35px rgba(88, 193, 255, 0.35);
  transform: translateX(0);
  transition: transform 0.45s cubic-bezier(0.19, 1, 0.22, 1);
}

.mode-indicator.right {
  transform: translateX(100%);
}

.card-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2rem;
  align-items: stretch;
}

.form-window {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: linear-gradient(135deg, rgba(10, 12, 33, 0.94), rgba(6, 8, 23, 0.78));
  box-shadow: inset 0 0 40px rgba(3, 5, 25, 0.9);
  display: flex;
  flex-direction: column;
}

.form-feedback {
  padding: 1rem 1.4rem;
  margin: 1.4rem 1.4rem 0;
  border-radius: 18px;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  background: rgba(5, 217, 255, 0.12);
  color: #e2faff;
  border: 1px solid rgba(5, 217, 255, 0.35);
  box-shadow: 0 12px 30px rgba(5, 217, 255, 0.18);
}

.form-feedback.error {
  background: rgba(255, 79, 131, 0.14);
  border-color: rgba(255, 79, 131, 0.4);
  color: #ffd9e5;
  box-shadow: 0 12px 30px rgba(255, 79, 131, 0.18);
}

.form-feedback.success {
  background: rgba(80, 255, 210, 0.16);
  border-color: rgba(80, 255, 210, 0.38);
  color: #d8fff3;
  box-shadow: 0 12px 30px rgba(80, 255, 210, 0.18);
}

.form-wrapper {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 100%));
  width: 200%;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.auth-card.show-register .form-wrapper {
  transform: translateX(-50%);
}

.form-container {
  padding: 3rem clamp(1.4rem, 3vw, 3rem);
  background-color: rgb(10, 6, 33);
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  min-height: 100%;
}

.form-headline h2 {
  font-size: clamp(1.45rem, 2.4vw, 1.9rem);
  font-weight: 700;
  letter-spacing: 0.03em;
  text-shadow: 0 0 18px rgba(207, 45, 255, 0.55);
}

.form-headline p {
  margin-top: 0.35rem;
  color: rgba(234, 238, 255, 0.6);
  font-size: 0.95rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.split-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.65);
}

.field input {
  padding: 0.95rem 1.1rem;
  font-size: 0.96rem;
  font-weight: 500;
  border-radius: 16px;
  border: 1px solid transparent;
  color: #f6f9ff;
  background:
    linear-gradient(140deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.04)) padding-box,
    linear-gradient(135deg, rgba(207, 45, 255, 0.65), rgba(5, 217, 255, 0.65)) border-box;
  transition: box-shadow 0.3s ease, background 0.3s ease, opacity 0.2s ease;
}

.field input::placeholder {
  color: rgba(240, 244, 255, 0.45);
}

.field input:focus {
  outline: none;
  background:
    linear-gradient(140deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.08)) padding-box,
    linear-gradient(135deg, rgba(207, 45, 255, 0.95), rgba(5, 217, 255, 0.95)) border-box;
  box-shadow:
    0 0 0 3px rgba(5, 217, 255, 0.16),
    0 0 22px rgba(207, 45, 255, 0.4);
}

.field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: rgba(234, 238, 255, 0.48);
}

.password-errors {
  list-style: disc;
  margin: 0;
  padding-left: 1.4rem;
  color: #ffd9e5;
  font-size: 0.88rem;
  line-height: 1.4;
}

.primary-action {
  align-self: flex-start;
  margin-top: 15px;
  border: none;
  border-radius: 999px;
  padding: 0.9rem 2.4rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #06101c;
  background: linear-gradient(125deg, #ff4fdb, #05d9ff);
  box-shadow: 0 18px 38px rgba(5, 217, 255, 0.35), 0 10px 20px rgba(207, 45, 255, 0.3);
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease, opacity 0.2s ease;
}

.primary-action:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 22px 46px rgba(5, 217, 255, 0.4), 0 14px 28px rgba(207, 45, 255, 0.28);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  box-shadow: 0 10px 20px rgba(5, 217, 255, 0.15), 0 6px 14px rgba(207, 45, 255, 0.12);
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: left;
  flex-direction: column;
  align-content: flex-start;
  flex-wrap: wrap;
}

.ghost-link {
  color: rgba(234, 238, 255, 0.7);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.ghost-link:hover {
  color: #05d9ff;
}

.cta-panel {
  position: relative;
  border-radius: 24px;
  padding: clamp(2rem, 4vw, 3rem);
  width: 320px;
  background:
    linear-gradient(135deg, rgba(207, 45, 255, 0.28), rgba(5, 217, 255, 0.32));
  box-shadow:
    inset 0 1px 14px rgba(255, 255, 255, 0.08),
    0 18px 40px rgba(5, 217, 255, 0.2),
    0 10px 28px rgba(207, 45, 255, 0.16);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.1rem;
  color: #ffffff;
}

.cta-panel h3 {
  font-size: clamp(1.4rem, 2.8vw, 1.8rem);
  font-weight: 700;
  letter-spacing: 0.05em;
  font-size: 1.5rem;
}

.cta-panel p {
  color: rgba(252, 253, 253, 0.8);
  font-size: 0.98rem;
  line-height: 1.5;
}

.ghost-action {
  align-self: flex-start;
  background-color:rgb(7, 17, 30);
  border: none;
  border-radius: 999px;
  color: #ffffff;
  padding: 0.75rem 1.9rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease, opacity 0.2s ease;
}

.ghost-action:hover:not(:disabled) {
  transform: translateY(-2px);
  background: rgba(7, 17, 30, 1);
  box-shadow: 0 12px 28px rgba(7, 17, 30, 0.18);
}

.ghost-action:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
}

@media (max-width: 1150px) {
  .card-body {
    grid-template-columns: 1fr;
  }

  .cta-panel {
    width: 100%;
    order: -1;
    display: flex;
  }
}

@media (max-width: 900px) {
  .auth-page {
    margin: 1.5rem 0;
    height: auto;
    min-height: auto;
    padding: 1.5rem 1rem 2rem;
  }

  .auth-card {
    padding: 1.75rem;
    border-radius: 24px;
  }

  .card-header {
    align-items: flex-start;
  }

  .mode-toggle button {
    font-size: 0.85rem;
    padding: 0.5rem 0.8rem;
  }

  .form-container {
    padding: 2rem 1.25rem;
  }

  .form-feedback {
    margin: 1rem;
  }
}

@media (max-width: 640px) {
  .form-headline h2 {
    font-size: 1.2rem;
  }

  .split-fields {
    grid-template-columns: 1fr;
  }

  .form-window {
    border-radius: 20px;
  }

  .primary-action,
  .ghost-action {
    width: 100%;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .auth-card {
    padding: 1.25rem;
    border-radius: 20px;
  }

  .card-header {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .mode-toggle {
    width: 100%;
  }

  .mode-toggle button {
    font-size: 0.78rem;
    padding: 0.45rem 0.6rem;
  }

  .card-body {
    gap: 1.25rem;
  }

  .form-container {
    padding: 1.35rem 1rem;
  }

  .form-feedback {
    margin: 0.75rem 0.85rem 0;
  }

  .cta-panel {
    padding: 1.5rem;
  }
}
</style>
