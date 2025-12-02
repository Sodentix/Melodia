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

  // load stored user (from navbar/auth)
  try {
    const raw = localStorage.getItem('melodia_user');
    storedUser.value = raw ? JSON.parse(raw) : null;
  } catch {
    storedUser.value = null;
  }

  const usernameParam = route.params.username;

  // If no username in URL, we show own profile (requires auth)
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

  // Public profile for specific username
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
      <header class="profile-header">
        <div class="identity">
          <div class="avatar-orb">
            <Icon icon="solar:user-bold-duotone" class="avatar-icon" />
          </div>
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
      </header>

      <section class="stats-section">
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
            <p class="label durch-label-big">Durchschnittliche Ratezeit</p>
            <p class="label durch-label-small">Durchsch. Ratezeit</p>
            <p class="label durch-label-very-small">Ø Ratezeit</p>
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
.profile-page {
  min-height: calc(100vh - 5rem);
  padding: 4rem 3rem 5rem 3rem;
  background: radial-gradient(circle at top left, rgba(255, 0, 200, 0.1), transparent 55%),
    radial-gradient(circle at top right, rgba(5, 217, 255, 0.08), transparent 55%),
    radial-gradient(circle at bottom, rgba(61, 255, 140, 0.12), transparent 65%);
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
  justify-content: space-between;
  gap: 2rem;
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

.win-label-small {
    display: none;
}

.durch-label-small {
  display: none;
}

.durch-label-very-small {
  display: none;
}

.game-label-small {
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

@media (max-width: 1110px) {
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

  .durch-label-small {
    display: block;
  }

  .durch-label-big {
    display: none;
  }
}

@media (max-width: 1005px) {
  .durch-label-very-small {
    display: block;
  }

  .durch-label-small {
    display: none;
  }
}

@media (max-width: 915px) {
  .game-label-big {
    display: none;
  }
  .game-label-small {
    display: block;
  }
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}
</style>
