<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const apiRoot = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : ''
const gameBase = apiRoot.endsWith('/game') ? apiRoot : `${apiRoot}/game`

const modeOptions = [
  {
    id: 'competitive',
    title: 'Competitive',
    subtitle: 'Punkte sammeln & Ranking pushen',
    badge: 'Leaderboard',
  },
  {
    id: 'freeplay',
    title: 'Freeplay',
    subtitle: 'Training ohne Punkte- und Zeitdruck',
    badge: 'Training',
  },
]

const categories = ref([])
const selectedMode = ref(localStorage.getItem('melodia_game_mode') || 'competitive')
const selectedCategory = ref(null)
const loading = ref(false)
const errorMessage = ref('')

const canStart = computed(() => Boolean(selectedCategory.value))

const token = localStorage.getItem('melodia_token') || localStorage.getItem('token') || ''

async function fetchCategories() {
  if (!gameBase) {
    errorMessage.value = 'API base URL nicht konfiguriert.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const headers = token
      ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      : { Accept: 'application/json' }
    const { data } = await axios.get(`${gameBase}/categories`, { headers })
    categories.value = Array.isArray(data?.categories) ? data.categories : []

    if (!categories.value.length) {
      errorMessage.value = 'Keine Kategorien gefunden.'
      return
    }

    const storedCategory = localStorage.getItem('melodia_game_category')
    if (storedCategory) {
      const parsed = JSON.parse(storedCategory)
      const existing = categories.value.find((c) => c.id === parsed?.id)
      selectedCategory.value = existing || categories.value[0]
    } else {
      selectedCategory.value = categories.value[0]
    }
  } catch (error) {
    console.error('Kategorie-Liste fehlgeschlagen:', error)
    errorMessage.value = 'Kategorien konnten nicht geladen werden.'
  } finally {
    loading.value = false
  }
}

function setMode(modeId) {
  selectedMode.value = modeId
}

function setCategory(category) {
  selectedCategory.value = category
}

function startGame() {
  if (!token) {
    router.push('/auth')
    return
  }

  if (!selectedCategory.value) return

  const categoryPayload = {
    id: selectedCategory.value.id || selectedCategory.value.categoryId || 'all',
    categoryId: selectedCategory.value.id || selectedCategory.value.categoryId || 'all',
    name: selectedCategory.value.name || selectedCategory.value.categoryName || 'Hit Mix',
    categoryName: selectedCategory.value.name || selectedCategory.value.categoryName || 'Hit Mix',
    accent: selectedCategory.value.accent || '',
  }

  localStorage.setItem('melodia_game_mode', selectedMode.value)
  localStorage.setItem('melodia_game_category', JSON.stringify(categoryPayload))
  router.push({
    name: 'game',
    query: {
      mode: selectedMode.value,
      category: categoryPayload.id,
    },
  })
}

onMounted(() => {
  fetchCategories()
})
</script>

<template>
  <div class="selection-page">
    <section class="panel intro">
      <div>
        <p class="eyebrow">Spielmodus wählen</p>
        <h1>Wie möchtest du spielen?</h1>
        <p class="copy">
          Competitive zählt deine Punkte fürs Leaderboard, Freeplay ist ideal zum Aufwärmen. Wähle
          anschließend eine Kategorie, um das Theme der Runde festzulegen.
        </p>
      </div>
      <div class="mode-grid">
        <button
          v-for="mode in modeOptions"
          :key="mode.id"
          type="button"
          class="mode-card"
          :class="{ active: selectedMode === mode.id }"
          @click="setMode(mode.id)"
        >
          <span class="badge">{{ mode.badge }}</span>
          <h2>{{ mode.title }}</h2>
          <p>{{ mode.subtitle }}</p>
        </button>
      </div>
    </section>

    <section class="panel categories">
      <div class="header">
        <div>
          <p class="eyebrow">Kategorie</p>
          <h2>Wähle deinen Flavor</h2>
        </div>
        <button type="button" class="ghost-link" @click="fetchCategories" :disabled="loading">
          Neu laden
        </button>
      </div>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>

      <div v-else class="category-grid" :class="{ loading }">
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-card"
          :class="{ active: selectedCategory?.id === category.id }"
          :style="{ '--accent': category.accent || '#5eead4' }"
          @click="setCategory(category)"
        >
          <p class="label">{{ category.difficulty }}</p>
          <h3>{{ category.name }}</h3>
          <p class="description">{{ category.description }}</p>
        </div>
        <p v-if="loading" class="loading-text">Kategorien werden geladen ...</p>
      </div>
    </section>

    <div class="actions">
      <button type="button" class="primary" :disabled="!canStart" @click="startGame">
        Spiel starten
      </button>
      <button type="button" class="secondary" @click="router.push('/home')">
        Zurück zur Übersicht
      </button>
    </div>
  </div>
</template>

<style scoped>
.selection-page {
  min-height: calc(100vh - 6rem);
  padding: 4rem clamp(1rem, 4vw, 4rem);
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  color: var(--text, #f8fafc);
}

.panel {
  background: rgba(12, 14, 26, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 28px;
  padding: clamp(1.5rem, 3vw, 2.75rem);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

.intro {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 2rem;
  align-items: center;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  color: rgba(248, 250, 252, 0.65);
  margin-bottom: 0.8rem;
}

h1 {
  font-size: clamp(2rem, 3.4vw, 3rem);
  margin-bottom: 0.8rem;
}

h2 {
  font-size: clamp(1.4rem, 2.4vw, 2rem);
  margin-bottom: 0.4rem;
}

.copy {
  color: rgba(248, 250, 252, 0.8);
  line-height: 1.6;
  max-width: 520px;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.mode-card {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(21, 24, 45, 0.7);
  color: inherit;
  padding: 1.5rem;
  text-align: left;
  cursor: pointer;
  transition: transform 0.25s ease, border-color 0.25s ease;
}

.mode-card.active {
  border-color: rgba(94, 234, 212, 0.8);
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(94, 234, 212, 0.25);
}

.mode-card .badge {
  display: inline-flex;
  padding: 0.25rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.8rem;
}

.categories .header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1.4rem;
}

.ghost-link {
  border: none;
  background: transparent;
  color: rgba(248, 250, 252, 0.6);
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.2rem;
}

.category-card {
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(17, 20, 37, 0.8);
  padding: 1.6rem;
  cursor: pointer;
  transition: border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
}

.category-card.active {
  border-color: var(--accent);
  transform: translateY(-4px);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--accent) 20%, black);
}

.category-card .label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  color: rgba(248, 250, 252, 0.55);
}

.category-card h3 {
  margin: 0.8rem 0 0.4rem;
  font-size: 1.15rem;
}

.category-card .description {
  color: rgba(248, 250, 252, 0.75);
  line-height: 1.4;
}

.loading-text {
  grid-column: 1 / -1;
  text-align: center;
  color: rgba(248, 250, 252, 0.6);
  padding: 1rem 0;
}

.error-banner {
  border-radius: 18px;
  padding: 1rem 1.4rem;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fecaca;
  margin-bottom: 1rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.actions button {
  border-radius: 999px;
  padding: 0.9rem 2.4rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
}

.actions .primary {
  background: linear-gradient(120deg, #f472b6, #60a5fa, #34d399);
  color: #050505;
}

.actions .secondary {
  background: transparent;
  border: 1px solid rgba(248, 250, 252, 0.2);
  color: rgba(248, 250, 252, 0.8);
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .intro {
    grid-template-columns: 1fr;
  }

  .mode-grid,
  .category-grid {
    grid-template-columns: 1fr;
  }

  .actions {
    flex-direction: column;
  }

  .actions button {
    width: 100%;
    text-align: center;
  }
}
</style>

