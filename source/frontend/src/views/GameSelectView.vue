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
    <div class="background-glow"></div>
    
    <header class="page-header">
      <h1>Choose Your Path</h1>
      <p class="subtitle">Select a mode and category to start your journey.</p>
    </header>

    <main class="content-wrapper">
      <!-- Mode Selection -->
      <section class="section modes">
        <div class="section-header">
          <h2><span class="step-number">01</span> Mode</h2>
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
            <div class="mode-content">
              <span class="badge">{{ mode.badge }}</span>
              <h3>{{ mode.title }}</h3>
              <p>{{ mode.subtitle }}</p>
            </div>
            <div class="mode-bg"></div>
          </button>
        </div>
      </section>

      <!-- Category Selection -->
      <section class="section categories">
        <div class="section-header">
          <h2><span class="step-number">02</span> Category</h2>
          <button type="button" class="refresh-btn" @click="fetchCategories" :disabled="loading" title="Refresh Categories">
            <span class="icon">↻</span>
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
            <div class="card-glow"></div>
            <div class="card-content">
              <span class="difficulty">{{ category.difficulty }}</span>
              <h3>{{ category.name }}</h3>
              <p class="description">{{ category.description }}</p>
            </div>
          </div>
          <div v-if="loading" class="loading-overlay">
            <div class="spinner"></div>
          </div>
        </div>
      </section>
    </main>

    <footer class="actions-bar">
      <div class="actions-container">
        <button type="button" class="btn secondary" @click="router.push('/home')">
          Back
        </button>
        <button type="button" class="btn primary" :disabled="!canStart" @click="startGame">
          Start Game
          <span class="arrow">→</span>
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.selection-page {
  min-height: 100vh;
  padding: 6rem 2rem 8rem;
  position: relative;
  overflow-x: hidden;
  color: var(--text, #f8fafc);
  max-width: 1600px;
  margin: 0 auto;
}

.background-glow {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: 
    radial-gradient(circle at 15% 20%, rgba(255, 0, 200, 0.08), transparent 40%),
    radial-gradient(circle at 85% 80%, rgba(0, 236, 255, 0.08), transparent 40%);
  z-index: -1;
  pointer-events: none;
}

/* Header */
.page-header {
  text-align: center;
  margin-bottom: 4rem;
}

h1 {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 800;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.6);
  max-width: 600px;
  margin: 0 auto;
}

/* Sections */
.section {
  margin-bottom: 4rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.step-number {
  font-size: 0.9rem;
  font-weight: 700;
  color: #00ecff;
  background: rgba(0, 236, 255, 0.1);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-family: monospace;
}

/* Mode Cards */
.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.mode-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 2.5rem;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mode-card:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-4px);
}

.mode-card.active {
  border-color: #00ecff;
  background: rgba(0, 236, 255, 0.05);
  box-shadow: 0 0 30px rgba(0, 236, 255, 0.1);
}

.mode-content {
  position: relative;
  z-index: 2;
}

.badge {
  display: inline-block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #00ecff;
  margin-bottom: 1rem;
  font-weight: 700;
}

.mode-card h3 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: white;
}

.mode-card p {
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

/* Category Grid */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  position: relative;
}

.category-card {
  position: relative;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 2rem;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.category-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.2);
}

.category-card.active {
  border-color: var(--accent);
  background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 20%, transparent);
}

.card-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100px;
  background: radial-gradient(circle at top right, var(--accent), transparent 70%);
  opacity: 0.1;
  transition: opacity 0.3s ease;
}

.category-card.active .card-glow {
  opacity: 0.3;
}

.difficulty {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.5);
  display: block;
  margin-bottom: 0.8rem;
}

.category-card h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: white;
}

.category-card .description {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

/* Actions Bar */
.actions-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 1.5rem;
  background: rgba(5, 5, 5, 0.8);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 100;
  display: flex;
  justify-content: center;
}

.actions-container {
  width: 100%;
  max-width: 1600px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn {
  padding: 1rem 2rem;
  border-radius: 99px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.btn.primary {
  background: white;
  color: black;
}

.btn.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(255, 255, 255, 0.2);
}

.btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.secondary {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn.secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.refresh-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.2rem;
  cursor: pointer;
  transition: color 0.2s ease;
}

.refresh-btn:hover {
  color: white;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(5, 5, 5, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #00ecff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .selection-page {
    padding: 4rem 1.5rem 8rem;
  }
  
  h1 {
    font-size: 2rem;
  }
  
  .mode-grid {
    grid-template-columns: 1fr;
  }
  
  .actions-bar {
    padding: 1rem;
  }
  
  .btn {
    padding: 0.8rem 1.5rem;
    font-size: 0.9rem;
  }
}
</style>

