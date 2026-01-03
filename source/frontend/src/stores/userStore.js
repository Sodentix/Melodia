import { reactive } from 'vue';

export const userStore = reactive({
  user: null,
  avatarTimestamp: Date.now(), // Trick gegen Browser-Caching

  // Passiert beim App-Start
  init() {
    const stored = localStorage.getItem('melodia_user');
    if (stored) {
      try {
        this.user = JSON.parse(stored);
      } catch (e) {
        console.error('Fehler beim Laden des Users', e);
        this.user = null;
      }
    }
  },

  // User setzen
  setUser(userData) {
    this.user = userData;
    this.saveToStorage();
  },

  setAvatarUrl(url) {
    if (this.user) {
      this.user.avatarUrl = url;
      // WICHTIG: Timestamp ändern -> Weil erst dann laden die Comp. neu
      this.avatarTimestamp = Date.now(); 
      this.saveToStorage();
    }
  },

  clearUser() {
    this.user = null;
    localStorage.removeItem('melodia_user');
    localStorage.removeItem('melodia_token'); 
  },

  saveToStorage() {
    if (this.user) {
      localStorage.setItem('melodia_user', JSON.stringify(this.user));
    }
  }
});