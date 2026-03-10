<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { userStore } from '@/stores/userStore'
import { getApiBase, getAuthHeaders } from '@/api/client'

const router = useRouter()
const { t, locale } = useI18n()
const isAdmin = computed(() => userStore.user?.userRole === 'admin')

if (!isAdmin.value) {
  router.replace({ name: 'home' })
}

const activeTab = ref('users')
const apiRoot = getApiBase()
const adminBase = apiRoot.endsWith('/admin') ? apiRoot : `${apiRoot}/admin`

// Users
const users = ref([])
const usersTotal = ref(0)
const usersPage = ref(1)
const usersLimit = ref(20)
const usersSearch = ref('')
const usersLoading = ref(false)
const usersError = ref('')
const savingUserId = ref(null)
const deletingUserId = ref(null)
const restoringUserId = ref(null)
const includeDeleted = ref(false)
const roleDraft = ref({})
const restoreModalUser = ref(null)
const restoreModalEmail = ref('')
const restoreModalUsername = ref('')

async function fetchUsers() {
  if (!adminBase) return
  usersLoading.value = true
  usersError.value = ''
  try {
    const params = new URLSearchParams({ page: usersPage.value, limit: usersLimit.value })
    if (usersSearch.value.trim()) params.set('search', usersSearch.value.trim())
    if (includeDeleted.value) params.set('includeDeleted', 'true')
    const res = await fetch(`${adminBase}/users?${params}`, { headers: getAuthHeaders(), credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      usersError.value = data.message || t('admin.loadError')
      return
    }
    users.value = data.users || []
    usersTotal.value = data.total ?? 0
    roleDraft.value = {}
    users.value.forEach((u) => { roleDraft.value[u.id] = u.userRole })
  } catch (_e) {
    usersError.value = t('admin.networkError')
  } finally {
    usersLoading.value = false
  }
}

async function restoreUser(user, overrideEmail = null, overrideUsername = null) {
  if (!overrideEmail && !overrideUsername && !confirm(t('admin.restoreConfirm'))) return
  restoringUserId.value = user.id
  usersError.value = ''
  try {
    const body = (overrideEmail && overrideUsername)
      ? JSON.stringify({ email: overrideEmail.trim().toLowerCase(), username: overrideUsername.trim().toLowerCase() })
      : undefined
    const res = await fetch(`${adminBase}/users/${user.id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body,
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      restoreModalUser.value = null
      restoreModalEmail.value = ''
      restoreModalUsername.value = ''
      await fetchUsers()
    } else if (res.status === 409) {
      restoreModalUser.value = user
      restoreModalEmail.value = ''
      restoreModalUsername.value = ''
    } else {
      usersError.value = data.message || t('admin.loadError')
    }
  } catch (_e) {
    usersError.value = t('admin.networkError')
  } finally {
    restoringUserId.value = null
  }
}

function closeRestoreModal() {
  restoreModalUser.value = null
  restoreModalEmail.value = ''
  restoreModalUsername.value = ''
}

async function submitRestoreWithCredentials() {
  const user = restoreModalUser.value
  if (!user || !restoreModalEmail.value.trim() || !restoreModalUsername.value.trim()) return
  await restoreUser(user, restoreModalEmail.value, restoreModalUsername.value)
}

function setRoleDraft(userId, role) {
  roleDraft.value[userId] = role
}

async function saveUserRole(user) {
  const role = roleDraft.value[user.id] ?? user.userRole
  if (role === user.userRole) return
  savingUserId.value = user.id
  try {
    const res = await fetch(`${adminBase}/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ userRole: role }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.user) {
      const idx = users.value.findIndex((u) => u.id === user.id)
      if (idx !== -1) users.value[idx] = data.user
    }
  } finally {
    savingUserId.value = null
  }
}

async function deleteUser(user) {
  if (!confirm(t('admin.deleteConfirm'))) return
  deletingUserId.value = user.id
  try {
    const res = await fetch(`${adminBase}/users/${user.id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      await fetchUsers()
    } else {
      usersError.value = data.message || t('admin.deleteError')
    }
  } catch (_e) {
    usersError.value = t('admin.networkError')
  } finally {
    deletingUserId.value = null
  }
}

const usersTotalPages = computed(() => Math.max(1, Math.ceil(usersTotal.value / usersLimit.value)))

// Categories
const categories = ref([])
const categoriesLoading = ref(false)
const categoriesError = ref('')
const categoriesEditing = ref(false)
const categoriesDraft = ref([])
const categoriesSaving = ref(false)
const showAddCategoryModal = ref(false)
const addCategorySaving = ref(false)
const addCategoryError = ref('')
const addCategoryForm = ref({
  name: '',
  description: '',
  accent: '#05d9ff',
  difficulty: 'easy',
  playlistIdsStr: '',
  trackIdsStr: '',
})

function parseIds(s) {
  if (!s || typeof s !== 'string') return []
  return s
    .split(/[\s,;]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => !Number.isNaN(n) && n > 0)
}

function formatIds(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return ''
  return arr.join(', ')
}

function openAddCategoryModal() {
  addCategoryForm.value = {
    name: '',
    description: '',
    accent: '#05d9ff',
    difficulty: 'easy',
    playlistIdsStr: '',
    trackIdsStr: '',
  }
  addCategoryError.value = ''
  showAddCategoryModal.value = true
}

function closeAddCategoryModal() {
  showAddCategoryModal.value = false
}

async function submitAddCategory() {
  const form = addCategoryForm.value
  const playlistIds = parseIds(form.playlistIdsStr)
  const trackIds = parseIds(form.trackIdsStr)
  if (playlistIds.length === 0 && trackIds.length === 0) {
    addCategoryError.value = t('admin.addCategoryNeedIds')
    return
  }
  if (!form.name || !form.name.trim()) {
    addCategoryError.value = t('admin.addCategoryNeedName')
    return
  }
  addCategorySaving.value = true
  addCategoryError.value = ''
  try {
    const res = await fetch(`${adminBase}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        name: form.name.trim(),
        description: (form.description || '').trim(),
        accent: (form.accent || '#05d9ff').trim(),
        difficulty: (form.difficulty || 'easy').trim(),
        playlistIds,
        trackIds,
      }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.category) {
      closeAddCategoryModal()
      await fetchCategories()
    } else {
      addCategoryError.value = data.message || t('admin.saveError')
    }
  } catch (_e) {
    addCategoryError.value = t('admin.networkError')
  } finally {
    addCategorySaving.value = false
  }
}

// Audit logs
const auditLogs = ref([])
const auditTotal = ref(0)
const auditPage = ref(1)
const auditLimit = ref(50)
const auditLoading = ref(false)
const auditError = ref('')
const auditExporting = ref(false)

async function fetchCategories() {
  if (!adminBase) return
  categoriesLoading.value = true
  categoriesError.value = ''
  try {
    const res = await fetch(`${adminBase}/categories`, { headers: getAuthHeaders(), credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      categoriesError.value = data.message || t('admin.loadError')
      return
    }
    categories.value = data.categories || []
    categoriesDraft.value = JSON.parse(JSON.stringify(categories.value))
  } catch (_e) {
    categoriesError.value = t('admin.networkError')
  } finally {
    categoriesLoading.value = false
  }
}

function startEditCategories() {
  categoriesDraft.value = categories.value.map((c) => ({
    ...c,
    playlistIds: Array.isArray(c.playlistIds) ? [...c.playlistIds] : [],
    trackIds: Array.isArray(c.trackIds) ? [...c.trackIds] : [],
  }))
  categoriesEditing.value = true
}

function cancelEditCategories() {
  categoriesEditing.value = false
}

function removeCategoryAt(index) {
  if (!Array.isArray(categoriesDraft.value)) return
  const cat = categoriesDraft.value[index]
  if (!cat) return
  // Simple confirmation to avoid accidental deletion
  if (!confirm(t('admin.deleteCategoryConfirm'))) return
  categoriesDraft.value.splice(index, 1)
}

async function saveCategories() {
  if (!adminBase) return
  categoriesSaving.value = true
  try {
    const res = await fetch(`${adminBase}/categories`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ categories: categoriesDraft.value }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(data.categories)) {
      categories.value = data.categories
      categoriesEditing.value = false
    } else {
      categoriesError.value = data.message || t('admin.saveError')
    }
  } catch (_e) {
    categoriesError.value = t('admin.networkError')
  } finally {
    categoriesSaving.value = false
  }
}

async function fetchAuditLogs() {
  if (!adminBase) return
  auditLoading.value = true
  auditError.value = ''
  try {
    const params = new URLSearchParams({ page: auditPage.value, limit: auditLimit.value })
    const res = await fetch(`${adminBase}/audit-logs?${params}`, { headers: getAuthHeaders(), credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      auditError.value = data.message || t('admin.loadError')
      return
    }
    auditLogs.value = data.logs || []
    auditTotal.value = data.total ?? 0
  } catch (_e) {
    auditError.value = t('admin.networkError')
  } finally {
    auditLoading.value = false
  }
}

async function exportAuditLogs(format) {
  if (!adminBase || (format !== 'csv' && format !== 'json')) return
  auditExporting.value = true
  try {
    const url = `${adminBase}/audit-logs/export?format=${format}&limit=5000`
    const res = await fetch(url, { headers: getAuthHeaders(), credentials: 'include' })
    if (!res.ok) {
      auditError.value = t('admin.loadError')
      return
    }
    const blob = await res.blob()
    const ext = format === 'csv' ? 'csv' : 'json'
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    URL.revokeObjectURL(downloadUrl)
  } catch (_e) {
    auditError.value = t('admin.networkError')
  } finally {
    auditExporting.value = false
  }
}

const auditTotalPages = computed(() => Math.max(1, Math.ceil(auditTotal.value / auditLimit.value)))

watch(activeTab, (tab) => {
  if (tab === 'users') fetchUsers()
  if (tab === 'categories') fetchCategories()
  if (tab === 'audit') fetchAuditLogs()
})

onMounted(() => {
  if (activeTab.value === 'users') fetchUsers()
  if (activeTab.value === 'categories') fetchCategories()
  if (activeTab.value === 'audit') fetchAuditLogs()
})

function formatDate(d) {
  if (!d) return '-'
  const loc = locale.value === 'en' ? 'en-US' : locale.value === 'fr' ? 'fr-FR' : 'de-DE'
  return new Date(d).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDetails(details) {
  if (details == null || details === '') return '–'
  const s = typeof details === 'object' ? JSON.stringify(details) : String(details)
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}
</script>

<template>
  <div v-if="isAdmin" class="admin-page">
    <div class="page-bg"></div>
    <div class="admin-card glass-card">
      <h1>{{ $t('admin.title') }}</h1>

      <div class="admin-tabs">
        <button type="button" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">{{ $t('admin.users') }}</button>
        <button type="button" :class="{ active: activeTab === 'categories' }" @click="activeTab = 'categories'">{{ $t('admin.categories') }}</button>
        <button type="button" :class="{ active: activeTab === 'audit' }" @click="activeTab = 'audit'">{{ $t('admin.auditLogs') }}</button>
      </div>

      <!-- Users tab -->
      <section v-show="activeTab === 'users'" class="admin-section">
        <div class="admin-toolbar">
          <label class="admin-include-deleted">
            <input v-model="includeDeleted" type="checkbox" @change="fetchUsers" />
            {{ $t('admin.includeDeleted') }}
          </label>
          <input v-model="usersSearch" type="search" :placeholder="$t('admin.searchPlaceholder')" class="admin-search" @keyup.enter="fetchUsers" />
          <button type="button" class="btn btn--small" @click="fetchUsers">{{ $t('admin.search') }}</button>
        </div>
        <p v-if="usersError" class="admin-error">{{ usersError }}</p>
        <div v-if="usersLoading" class="admin-loading">{{ $t('admin.loading') }}</div>
        <template v-else>
          <div class="admin-table-wrap">
            <table class="admin-table" aria-label="Benutzerliste">
              <thead>
                <tr>
                  <th scope="col">{{ $t('admin.username') }}</th>
                  <th scope="col">{{ $t('admin.email') }}</th>
                  <th scope="col">{{ $t('admin.role') }}</th>
                  <th scope="col">{{ $t('admin.emailVerified') }}</th>
                  <th scope="col">{{ $t('admin.createdAt') }}</th>
                  <th scope="col">{{ $t('admin.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u.id">
                  <td>
                    {{ u.username }}
                    <span v-if="u.deletedAt" class="admin-badge admin-badge--deleted">{{ $t('admin.deleted') }}</span>
                  </td>
                  <td>{{ u.email }}</td>
                  <td>
                    <select v-if="!u.deletedAt" :value="roleDraft[u.id] ?? u.userRole" @change="setRoleDraft(u.id, ($event.target).value)">
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                    <span v-else>–</span>
                  </td>
                  <td>{{ u.deletedAt ? '–' : (u.emailVerified ? $t('admin.yes') : $t('admin.no')) }}</td>
                  <td>{{ formatDate(u.createdAt) }}</td>
                  <td>
                    <template v-if="u.deletedAt">
                      <button type="button" class="btn btn--small btn-restore" :disabled="restoringUserId === u.id" @click="restoreUser(u)">
                        {{ restoringUserId === u.id ? '...' : $t('admin.restore') }}
                      </button>
                    </template>
                    <template v-else>
                      <button type="button" class="btn btn--small" :disabled="savingUserId === u.id || (roleDraft[u.id] ?? u.userRole) === u.userRole" @click="saveUserRole(u)">
                        {{ savingUserId === u.id ? '...' : $t('admin.save') }}
                      </button>
                      <button type="button" class="btn btn--small btn--danger" :disabled="deletingUserId === u.id || userStore.user?.id === u.id" :title="userStore.user?.id === u.id ? $t('admin.deleteOwnTooltip') : $t('admin.deleteUserTooltip')" @click="deleteUser(u)">
                        {{ deletingUserId === u.id ? '...' : $t('admin.delete') }}
                      </button>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-pagination">
            <button type="button" :disabled="usersPage <= 1" @click="usersPage--; fetchUsers()">{{ $t('admin.back') }}</button>
            <span>{{ $t('admin.pageOf', { current: usersPage, total: usersTotalPages }) }}</span>
            <button type="button" :disabled="usersPage >= usersTotalPages" @click="usersPage++; fetchUsers()">{{ $t('admin.next') }}</button>
          </div>
        </template>
      </section>

      <!-- Categories tab -->
      <section v-show="activeTab === 'categories'" class="admin-section">
        <p v-if="categoriesError" class="admin-error">{{ categoriesError }}</p>
        <div v-if="categoriesLoading" class="admin-loading">{{ $t('admin.loading') }}</div>
        <template v-else>
          <div v-if="!categoriesEditing" class="admin-toolbar">
            <button type="button" class="btn btn--primary" @click="startEditCategories">{{ $t('admin.edit') }}</button>
            <button type="button" class="btn btn--primary" @click="openAddCategoryModal">{{ $t('admin.addCategory') }}</button>
          </div>
          <div v-else class="admin-toolbar">
            <button type="button" class="btn" :disabled="categoriesSaving" @click="cancelEditCategories">{{ $t('admin.cancel') }}</button>
            <button type="button" class="btn btn--primary" :disabled="categoriesSaving" @click="saveCategories">{{ categoriesSaving ? $t('admin.saveCategoriesLoading') : $t('admin.saveCategories') }}</button>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table" aria-label="Kategorien">
              <thead>
                <tr>
                  <th scope="col">{{ $t('admin.id') }}</th>
                  <th scope="col">{{ $t('admin.name') }}</th>
                  <th scope="col">{{ $t('admin.description') }}</th>
                  <th scope="col">{{ $t('admin.difficulty') }}</th>
                  <th scope="col">{{ $t('admin.accent') }}</th>
                  <th v-if="categoriesEditing" scope="col">{{ $t('admin.playlistIds') }}</th>
                  <th v-if="categoriesEditing" scope="col">{{ $t('admin.trackIds') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, i) in (categoriesEditing ? categoriesDraft : categories)" :key="c.id || i">
                  <td>{{ c.id }}</td>
                  <td>
                    <input v-if="categoriesEditing" v-model="categoriesDraft[i].name" type="text" class="admin-input" />
                    <span v-else>{{ c.name }}</span>
                  </td>
                  <td>
                    <input v-if="categoriesEditing" v-model="categoriesDraft[i].description" type="text" class="admin-input" />
                    <span v-else>{{ c.description }}</span>
                  </td>
                  <td>
                    <input v-if="categoriesEditing" v-model="categoriesDraft[i].difficulty" type="text" class="admin-input admin-input--short" />
                    <span v-else>{{ c.difficulty }}</span>
                  </td>
                  <td>
                    <input v-if="categoriesEditing" v-model="categoriesDraft[i].accent" type="text" class="admin-input admin-input--short" />
                    <span v-else>{{ c.accent }}</span>
                  </td>
                  <td v-if="categoriesEditing">
                    <input
                      :value="formatIds(categoriesDraft[i].playlistIds)"
                      type="text"
                      class="admin-input admin-input--ids"
                      :placeholder="$t('admin.addCategoryPlaceholderPlaylists')"
                      @input="categoriesDraft[i].playlistIds = parseIds(($event.target).value)"
                    />
                  </td>
                  <td v-if="categoriesEditing">
                    <input
                      :value="formatIds(categoriesDraft[i].trackIds)"
                      type="text"
                      class="admin-input admin-input--ids"
                      :placeholder="$t('admin.addCategoryPlaceholderTracks')"
                      @input="categoriesDraft[i].trackIds = parseIds(($event.target).value)"
                    />
                  </td>
                  <td v-if="categoriesEditing">
                    <button type="button" class="btn btn--small btn--danger" @click="removeCategoryAt(i)">
                      {{ $t('admin.delete') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <!-- Audit tab -->
      <section v-show="activeTab === 'audit'" class="admin-section">
        <div class="admin-toolbar">
          <button type="button" class="btn btn--small" :disabled="auditExporting" @click="exportAuditLogs('csv')">{{ auditExporting ? '...' : $t('admin.exportCsv') }}</button>
          <button type="button" class="btn btn--small" :disabled="auditExporting" @click="exportAuditLogs('json')">{{ auditExporting ? '...' : $t('admin.exportJson') }}</button>
        </div>
        <p v-if="auditError" class="admin-error">{{ auditError }}</p>
        <div v-if="auditLoading" class="admin-loading">{{ $t('admin.loading') }}</div>
        <template v-else>
          <div class="admin-table-wrap">
            <table class="admin-table" aria-label="Audit logs">
              <thead>
                <tr>
                  <th scope="col">{{ $t('admin.action') }}</th>
                  <th scope="col">{{ $t('admin.targetType') }}</th>
                  <th scope="col">{{ $t('admin.targetId') }}</th>
                  <th scope="col">{{ $t('admin.adminUser') }}</th>
                  <th scope="col">{{ $t('admin.createdAt') }}</th>
                  <th scope="col">{{ $t('admin.details') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in auditLogs" :key="log.id">
                  <td>{{ log.action }}</td>
                  <td>{{ log.targetType }}</td>
                  <td>{{ log.targetId || '–' }}</td>
                  <td>{{ log.adminUsername || '–' }}</td>
                  <td>{{ formatDate(log.createdAt) }}</td>
                  <td class="admin-details-cell">{{ formatDetails(log.details) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-pagination">
            <button type="button" :disabled="auditPage <= 1" @click="auditPage--; fetchAuditLogs()">{{ $t('admin.back') }}</button>
            <span>{{ $t('admin.pageOf', { current: auditPage, total: auditTotalPages }) }}</span>
            <button type="button" :disabled="auditPage >= auditTotalPages" @click="auditPage++; fetchAuditLogs()">{{ $t('admin.next') }}</button>
          </div>
        </template>
      </section>

      <!-- Add category modal -->
      <div v-if="showAddCategoryModal" class="admin-modal-overlay" @click.self="closeAddCategoryModal">
        <div class="admin-modal" role="dialog" aria-labelledby="add-category-modal-title" aria-modal="true">
          <h2 id="add-category-modal-title">{{ $t('admin.addCategory') }}</h2>
          <p v-if="addCategoryError" class="admin-error">{{ addCategoryError }}</p>
          <div class="admin-modal-form">
            <label for="add-cat-name">{{ $t('admin.name') }} *</label>
            <input
              id="add-cat-name"
              v-model="addCategoryForm.name"
              type="text"
              :placeholder="$t('admin.addCategoryNamePlaceholder')"
            />

            <label for="add-cat-description">{{ $t('admin.description') }}</label>
            <input
              id="add-cat-description"
              v-model="addCategoryForm.description"
              type="text"
              :placeholder="$t('admin.addCategoryDescPlaceholder')"
            />

            <label for="add-cat-accent">{{ $t('admin.accent') }} ({{ $t('admin.color') }})</label>
            <input
              id="add-cat-accent"
              v-model="addCategoryForm.accent"
              type="text"
              placeholder="#05d9ff"
            />

            <label for="add-cat-difficulty">{{ $t('admin.difficulty') }}</label>
            <input
              id="add-cat-difficulty"
              v-model="addCategoryForm.difficulty"
              type="text"
              placeholder="easy"
            />

            <label for="add-cat-playlists">{{ $t('admin.playlistIds') }}</label>
            <textarea
              id="add-cat-playlists"
              v-model="addCategoryForm.playlistIdsStr"
              rows="2"
              :placeholder="$t('admin.addCategoryPlaceholderPlaylists')"
            />

            <label for="add-cat-tracks">{{ $t('admin.trackIds') }}</label>
            <textarea
              id="add-cat-tracks"
              v-model="addCategoryForm.trackIdsStr"
              rows="2"
              :placeholder="$t('admin.addCategoryPlaceholderTracks')"
            />
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="btn" @click="closeAddCategoryModal">
              {{ $t('admin.cancel') }}
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="addCategorySaving || !addCategoryForm.name.trim()"
              @click="submitAddCategory"
            >
              {{ addCategorySaving ? '...' : $t('admin.addCategory') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Restore with new credentials modal -->
      <div v-if="restoreModalUser" class="admin-modal-overlay" @click.self="closeRestoreModal">
        <div class="admin-modal" role="dialog" aria-labelledby="restore-modal-title" aria-modal="true">
          <h2 id="restore-modal-title">{{ $t('admin.restoreConflictTitle') }}</h2>
          <p class="admin-modal-message">{{ $t('admin.restoreConflictMessage') }}</p>
          <div class="admin-modal-form">
            <label for="restore-modal-email">{{ $t('admin.newEmail') }}</label>
            <input id="restore-modal-email" v-model="restoreModalEmail" type="email" :placeholder="$t('auth.placeholderEmail')" />
            <label for="restore-modal-username">{{ $t('admin.newUsername') }}</label>
            <input id="restore-modal-username" v-model="restoreModalUsername" type="text" :placeholder="$t('auth.placeholderUsername')" />
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="btn" @click="closeRestoreModal">{{ $t('admin.cancel') }}</button>
            <button type="button" class="btn btn--primary" :disabled="restoringUserId === restoreModalUser?.id || !restoreModalEmail.trim() || !restoreModalUsername.trim()" @click="submitRestoreWithCredentials">
              {{ restoringUserId === restoreModalUser?.id ? '...' : $t('admin.restoreWithCredentials') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Add category modal -->
      <div v-if="showAddCategoryModal" class="admin-modal-overlay" @click.self="closeAddCategoryModal">
        <div class="admin-modal" role="dialog" aria-labelledby="add-category-title" aria-modal="true">
          <h2 id="add-category-title">{{ $t('admin.addCategory') }}</h2>
          <p v-if="addCategoryError" class="admin-error">{{ addCategoryError }}</p>
          <div class="admin-modal-form">
            <label for="add-cat-name">{{ $t('admin.name') }} *</label>
            <input id="add-cat-name" v-model="addCategoryForm.name" type="text" :placeholder="$t('admin.addCategoryNamePlaceholder')" />
            <label for="add-cat-desc">{{ $t('admin.description') }}</label>
            <input id="add-cat-desc" v-model="addCategoryForm.description" type="text" :placeholder="$t('admin.addCategoryDescPlaceholder')" />
            <label for="add-cat-accent">{{ $t('admin.accent') }} ({{ $t('admin.color') }})</label>
            <input id="add-cat-accent" v-model="addCategoryForm.accent" type="text" placeholder="#05d9ff" />
            <label for="add-cat-difficulty">{{ $t('admin.difficulty') }}</label>
            <input id="add-cat-difficulty" v-model="addCategoryForm.difficulty" type="text" placeholder="easy" />
            <label for="add-cat-playlists">{{ $t('admin.playlistIds') }} *</label>
            <textarea id="add-cat-playlists" v-model="addCategoryForm.playlistIdsStr" rows="2" :placeholder="$t('admin.addCategoryPlaylistsPlaceholder')"></textarea>
            <label for="add-cat-tracks">{{ $t('admin.trackIds') }}</label>
            <textarea id="add-cat-tracks" v-model="addCategoryForm.trackIdsStr" rows="2" :placeholder="$t('admin.addCategoryTracksPlaceholder')"></textarea>
          </div>
          <div class="admin-modal-actions">
            <button type="button" class="btn" @click="closeAddCategoryModal">{{ $t('admin.cancel') }}</button>
            <button type="button" class="btn btn--primary" :disabled="addCategorySaving" @click="submitAddCategory">
              {{ addCategorySaving ? '...' : $t('admin.addCategory') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  min-height: calc(100vh - 5rem);
  padding: 3rem 2rem;
  padding-top: 7rem;
  position: relative;
}

.admin-card {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 2.4rem;
}

.admin-card h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text, #f4f6ff);
  margin: 0 0 1.25rem 0;
}

.admin-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.admin-tabs button {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
}

.admin-tabs button.active {
  background: rgba(5, 217, 255, 0.2);
  border-color: rgba(5, 217, 255, 0.5);
}

.admin-section {
  margin-top: 0.5rem;
}

.admin-toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}

.admin-include-deleted {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.8);
  cursor: pointer;
}

.admin-badge {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  margin-left: 0.5rem;
}

.admin-badge--deleted {
  background: rgba(255, 79, 131, 0.2);
  color: #ffd9e5;
}

.admin-search {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 0.9rem;
  min-width: 200px;
}

.admin-error {
  color: #ff4f83;
  font-size: 0.9rem;
  margin: 0 0 0.5rem 0;
}

.admin-loading {
  color: rgba(234, 238, 255, 0.7);
  font-size: 0.9rem;
}

.admin-table-wrap {
  overflow-x: auto;
  margin-bottom: 1rem;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.admin-table th,
.admin-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-table th {
  color: rgba(234, 238, 255, 0.8);
  font-weight: 600;
}

.admin-details-cell {
  max-width: 200px;
  word-break: break-all;
}

.admin-table select {
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 0.85rem;
}

.admin-input {
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 0.85rem;
  width: 100%;
  min-width: 120px;
}

.admin-input--short {
  min-width: 80px;
  width: 100px;
}

.admin-input--ids {
  min-width: 160px;
  font-family: monospace;
}

.admin-details-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-pagination {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.8);
}

.admin-pagination button {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}

.admin-pagination button:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn.small {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
}

.btn.btn-restore {
  border-color: rgba(80, 255, 210, 0.5);
  background: rgba(80, 255, 210, 0.15);
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
