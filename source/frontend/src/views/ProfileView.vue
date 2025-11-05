<template>
  <div>
    <h1>Profile</h1>
    <section v-if="loading">Loading stats…</section>
    <section v-else>
      <h2>Your Stats</h2>
      <ul>
        <li>Total Played: {{ stats.totalPlayed }}</li>
        <li>Total Wins: {{ stats.totalWins }}</li>
        <li>Correct Guesses: {{ stats.correctGuesses }}</li>
        <li>Wrong Guesses: {{ stats.wrongGuesses }}</li>
        <li>Best Time (ms): {{ stats.bestTimeMs ?? '—' }}</li>
        <li>Average Time (ms): {{ stats.averageTimeMs ?? '—' }}</li>
        <li>Current Streak: {{ stats.currentStreak }}</li>
        <li>Best Streak: {{ stats.bestStreak }}</li>
        <li>Last Played: {{ stats.lastPlayedAt || '—' }}</li>
      </ul>
    </section>
  </div>
  
</template>

<script>
export default {
  name: 'ProfileView',
  data() {
    return {
      loading: true,
      stats: {
        totalPlayed: 0,
        totalWins: 0,
        correctGuesses: 0,
        wrongGuesses: 0,
        bestTimeMs: null,
        averageTimeMs: null,
        currentStreak: 0,
        bestStreak: 0,
        lastPlayedAt: null,
      },
    };
  },
  async mounted() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/stats/me`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (res.ok) {
        this.stats = await res.json();
      }
    } finally {
      this.loading = false;
    }
  },
};
</script>
