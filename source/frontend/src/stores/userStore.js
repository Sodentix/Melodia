import { reactive } from 'vue'
import { clearSession, getApiBase, getToken, getAuthHeaders } from '@/api/client'

export const userStore = reactive({
  user: null,
  avatarTimestamp: Date.now(),

  async deleteAvatarPath() {
    const base = getApiBase()
    const token = getToken()
    if (!base || !token) return
    const res = await fetch(`${base}/users/me/avatar`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error('Failed to delete avatar')
    if (this.user) {
      this.user.avatarUrl = null
      this.avatarTimestamp = Date.now()
      this.saveToStorage()
    }
  },

  init() {
    const stored = localStorage.getItem('melodia_user')
    if (stored) {
      try {
        this.user = JSON.parse(stored)
      } catch {
        this.user = null
      }
    }
  },

  setUser(userData) {
    this.user = userData
    this.saveToStorage()
  },

  setAvatarUrl(url) {
    if (this.user) {
      this.user.avatarUrl = url
      this.avatarTimestamp = Date.now()
      this.saveToStorage()
    }
  },

  clearUser() {
    this.user = null
    clearSession()
  },

  saveToStorage() {
    if (this.user) {
      localStorage.setItem('melodia_user', JSON.stringify(this.user))
    }
  }
})