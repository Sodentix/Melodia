<template>
  <div>
    <h1>Game</h1>

    <div>
      <input v-model="query" @input="onSearch" placeholder="Search songs" />
      <ul v-if="suggestions.length">
        <li v-for="s in suggestions" :key="s.id" @click="selectTrack(s)">
          <img v-if="s.image" :src="s.image" alt="" width="40" height="40" />
          {{ s.name }} — {{ s.artists }}
        </li>
      </ul>
    </div>

    <div v-if="currentTrack">
      <p>Preview playing… guess the song!</p>
      <audio ref="audio" :src="currentTrack.preview_url" controls autoplay />
    </div>

    <div>
      <button @click="recordWin">I guessed it</button>
      <button @click="recordLoss">I missed it</button>
      <button @click="startRandom">Start random round</button>
    </div>

    <p v-if="message">{{ message }}</p>
  </div>
  
</template>

<script>
export default {
  name: 'GameView',
  data() {
    return { message: '', query: '', suggestions: [], currentTrack: null };
  },
  methods: {
    async onSearch() {
      const q = this.query.trim();
      if (!q) { this.suggestions = []; return; }
      const base = import.meta.env.VITE_API_URL || '';
      if (!base) { this.message = 'API base URL not configured'; return; }
      try {
        const res = await fetch(`${base}/spotify/search?q=` + encodeURIComponent(q));
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) { this.message = 'Search failed'; return; }
        const data = await res.json();
        this.suggestions = data.items || [];
      } catch (e) {
        this.message = 'Search error';
      }
    },
    selectTrack(track) {
      this.currentTrack = track;
      this.suggestions = [];
    },
    async startRandom() {
      const base = import.meta.env.VITE_API_URL || '';
      if (!base) { this.message = 'API base URL not configured'; return; }
      try {
        const res = await fetch(`${base}/spotify/random?preview=true`);
        const ct = res.headers.get('content-type') || '';
        if (!res.ok || !ct.includes('application/json')) { this.message = 'No random track found'; return; }
        this.currentTrack = await res.json();
        this.message = 'Random round started!';
      } catch (e) {
        this.message = 'Random fetch error';
      }
    },
    async record(win) {
      this.message = '';
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/game/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          win,
          correctGuesses: win ? 3 : 1,
          wrongGuesses: win ? 1 : 4,
          timeMs: win ? 1200 : 2000,
          mode: 'classic',
        }),
      });
      this.message = res.ok ? 'Recorded!' : 'Failed to record';
    },
    recordWin() { return this.record(true); },
    recordLoss() { return this.record(false); },
  },
};
</script>
