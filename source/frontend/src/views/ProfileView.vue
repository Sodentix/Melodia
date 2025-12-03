<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';

const route = useRoute();
const router = useRouter();

const apiRoot = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : '';
const usersBase = apiRoot.endsWith('/users') ? apiRoot : `${apiRoot}/users`;

const loading = ref(true);
const error = ref(null);
const profile = ref(null);
const stats = ref(null);
const isOwnProfile = ref(false);
const neverPlayed = ref(false);

const isEditingInline = ref(false);
const editSaving = ref(false);
const editFeedback = ref(null);
const editFieldError = ref(null);
const pendingEmailVerification = ref(false);

const storedUser = ref(null);

const viewingUsername = computed(() => {
  return route.params.username || storedUser.value?.username || null;
});

const formattedJoined = computed(() => {
  if (!profile.value?.createdAt) return null;
  const date = new Date(profile.value.createdAt);
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
});

const winRate = computed(() => {
  if (!stats.value || !stats.value.totalPlayed) return 0;
  const wins = stats.value.totalWins || stats.value.wins || 0;
  return Math.round((wins / stats.value.totalPlayed) * 100);
});

const bestTimeSeconds = computed(() => {
  if (!stats.value?.bestTimeMs) return null;
  return (stats.value.bestTimeMs / 1000).toFixed(1);
});

const averageTimeSeconds = computed(() => {
  if (!stats.value?.averageTimeMs) return null;
  return (stats.value.averageTimeMs / 1000).toFixed(1);
});

function normalizeStats(raw) {
  if (!raw) {
    neverPlayed.value = true;
    return {
      totalPlayed: 0,
      totalWins: 0,
      totalPoints: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestTimeMs: null,
      averageTimeMs: null,
    };
  }

  if (typeof raw === 'string') {
    neverPlayed.value = true;
    return {
      totalPlayed: 0,
      totalWins: 0,
      totalPoints: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestTimeMs: null,
      averageTimeMs: null,
    };
  }

  neverPlayed.value = false;

  return {
    totalPlayed: raw.totalPlayed ?? raw.totalGames ?? 0,
    totalWins: raw.totalWins ?? raw.wins ?? 0,
    totalPoints: raw.totalPoints ?? 0,
    currentStreak: raw.currentStreak ?? 0,
    bestStreak: raw.bestStreak ?? 0,
    bestTimeMs: raw.bestTimeMs ?? null,
    averageTimeMs: raw.averageTimeMs ?? null,
  };
}

async function fetchProfile() {
  loading.value = true;
  error.value = null;
  profile.value = null;
  stats.value = null;

  const token =
    localStorage.getItem('melodia_token') || localStorage.getItem('token') || '';

  try {
    const raw = localStorage.getItem('melodia_user');
    storedUser.value = raw ? JSON.parse(raw) : null;
  } catch {
    storedUser.value = null;
  }

  const usernameParam = route.params.username;

  if (!usernameParam) {
    if (!token || !usersBase) {
      loading.value = false;
      error.value = 'Bitte melde dich an, um dein Profil zu sehen.';
      await router.push({ name: 'auth' });
      return;
    }

    try {
      const res = await fetch(`${usersBase}/me`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          error.value = 'Bitte melde dich erneut an.';
          await router.push({ name: 'auth' });
          return;
        }

        const data = await res.json().catch(() => ({}));
        error.value = data.message || 'Profil konnte nicht geladen werden.';
        return;
      }

      const data = await res.json();
      profile.value = {
        id: data.id,
        username: data.username,
        firstName: data.firstname ?? data.firstName,
        lastName: data.lastname ?? data.lastName,
        email: data.email,
        createdAt: data.createdAt,
      };
      stats.value = normalizeStats(data.stats);
      isOwnProfile.value = true;
    } catch (e) {
      console.error('Fetch own profile failed:', e);
      error.value = 'Es ist ein Fehler beim Laden deines Profils aufgetreten.';
    } finally {
      loading.value = false;
    }

    return;
  }

  try {
    const res = await fetch(`${usersBase}/profile/${encodeURIComponent(usernameParam)}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    if (!res.ok) {
      if (res.status === 404) {
        error.value = 'Dieser Nutzer wurde nicht gefunden.';
        return;
      }

      const data = await res.json().catch(() => ({}));
      error.value = data.error || data.message || 'Profil konnte nicht geladen werden.';
      return;
    }

    const data = await res.json();
    profile.value = {
      username: data.displayName || usernameParam,
      firstName: data.firstname ?? data.firstName,
      createdAt: data.createdAt,
    };
    stats.value = normalizeStats(data.stats);

    const currentUsername = storedUser.value?.username;
    isOwnProfile.value =
      !!currentUsername &&
      String(currentUsername).toLowerCase() === String(usernameParam).toLowerCase();
  } catch (e) {
    console.error('Fetch public profile failed:', e);
    error.value = 'Es ist ein Fehler beim Laden des Profils aufgetreten.';
  } finally {
    loading.value = false;
  }
}

onMounted(fetchProfile);

watch(
  () => route.params.username,
  () => {
    fetchProfile();
  }
);

function openEditProfile() {
  if (!isOwnProfile.value || !profile.value) return;
  editFeedback.value = null;
  editFieldError.value = null;
  pendingEmailVerification.value = false;
  isEditingInline.value = true;
}

function closeEditProfile() {
  if (editSaving.value) return;
  isEditingInline.value = false;
}

async function saveProfileChanges(updated) {
  if (!isOwnProfile.value || !usersBase) return;

  const token =
    localStorage.getItem('melodia_token') || localStorage.getItem('token') || '';

  if (!token) {
    editFeedback.value = 'Bitte melde dich erneut an.';
    return;
  }

  editSaving.value = true;
  editFeedback.value = null;
  editFieldError.value = null;

  try {
    const payload = {
      firstName: (updated.firstName || '').trim(),
      lastName: (updated.lastName || '').trim(),
      username: (updated.username || '').trim().toLowerCase(),
      email: (updated.email || '').trim().toLowerCase(),
    };

    const res = await fetch(`${usersBase}/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const rawMessage = data.message || 'Profil konnte nicht aktualisiert werden.';
      if (data.field === 'username') {
        editFieldError.value = 'username';
        editFeedback.value =
          'Dieser Benutzername ist leider bereits vergeben. Versuch es mit einer Variante.';
      } else if (data.field === 'email') {
        editFieldError.value = 'email';
        editFeedback.value =
          'Diese E‑Mail-Adresse ist bereits registriert. Nutze eine andere Adresse.';
      } else {
        editFeedback.value = rawMessage;
      }
      return;
    }

    if (data.user) {
      profile.value = {
        ...profile.value,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
      };

      try {
        localStorage.setItem('melodia_user', JSON.stringify(data.user));
      } catch {
        // ignore storage errors
      }
    }

    pendingEmailVerification.value = Boolean(data.verificationRequired);
    editFeedback.value =
      data.message ||
      (pendingEmailVerification.value
        ? 'Wir haben dir einen Bestätigungscode per E‑Mail geschickt.'
        : 'Profil aktualisiert.');

    if (!pendingEmailVerification.value) {
      isEditingInline.value = false;
    }
  } catch (err) {
    console.error('Save profile changes failed:', err);
    editFeedback.value = 'Es ist ein Fehler beim Speichern aufgetreten.';
  } finally {
    editSaving.value = false;
  }
}

async function verifyEmailCode(code) {
  if (!usersBase) return;

  const token =
    localStorage.getItem('melodia_token') || localStorage.getItem('token') || '';

  if (!token) {
    editFeedback.value = 'Bitte melde dich erneut an.';
    return;
  }

  editSaving.value = true;
  editFeedback.value = null;

  try {
    const res = await fetch(`${usersBase}/verify-email-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({ code }),
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      editFeedback.value =
        data.message || 'Der Bestätigungscode ist ungültig oder abgelaufen.';
      return;
    }

    pendingEmailVerification.value = false;
    editFeedback.value = data.message || 'E‑Mail erfolgreich bestätigt.';

    if (data.user) {
      try {
        localStorage.setItem('melodia_user', JSON.stringify(data.user));
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('Verify email code failed:', err);
    editFeedback.value = 'Es ist ein Fehler bei der Bestätigung aufgetreten.';
  } finally {
    editSaving.value = false;
  }
}
</script>

<template>
  <div class="profile-page">
    <div v-if="loading" class="profile-loading">
      <div class="spinner"></div>
      <p>Profil wird geladen...</p>
    </div>

    <div v-else-if="error" class="profile-error">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="profile" class="profile-content">
      <div class="profile-header" :class="{ 'profile-header--expanded': isEditingInline }">
        <div class="profile-header-top">
          <div class="identity">
            <button
              class="avatar-orb"
              type="button"
              :class="{ clickable: isOwnProfile }"
              @click="openEditProfile"
            >
              <Icon icon="solar:user-bold-duotone" class="avatar-icon" />
            </button>
            <div class="identity-text">
              <p class="profile-eyebrow">
                {{ isOwnProfile ? 'Dein Melodia Profil' : 'Melodia Spielerprofil' }}
              </p>
              <h1 class="profile-name">
                {{ profile.firstName || profile.username }}
                <span v-if="profile.lastName"> {{ profile.lastName }}</span>
              </h1>
              <p class="profile-username">
                @{{ profile.username }}
              </p>
              <p v-if="formattedJoined" class="profile-meta">
                Dabei seit {{ formattedJoined }}
              </p>
            </div>
          </div>

          <div v-if="isOwnProfile && profile.email" class="profile-side">
            <p class="label">E-Mail</p>
            <p class="value">{{ profile.email }}</p>
          </div>
        </div>

        <div
          v-if="isOwnProfile && isEditingInline"
          class="profile-header-edit"
        >
          <div class="edit-row">
            <label for="edit-first-name">Vorname</label>
            <input
              id="edit-first-name"
              type="text"
              v-model="profile.firstName"
              placeholder="Dein Vorname"
            />
          </div>
          <div class="edit-row">
            <label for="edit-last-name">Nachname</label>
            <input
              id="edit-last-name"
              type="text"
              v-model="profile.lastName"
              placeholder="Dein Nachname"
            />
          </div>
          <div class="edit-row">
            <label for="edit-username">Benutzername</label>
            <input
              id="edit-username"
              type="text"
              v-model="profile.username"
              placeholder="Dein Benutzername"
            />
          </div>
          <div class="edit-row">
            <label for="edit-email">E-Mail</label>
            <input
              id="edit-email"
              type="email"
              v-model="profile.email"
              placeholder="Deine E-Mail-Adresse"
            />
          </div>

          <p v-if="pendingEmailVerification" class="edit-hint">
            Wir haben dir einen Bestätigungscode per E‑Mail geschickt.
          </p>

          <p
            v-if="editFeedback"
            class="edit-feedback"
            :class="{ error: editFieldError }"
          >
            {{ editFeedback }}
          </p>

          <div class="edit-actions">
            <button
              type="button"
              class="btn ghost"
              :disabled="editSaving"
              @click="closeEditProfile"
            >
              Abbrechen
            </button>
            <button
              type="button"
              class="btn primary"
              :disabled="editSaving"
              @click="saveProfileChanges(profile)"
            >
              {{ editSaving ? 'Speichern...' : 'Änderungen speichern' }}
            </button>
          </div>
        </div>
      </div>

      <section class="stats-section" v-if="!isEditingInline">
        <h2>Spielstatistiken</h2>
        <p class="stats-subtitle" v-if="neverPlayed">
          {{
            isOwnProfile
              ? 'Du hast noch keine Runden gespielt – Zeit, den ersten Beat zu droppen!'
              : 'Dieser Spieler hat bislang noch keine Partie gespielt.'
          }}
        </p>
        <p class="stats-subtitle" v-else>
          {{
            isOwnProfile
              ? 'Wie schlagen sich deine bisherigen Runden?'
              : 'So performt dieser Spieler in Melodia.'
          }}
        </p>

        <div class="stats-grid" v-if="stats">
          <div class="stat-card primary">
            <p class="label game-label-big">Spiele insgesamt</p>
            <p class="label game-label-small">Spiele</p>
            <p class="value">{{ stats.totalPlayed }}</p>
          </div>

          <div class="stat-card">
            <p class="label win-label-big">Siege insgesamt</p>
            <p class="label win-label-small">Siege</p>
            <p class="value">{{ stats.totalWins }}</p>
          </div>

          <div class="stat-card">
            <p class="label">Win-Rate</p>
            <p class="value">
              {{ winRate }}<span class="suffix">%</span>
            </p>
          </div>

          <div class="stat-card">
            <p class="label">Gesamtpunkte</p>
            <p class="value">{{ stats.totalPoints }}</p>
          </div>

          <div class="stat-card">
            <p class="label">Aktuelle Serie</p>
            <p class="value">{{ stats.currentStreak }}</p>
          </div>

          <div class="stat-card">
            <p class="label">Beste Serie</p>
            <p class="value">{{ stats.bestStreak }}</p>
          </div>

          <div class="stat-card" v-if="bestTimeSeconds">
            <p class="label">Beste Ratezeit</p>
            <p class="value">
              {{ bestTimeSeconds }}
              <span class="suffix">s</span>
            </p>
          </div>

          <div class="stat-card primary" v-if="averageTimeSeconds">
            <p class="label durchschn-label-big">Durchschnittliche Ratezeit</p>
            <p class="label durchschn-label-small">Ø Ratezeit</p>
            <p class="value">
              {{ averageTimeSeconds }}
              <span class="suffix">s</span>
            </p>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
:root {
  --the-background-color: rbg(39, 39, 39);
}

.profile-page {
  min-height: calc(100vh - 5rem);
  padding: 4rem 3rem 5rem 3rem;
  /* background: radial-gradient(circle at top left, rgba(255, 0, 200, 0.1), transparent 55%),
    radial-gradient(circle at top right, rgba(5, 217, 255, 0.08), transparent 55%),
    radial-gradient(circle at bottom, rgba(61, 255, 140, 0.12), transparent 65%); */

  background-color: var(--the-background-color);
}

.profile-loading,
.profile-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  min-height: 40vh;
  color: var(--text);
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
  to {
    transform: rotate(360deg);
  }
}

.profile-content {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2.75rem;
}

.profile-header {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  padding: 2rem 2.4rem;
  border-radius: 26px;
  background:
    linear-gradient(135deg, rgba(13, 9, 46, 0.96), rgba(7, 9, 24, 0.96)) padding-box,
    linear-gradient(120deg, rgba(255, 0, 200, 0.5), rgba(5, 217, 255, 0.4)) border-box;
  border: 1px solid transparent;
  box-shadow:
    0 18px 40px rgba(5, 217, 255, 0.18),
    0 10px 28px rgba(255, 0, 200, 0.24);
}

.profile-header--expanded {
  padding-bottom: 2.4rem;
}

.profile-header-top {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
}

.profile-edit-enter-active,
.profile-edit-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform-origin: top center;
}

.profile-edit-enter-from,
.profile-edit-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.9);
}

.profile-edit-enter-to,
.profile-edit-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.identity {
  display: flex;
  gap: 1.6rem;
  align-items: center;
}

.avatar-orb {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 30%, rgba(255, 0, 200, 0.6), rgba(5, 217, 255, 0.45));
  box-shadow:
    0 0 15px rgba(255, 0, 200, 0.8),
    0 0 28px rgba(5, 217, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.avatar-orb.clickable {
  cursor: pointer;
  transition: transform 0.22s ease, box-shadow 0.24s ease;
}

.avatar-orb.clickable:hover {
  transform: translateY(-2px);
  box-shadow:
    0 0 20px rgba(255, 0, 200, 0.75),
    0 0 32px rgba(0, 236, 255, 0.6),
    0 0 50px rgba(61, 255, 140, 0.5);
}

.avatar-icon {
  font-size: 40px;
  color: #ffffff;
}

.identity-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.profile-eyebrow {
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.7);
}

.profile-name {
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: linear-gradient(120deg, var(--accent-pink), var(--accent-cyan), var(--accent-green));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.profile-username {
  font-size: 0.95rem;
  color: rgba(234, 238, 255, 0.78);
}

.profile-meta {
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.7);
}

.profile-side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3rem;
  min-width: 220px;
}

.profile-side .label {
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.7);
}

.profile-side .value {
  font-size: 0.95rem;
  color: #ffffff;
  word-break: break-all;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.stats-section h2 {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.92);
}

.stats-subtitle {
  font-size: 0.95rem;
  color: rgba(234, 238, 255, 0.7);
}

.stats-grid {
  margin-top: 0.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.2rem;
}

.stat-card {
  padding: 1.2rem 1.4rem;
  border-radius: 18px;
  background:
    linear-gradient(140deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))
      padding-box,
    linear-gradient(135deg, rgba(255, 0, 200, 0.5), rgba(5, 217, 255, 0.4)) border-box;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: #f6f9ff;
  box-shadow: 0 12px 26px rgba(7, 17, 30, 0.55);
}

.stat-card.primary {
  grid-column: span 2;
  background:
    linear-gradient(135deg, rgba(255, 0, 200, 0.38), rgba(5, 217, 255, 0.24))
      padding-box,
    linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(5, 217, 255, 0.9))
      border-box;
}

.stat-card .label {
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.78);
}

.stat-card .value {
  font-size: 1.6rem;
  font-weight: 700;
}

.stat-card .suffix {
  font-size: 1rem;
  margin-left: 0.2rem;
  opacity: 0.8;
}

.profile-header-edit {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  padding-top: 1.4rem;
}

.edit-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.edit-row label {
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.78);
}

.edit-row input {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(4, 6, 18, 0.9);
  padding: 0.55rem 0.8rem;
  color: #ffffff;
  font-size: 0.95rem;
}

.edit-row input:focus {
  outline: none;
  border-color: var(--accent-cyan);
  box-shadow: 0 0 0 1px rgba(5, 217, 255, 0.5);
}

.edit-hint {
  font-size: 0.85rem;
  color: rgba(234, 238, 255, 0.8);
}

.edit-feedback {
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.9);
}

.edit-feedback.error {
  color: #ff6b81;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
  margin-top: 0.4rem;
}

.game-label-small {
  display: none;
}

.durchschn-label-small {
  display: none;
}

.win-label-small {
  display: none;
}

@media (max-width: 1150px) {
  .win-label-big {
    display: none;
  }
  .win-label-small {
    display: block;
  }
}

@media (max-width: 1085px) {
  .profile-page {
    padding: 3rem 1.6rem 4rem 1.6rem;
  }

  .profile-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .stat-card.primary {
    grid-column: span 1;
  }

  .durchschn-label-big {
    display: none;
  
  }

  .durchschn-label-small {
    display: block;
  }

  .game-label-big {
    display: none;
  }

  .game-label-small {
    display: block;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

@media (max-width: 925px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}


</style>
