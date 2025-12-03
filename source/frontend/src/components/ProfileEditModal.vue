<script setup>
import { reactive, ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  profile: {
    type: Object,
    required: true,
  },
  saving: {
    type: Boolean,
    default: false,
  },
  feedback: {
    type: String,
    default: null,
  },
  verificationRequired: {
    type: Boolean,
    default: false,
  },
  fieldError: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'save', 'verifyCode']);

const form = reactive({
  firstName: '',
  lastName: '',
  username: '',
  email: '',
});

const code = ref('');

function syncFromProfile() {
  if (!props.profile) return;
  form.firstName = props.profile.firstName || '';
  form.lastName = props.profile.lastName || '';
  form.username = props.profile.username || '';
  form.email = props.profile.email || '';
}

watch(
  () => props.profile,
  () => {
    syncFromProfile();
  },
  { immediate: true, deep: true }
);

watch(
  () => props.verificationRequired,
  (val) => {
    if (val) {
      code.value = '';
    }
  }
);

function close() {
  if (props.saving) return;
  emit('update:modelValue', false);
}

function handleSubmit() {
  emit('save', {
    firstName: form.firstName,
    lastName: form.lastName,
    username: form.username,
    email: form.email,
  });
}

function handleVerify() {
  if (!code.value || props.saving) return;
  emit('verifyCode', code.value.trim());
}
</script>

<template>
  <div v-if="modelValue" class="edit-backdrop">
    <div class="edit-modal">
      <header class="edit-header">
        <div>
          <h2 class="edit-title">Profil bearbeiten</h2>
          <p class="edit-subtitle">
            Passe deinen Namen, Benutzernamen und deine E‑Mail-Adresse an. Bei einer neuen E‑Mail
            schicken wir dir einen Bestätigungscode.
          </p>
        </div>
        <button type="button" class="edit-close" @click="close">×</button>
      </header>

      <form class="edit-body" @submit.prevent="handleSubmit">
        <div class="edit-field">
          <label class="edit-label" for="firstName">Vorname</label>
          <input
            id="firstName"
            v-model="form.firstName"
            class="edit-input"
            type="text"
            autocomplete="given-name"
          />
        </div>
        <div class="edit-field">
          <label class="edit-label" for="lastName">Nachname</label>
          <input
            id="lastName"
            v-model="form.lastName"
            class="edit-input"
            type="text"
            autocomplete="family-name"
          />
        </div>
        <div class="edit-field">
          <label class="edit-label" for="username">Benutzername</label>
          <input
            id="username"
            v-model="form.username"
            class="edit-input"
            type="text"
            autocomplete="username"
          />
          <p v-if="fieldError === 'username'" class="field-error">
            Dieser Benutzername ist schon vergeben. Probier eine andere Variante.
          </p>
        </div>
        <div class="edit-field">
          <label class="edit-label" for="email">E-Mail-Adresse</label>
          <input
            id="email"
            v-model="form.email"
            class="edit-input"
            type="email"
            autocomplete="email"
          />
          <p v-if="fieldError === 'email'" class="field-error">
            Diese E‑Mail-Adresse wird bereits verwendet.
          </p>
        </div>
      </form>

      <section v-if="verificationRequired" class="verify-block">
        <h3 class="verify-title">E‑Mail bestätigen</h3>
        <p class="verify-text">
          Wir haben dir einen Bestätigungscode an deine neue E‑Mail-Adresse geschickt. Gib den Code
          hier ein, um die Adresse zu aktivieren.
        </p>
        <div class="verify-row">
          <input
            v-model="code"
            class="verify-input"
            type="text"
            inputmode="numeric"
            maxlength="32"
            placeholder="Bestätigungscode"
          />
          <button
            type="button"
            class="btn-primary small"
            :disabled="saving || !code"
            @click="handleVerify"
          >
            Code bestätigen
          </button>
        </div>
      </section>

      <footer class="edit-footer">
        <p v-if="feedback" class="edit-feedback">
          {{ feedback }}
        </p>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" @click="close">
            Abbrechen
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="saving"
            @click="handleSubmit"
          >
            {{ saving ? 'Speichere...' : 'Speichern' }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.edit-backdrop {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.85));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
}

.edit-modal {
  width: min(720px, 100% - 3rem);
  border-radius: 24px;
  padding: 1.8rem 2rem 2rem;
  background:
    linear-gradient(145deg, rgba(13, 9, 46, 0.98), rgba(7, 9, 24, 0.98)) padding-box,
    linear-gradient(135deg, rgba(255, 0, 200, 0.7), rgba(5, 217, 255, 0.7)) border-box;
  border: 1px solid transparent;
  box-shadow:
    0 18px 40px rgba(5, 217, 255, 0.32),
    0 12px 32px rgba(255, 0, 200, 0.3);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  color: #f6f9ff;
}

.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.edit-title {
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.edit-subtitle {
  margin-top: 0.4rem;
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.75);
  max-width: 34rem;
}

.edit-close {
  border: none;
  background: none;
  color: rgba(234, 238, 255, 0.7);
  cursor: pointer;
  font-size: 1.4rem;
}

.edit-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.1rem 1.4rem;
  margin-top: 0.6rem;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.edit-label {
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.72);
}

.field-error {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #ffd1dc;
}

.edit-input {
  padding: 0.8rem 0.95rem;
  border-radius: 14px;
  border: 1px solid transparent;
  background:
    linear-gradient(140deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04)) padding-box,
    linear-gradient(135deg, rgba(255, 0, 200, 0.5), rgba(5, 217, 255, 0.5)) border-box;
  color: #f6f9ff;
  font-size: 0.95rem;
}

.edit-input:focus {
  outline: none;
  box-shadow:
    0 0 0 2px rgba(5, 217, 255, 0.3),
    0 0 18px rgba(255, 0, 200, 0.4);
}

.edit-footer {
  margin-top: 0.8rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.edit-feedback {
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.8);
}

.edit-actions {
  display: flex;
  gap: 0.8rem;
}

.btn-ghost {
  border-radius: 999px;
  padding: 0.7rem 1.5rem;
  border: 1px solid rgba(234, 238, 255, 0.4);
  background: rgba(7, 17, 30, 0.9);
  color: #f6f9ff;
  cursor: pointer;
}

.btn-primary {
  border-radius: 999px;
  padding: 0.75rem 1.8rem;
  border: none;
  background: linear-gradient(125deg, #ff4fdb, #05d9ff);
  color: #050505;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
}

.btn-primary.small {
  padding: 0.65rem 1.4rem;
  font-size: 0.85rem;
}

.verify-block {
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.verify-title {
  font-size: 0.95rem;
  font-weight: 600;
}

.verify-text {
  font-size: 0.88rem;
  color: rgba(234, 238, 255, 0.75);
}

.verify-row {
  display: flex;
  gap: 0.8rem;
  align-items: center;
  margin-top: 0.2rem;
}

.verify-input {
  flex: 1;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background-color: rgba(7, 9, 24, 0.9);
  color: #f6f9ff;
  font-size: 0.95rem;
}
</style>
