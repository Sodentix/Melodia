<template>
  <div class="game-view">
    <div class="background-glow"></div>

    <!-- Header -->
    <header class="game-header">
      <div class="header-left">
        <div class="mode-badge" :class="{ free: isFreeplay }">
          {{ isFreeplay ? 'Freeplay' : 'Competitive' }}
        </div>
        <div class="category-badge">
          {{ categoryLabel }}
        </div>
      </div>
      <div class="header-right">
        <button class="exit-btn" @click="$router.push('/game')">
          <span class="icon">✕</span>
          <span class="label">Exit</span>
        </button>
      </div>
    </header>

    <!-- Main Game Area -->
    <main class="game-stage">
      
      <!-- Status Messages (Toast style) -->
      <transition name="toast">
        <div v-if="message" :class="['status-toast', messageType]">
          <span class="status-icon">
            {{ messageType === 'success' ? '✓' : messageType === 'error' ? '✕' : 'ℹ' }}
          </span>
          <span class="status-text">{{ message }}</span>
        </div>
      </transition>

      <!-- Points Animation -->
      <transition name="pop">
        <div v-if="!isFreeplay && lastPoints > 0" class="points-pop">
          +{{ lastPoints }}
        </div>
      </transition>

      <!-- Countdown Timer (Competitive Mode Only) -->
      <div v-if="!isFreeplay && currentRound && !currentRound.completed" class="countdown-container">
        <svg class="countdown-ring" viewBox="0 0 100 100">
          <circle class="countdown-bg" cx="50" cy="50" r="45" />
          <circle 
            class="countdown-progress" 
            cx="50" cy="50" r="45"
            :style="{ strokeDashoffset: countdownOffset }"
          />
        </svg>
        <div class="countdown-time" :class="{ warning: timeRemaining <= 10 }">
          {{ timeRemaining }}
        </div>
      </div>

      <!-- Audio Visualizer / Player Placeholder -->
      <div class="audio-visualizer">
        <div ref="visualizerContainer" class="visualizer-container"></div>
        
        <div class="player-controls">
          <audio
            ref="audioPlayer"
            :src="currentRound?.preview_url"
            crossorigin="anonymous"
            controls
            autoplay
            @ended="onAudioEnded"
            @timeupdate="onTimeUpdate"
            class="hidden-audio"
          />
        </div>
      </div>

      <!-- Revealed Track Info (shown after round ends) -->
      <transition name="fade">
        <div v-if="revealedTrack && currentRound?.completed" class="revealed-track">
          <div class="revealed-label">{{ messageType === 'success' ? '🎉 Correct!' : '🎵 The song was:' }}</div>
          <div class="revealed-name">{{ revealedTrack.name }}</div>
          <div class="revealed-artist">
            {{ Array.isArray(revealedTrack.artists) 
                ? revealedTrack.artists.map(a => typeof a === 'string' ? a : a.name).join(', ')
                : '' }}
          </div>
        </div>
      </transition>

      <!-- Input Area -->
      <div class="input-area">
        <div class="input-wrapper" v-click-outside="closeSuggestions">
          <input
            v-model="guessInput"
            @input="onGuessInput"
            @keydown="handleKeydown"
            @focus="onInputFocus"
            placeholder="Type song or artist..."
            :disabled="!currentRound || isSubmitting || currentRound.completed"
            class="hero-input"
            ref="guessInputRef"
          />
          <div class="input-glow"></div>
          
          <!-- Suggestions -->
          <transition name="fade">
            <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-menu">
              <div
                v-for="(suggestion, index) in suggestions"
                :key="suggestion.id"
                @click="selectSuggestion(suggestion)"
                @mouseenter="selectedIndex = index"
                :class="['suggestion-item', { selected: selectedIndex === index }]"
              >
                <img v-if="suggestion.image" :src="suggestion.image" alt="" class="thumb" />
                <div class="info">
                  <div class="name">{{ suggestion.name }}</div>
                  <div class="artist">{{ suggestion.artists.map(a => a.name).join(', ') }}</div>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

    </main>

    <!-- Footer Controls -->
    <footer class="game-controls">
      <div class="controls-wrapper">
        <button 
          v-if="currentRound && !currentRound.completed" 
          @click="giveUp" 
          :disabled="isSubmitting" 
          class="control-btn give-up"
        >
          Give Up
        </button>
        
        <button 
          @click="startNewRound" 
          :disabled="isSubmitting" 
          class="control-btn next-round"
          :class="{ primary: !currentRound || currentRound.completed }"
        >
          {{ currentRound ? 'Next Round' : 'Start Game' }}
          <span class="arrow">→</span>
        </button>
      </div>
    </footer>
  </div>
</template>

<script>
import AudioMotionAnalyzer from 'audiomotion-analyzer';

export default {
  name: 'GameView',
  data() {
    return {
      guessInput: '',
      suggestions: [],
      showSuggestions: false,
      selectedIndex: -1,
      currentRound: null,
      isSubmitting: false,
      message: '',
      messageType: 'info', // 'info', 'success', 'error'
      lastPoints: 0,
      searchDebounceTimer: null,
      gameMode: localStorage.getItem('melodia_game_mode') || 'competitive',
      selectedCategory: null,
      categoryTracks: [],
      authToken: null,
      audioMotion: null,
      playedTrackIds: [], // Track played song IDs to prevent repetition
      revealedTrack: null, // Store revealed track info after round ends
      timeRemaining: 30, // Countdown timer in seconds
      audioDuration: 30, // Total audio duration
    };
  },
  mounted() {
    this.loadGameContext();
    this.verifySession();
    this.initVisualizer();
  },
  beforeUnmount() {
    if (this.audioMotion) {
      this.audioMotion.destroy();
    }
  },
  watch: {
    '$route.query': {
      deep: false,
      handler() {
        this.loadGameContext();
        if (this.authToken) {
          this.loadCategoryTracks();
        }
      },
    },
  },
  computed: {
    isFreeplay() {
      return this.gameMode === 'freeplay';
    },
    categoryLabel() {
      return this.selectedCategory?.name || this.selectedCategory?.categoryName || 'Hit Mix';
    },
    countdownOffset() {
      // Circle circumference = 2 * PI * radius = 2 * PI * 45 ≈ 283
      const circumference = 2 * Math.PI * 45;
      const progress = this.timeRemaining / this.audioDuration;
      return circumference * (1 - progress);
    },
  },
  methods: {
    loadGameContext() {
      const routeMode = this.$route.query.mode;
      if (routeMode === 'freeplay' || routeMode === 'competitive') {
        this.gameMode = routeMode;
        localStorage.setItem('melodia_game_mode', routeMode);
      } else {
        const storedMode = localStorage.getItem('melodia_game_mode');
        this.gameMode = storedMode === 'freeplay' ? 'freeplay' : 'competitive';
      }

      const routeCategory = this.$route.query.category;
      let parsedCategory = null;
      const categoryRaw = localStorage.getItem('melodia_game_category');
      if (categoryRaw) {
        try {
          parsedCategory = JSON.parse(categoryRaw);
        } catch (_) {
          parsedCategory = null;
        }
      }

      if (routeCategory) {
        const normalized = {
          id: routeCategory,
          categoryId: routeCategory,
          name: parsedCategory?.name || parsedCategory?.categoryName || 'Hit Mix',
          categoryName: parsedCategory?.name || parsedCategory?.categoryName || 'Hit Mix',
          accent: parsedCategory?.accent,
        };
        this.selectedCategory = normalized;
        localStorage.setItem('melodia_game_category', JSON.stringify(normalized));
      } else if (parsedCategory && (parsedCategory.id || parsedCategory.categoryId)) {
        this.selectedCategory = {
          id: parsedCategory.id || parsedCategory.categoryId,
          categoryId: parsedCategory.id || parsedCategory.categoryId,
          name: parsedCategory.name || parsedCategory.categoryName || 'Hit Mix',
          categoryName: parsedCategory.name || parsedCategory.categoryName || 'Hit Mix',
          accent: parsedCategory.accent,
        };
      } else {
        this.selectedCategory = null;
      }

      if (!this.selectedCategory) {
        this.$router.push('/game');
      }
    },
    async verifySession() {
      const token = localStorage.getItem('melodia_token') || localStorage.getItem('token');
      if (!token) {
        this.handleInvalidSession('Bitte melde dich an, um zu spielen.');
        return;
      }
      this.authToken = token;

      const base = import.meta.env.VITE_API_URL || '';
      if (!base) {
        this.showMessage('error', 'API base URL not configured');
        return;
      }

      const authBase = base.endsWith('/auth') ? base : `${base}/auth`;

      try {
        const res = await fetch(`${authBase}/isAuthed`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error('Session invalid');
        }

        const data = await res.json();
        if (!data.loggedIn) {
          this.handleInvalidSession('Bitte melde dich erneut an.');
          return;
        }

        if (data.user) {
          localStorage.setItem('melodia_user', JSON.stringify(data.user));
        }
        await this.loadCategoryTracks();
      } catch (error) {
        console.error('Session validation failed:', error);
        this.handleInvalidSession('Bitte melde dich erneut an.');
      }
    },

    async loadCategoryTracks() {
      if (!this.selectedCategory) {
        this.categoryTracks = [];
        return;
      }

      const base = import.meta.env.VITE_API_URL || '';
      if (!base) {
        return;
      }

      const token = this.authToken || localStorage.getItem('melodia_token') || localStorage.getItem('token');
      if (!token) {
        return;
      }

      const categoryId = this.selectedCategory.id || this.selectedCategory.categoryId || 'all';

      try {
        const res = await fetch(`${base}/game/category/${encodeURIComponent(categoryId)}/tracks`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          throw new Error('Failed to load category tracks');
        }
        const data = await res.json();
        this.categoryTracks = Array.isArray(data.tracks) ? data.tracks : [];
      } catch (error) {
        console.error('Load category tracks failed:', error);
        this.categoryTracks = [];
      }
    },

    handleInvalidSession(message = 'Session expired. Please log in again.') {
      localStorage.removeItem('melodia_token');
      localStorage.removeItem('token');
      localStorage.removeItem('melodia_user');
      this.showMessage('error', message);
      this.$router.push('/auth');
    },

    async onGuessInput() {
      const query = this.guessInput.trim();
      
      // Clear suggestions if input is empty
      if (!query) {
        this.suggestions = [];
        this.showSuggestions = false;
        return;
      }

      // Debounce search
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }

      this.searchDebounceTimer = setTimeout(async () => {
        await this.searchSuggestions(query);
      }, 300);
    },

    onInputFocus() {
      if (this.suggestions.length > 0) {
        this.showSuggestions = true;
      }
    },

    async searchSuggestions(query) {
      if (!query.trim()) {
        this.suggestions = [];
        this.showSuggestions = false;
        return;
      }

      const lowerQuery = query.toLowerCase();
      if (this.categoryTracks.length > 0) {
        const filtered = this.categoryTracks
          .filter((track) => {
            const haystack = [
              track.name,
              ...(track.artists || []).map((artist) => artist.name || ''),
            ]
              .join(' ')
              .toLowerCase();
            return haystack.includes(lowerQuery);
          })
          .slice(0, 8)
          .map((track) => ({
            id: track.id,
            name: track.name,
            artists: track.artists || [],
            image: track.image || null,
          }));
        this.suggestions = filtered;
        this.showSuggestions = filtered.length > 0;
        this.selectedIndex = -1;
        return;
      }

      const base = import.meta.env.VITE_API_URL || '';
      if (!base) {
        this.showMessage('error', 'API base URL not configured');
        return;
      }

      const token = localStorage.getItem('melodia_token') || localStorage.getItem('token');
      if (!token) {
        this.handleInvalidSession('Bitte melde dich an, um zu spielen.');
        return;
      }

      try {
        const res = await fetch(`${base}/library/search?q=${encodeURIComponent(query)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error('Search failed');
        }

        const data = await res.json();
        this.suggestions = data.items || [];
        this.showSuggestions = this.suggestions.length > 0;
        this.selectedIndex = -1;
      } catch (e) {
        console.error('Search error:', e);
        this.suggestions = [];
        this.showSuggestions = false;
      }
    },

    selectSuggestion(suggestion) {
      this.guessInput = suggestion.name;
      this.suggestions = [];
      this.showSuggestions = false;
      this.submitGuess();
    },

    closeSuggestions() {
      this.showSuggestions = false;
      this.selectedIndex = -1;
    },

    navigateSuggestions(direction) {
      if (!this.showSuggestions || this.suggestions.length === 0) {
        return;
      }

      this.selectedIndex += direction;
      
      if (this.selectedIndex < 0) {
        this.selectedIndex = this.suggestions.length - 1;
      } else if (this.selectedIndex >= this.suggestions.length) {
        this.selectedIndex = 0;
      }

      // Scroll selected item into view
      this.$nextTick(() => {
        const dropdown = this.$el.querySelector('.suggestions-dropdown');
        if (dropdown) {
          const selected = dropdown.querySelectorAll('.suggestion-item')[this.selectedIndex];
          if (selected) {
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      });
    },

    handleKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (this.showSuggestions && this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
          // Select highlighted suggestion
          this.selectSuggestion(this.suggestions[this.selectedIndex]);
        } else {
          // Submit current input
          this.submitGuess();
        }
      } else if (event.key === 'Escape') {
        this.closeSuggestions();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.navigateSuggestions(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.navigateSuggestions(-1);
      }
    },

    async startNewRound() {
      const base = import.meta.env.VITE_API_URL || '';
      if (!base) {
        this.showMessage('error', 'API base URL not configured');
        return;
      }

      if (!this.selectedCategory) {
        this.showMessage('error', 'Bitte wähle zuerst eine Kategorie.');
        this.$router.push('/game');
        return;
      }

      const token = localStorage.getItem('melodia_token') || localStorage.getItem('token');
      if (!token) {
        this.handleInvalidSession('Bitte melde dich an, um zu spielen.');
        return;
      }

      this.isSubmitting = true;
      this.message = '';
      this.lastPoints = 0;
      this.guessInput = '';
      this.suggestions = [];
      this.showSuggestions = false;
      this.revealedTrack = null; // Clear revealed track from previous round
      this.timeRemaining = 30; // Reset countdown timer
      this.audioDuration = 30;

      try {
        const res = await fetch(`${base}/game/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            mode: this.gameMode,
            categoryId:
              this.selectedCategory?.id ||
              this.selectedCategory?.categoryId ||
              'all',
            excludeIds: this.playedTrackIds, // Send played track IDs to avoid repetition
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to start round');
        }

        const data = await res.json();
        this.currentRound = {
          roundId: data.roundId,
          trackId: data.trackId, // Store track ID to add to played list later
          preview_url: data.preview_url,
          guessCount: 0,
          completed: false,
        };

        // Add track ID to played list to prevent repetition
        if (data.trackId && !this.playedTrackIds.includes(data.trackId)) {
          this.playedTrackIds.push(data.trackId);
        }

        this.showMessage('success', 'Round started! Listen and guess the song.');
        
        // Auto-play audio
        this.$nextTick(() => {
          if (this.$refs.audioPlayer) {
            this.$refs.audioPlayer.play().catch(e => {
              console.warn('Auto-play prevented:', e);
            });
            
            // Resume AudioContext if suspended (browser policy)
            if (this.audioMotion && this.audioMotion.audioCtx.state === 'suspended') {
              this.audioMotion.audioCtx.resume();
            }
          }
        });
      } catch (e) {
        console.error('Start round error:', e);
        this.showMessage('error', e.message || 'Failed to start round');
      } finally {
        this.isSubmitting = false;
      }
    },

    async submitGuess() {
      if (!this.currentRound || !this.guessInput.trim() || this.isSubmitting) {
        return;
      }

      const base = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('melodia_token') || localStorage.getItem('token');
      
      if (!token) {
        this.handleInvalidSession('Bitte melde dich an, um zu spielen.');
        return;
      }

      this.isSubmitting = true;
      this.showSuggestions = false;
      const guess = this.guessInput.trim();

      try {
        const res = await fetch(`${base}/game/guess`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            roundId: this.currentRound.roundId,
            guess: guess,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to submit guess');
        }

        const data = await res.json();
        
        if (data.correct) {
          // Correct guess!
          this.lastPoints = this.isFreeplay ? 0 : (data.points || 0);
          this.currentRound.completed = true;
          this.currentRound.guessCount = data.totalGuesses || 0;
          // Store the revealed track info
          if (data.track) {
            this.revealedTrack = data.track;
          }
          const successMessage = this.isFreeplay
            ? 'Correct! Freeplay run abgeschlossen.'
            : `Correct! You earned ${data.points} points!`;
          this.showMessage('success', successMessage);
          this.guessInput = '';
          
          // Stop audio
          if (this.$refs.audioPlayer) {
            this.$refs.audioPlayer.pause();
          }
        } else {
          // Wrong guess
          this.currentRound.guessCount = data.totalGuesses || 0;
          this.showMessage('error', 'Wrong guess! Try again.');
          this.guessInput = '';
          this.suggestions = [];
        }
      } catch (e) {
        console.error('Guess error:', e);
        this.showMessage('error', e.message || 'Failed to submit guess');
      } finally {
        this.isSubmitting = false;
      }
    },

    async giveUp() {
      if (!this.currentRound || this.isSubmitting) {
        return;
      }

      const base = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('melodia_token') || localStorage.getItem('token');

      this.isSubmitting = true;

      try {
        const res = await fetch(`${base}/game/giveup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            roundId: this.currentRound.roundId,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // Store revealed track info
          this.revealedTrack = data.track;
        }
      } catch (e) {
        console.error('Give up error:', e);
      } finally {
        this.isSubmitting = false;
      }

      this.currentRound.completed = true;
      
      // Show the song info if we got it
      if (this.revealedTrack) {
        const artistNames = Array.isArray(this.revealedTrack.artists)
          ? this.revealedTrack.artists.map(a => typeof a === 'string' ? a : a.name).join(', ')
          : '';
        this.showMessage('info', `The song was: ${this.revealedTrack.name} - ${artistNames}`);
      } else {
        this.showMessage('info', 'Round ended. Start a new round to continue playing.');
      }
      
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.pause();
      }
    },

    onAudioEnded() {
      // Audio preview ended
      const audio = this.$refs.audioPlayer;
      if ((this.currentRound && !this.currentRound.completed) && this.gameMode === 'freeplay') {
        // In freeplay mode, replay audio after 3 seconds
        this.showMessage('info', 'Audio replaying in 3 seconds!');
        setTimeout(() => {
          audio.play();
        }, 3000);
      } else if (this.currentRound && !this.currentRound.completed) {
        // In competitive mode, time is up - end the round and reveal the song
        this.giveUp();
      }
    },

    onTimeUpdate() {
      // Update countdown timer based on audio playback
      const audio = this.$refs.audioPlayer;
      if (audio && !this.isFreeplay && this.currentRound && !this.currentRound.completed) {
        const duration = audio.duration || 30;
        const currentTime = audio.currentTime || 0;
        this.audioDuration = Math.ceil(duration);
        this.timeRemaining = Math.max(0, Math.ceil(duration - currentTime));
      }
    },

    showMessage(type, text) {
      this.messageType = type;
      this.message = text;
      
      // Auto-clear success/info messages after 5 seconds
      if (type === 'success' || type === 'info') {
        setTimeout(() => {
          if (this.message === text) {
            this.message = '';
          }
        }, 5000);
      }
    },

    initVisualizer() {
      this.$nextTick(() => {
        const container = this.$refs.visualizerContainer;
        const audioEl = this.$refs.audioPlayer;

        if (container && audioEl) {
          try {
            this.audioMotion = new AudioMotionAnalyzer(container, {
              source: audioEl,
              mode: 2, // Octave bands
              barSpace: 0.6,
              ledBars: true,
              radial: true, // Radial visualization
              showScaleX: false,
              showPeaks: false,
              gradient: 'prism', // or custom gradient
              overlay: true,
              bgAlpha: 0, // Transparent background
              spinSpeed: 1,
              reflexRatio: 0.5,
              reflexAlpha: 0.25,
              alphaBars: false,
              ansiBands: false,
              channelLayout: 'single',
              frequencyScale: 'log',
              linearAmplitude: true,
              linearBoost: 1.6,
              lumiBars: false,
              maxDecibels: -25,
              minDecibels: -85,
              mirror: 0,
              noteLabels: false,
              outlineBars: false,
              showBgColor: false,
              showFPS: false,
              showScaleY: false,
              smoothing: 0.7,
              splitGradient: false,
              startBox: false,
              trueLeds: false,
              weightingFilter: 'D',
            });
          } catch (e) {
            console.error('Failed to init visualizer:', e);
          }
        }
      });
    },
  },
};
</script>

<style scoped>
.game-view {
  min-height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  color: white;
  overflow: hidden;
}

.background-glow {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 50% 30%, rgba(20, 30, 60, 1), #050505 80%);
  z-index: -1;
}

/* Header */
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  z-index: 10;
  position: absolute;
  width: 100%;
}

.header-left {
  display: flex;
  gap: 1rem;
}

.mode-badge, .category-badge {
  padding: 0.4rem 1rem;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.mode-badge.free {
  color: #fcd34d;
  border-color: rgba(252, 211, 77, 0.3);
  background: rgba(252, 211, 77, 0.1);
}

.exit-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.exit-btn:hover {
  color: white;
}

/* Main Stage */
.game-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  position: relative;
}

/* Countdown Timer */
.countdown-container {
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: 1rem;
}

.countdown-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.countdown-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 6;
}

.countdown-progress {
  fill: none;
  stroke: #00ecff;
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 283; /* 2 * PI * 45 */
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 0.3s ease, stroke 0.3s ease;
}

.countdown-time {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  font-variant-numeric: tabular-nums;
}

.countdown-time.warning {
  color: #ff6b6b;
  animation: pulse 1s ease-in-out infinite;
}

.countdown-time.warning + .countdown-ring .countdown-progress,
.countdown-container:has(.countdown-time.warning) .countdown-progress {
  stroke: #ff6b6b;
}

@keyframes pulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
  }
}

/* Visualizer */
.audio-visualizer {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.visualizer-container {
  width: 450px;
  height: 450px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
  overflow: hidden; /* Ensure canvas doesn't overflow circle */
}

.hidden-audio {
  display: none; /* Hide default player */
}

/* Responsiveness */
@media (max-width: 768px) {
  .game-header {
    padding: 1rem;
  }

  .game-stage {
    gap: 2rem;
    padding: 1rem;
  }

  .visualizer-container {
    width: 350px;
    height: 350px;
  }

  .hero-input {
    font-size: 1.2rem;
    padding: 1rem 1.5rem;
  }
}

@media (max-width: 480px) {
  .visualizer-container {
    width: 280px;
    height: 280px;
  }

  .instruction-text {
    font-size: 1rem;
  }

  .controls-wrapper {
    width: 100%;
    flex-direction: column-reverse;
    gap: 1rem;
  }

  .control-btn {
    width: 100%;
    justify-content: center;
  }
}

.instruction-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.instruction-text.idle {
  color: rgba(255, 255, 255, 0.5);
}

/* Revealed Track Info */
.revealed-track {
  text-align: center;
  padding: 1.5rem 2rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  max-width: 400px;
  margin-top: 1rem;
}

.revealed-label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.revealed-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.25rem;
}

.revealed-artist {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.7);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Toast transition */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

/* Pop transition */
.pop-enter-active {
  animation: pop-in 0.5s ease-out;
}

.pop-leave-active {
  animation: pop-out 0.3s ease-in;
}

@keyframes pop-in {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  70% {
    transform: translate(-50%, -50%) scale(1.1);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes pop-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
}

/* Input Area */
.input-area {
  width: 100%;
  max-width: 600px;
  position: relative;
  z-index: 20;
}

.input-wrapper {
  position: relative;
}

.hero-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 1.2rem 1.5rem;
  font-size: 1.5rem;
  color: white;
  text-align: center;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.hero-input:focus {
  outline: none;
  border-color: #00ecff;
  background: rgba(0, 0, 0, 0.8);
  box-shadow: 0 0 30px rgba(0, 236, 255, 0.15);
}

.hero-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.hero-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Suggestions */
.suggestions-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 1rem;
  background: rgba(15, 20, 35, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover, .suggestion-item.selected {
  background: rgba(255, 255, 255, 0.1);
}

.thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}

.info {
  flex: 1;
  text-align: left;
}

.name {
  font-weight: 600;
  color: white;
}

.artist {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

/* Toast Messages */
.status-toast {
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  color: black;
  padding: 0.8rem 1.5rem;
  border-radius: 99px;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.status-toast.error {
  background: #ff4d4d;
  color: white;
}

.status-toast.success {
  background: #00ecff;
  color: black;
}

.status-icon {
  font-size: 1.2rem;
}

/* Points Pop */
.points-pop {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 4rem;
  font-weight: 800;
  color: #00ecff;
  text-shadow: 0 0 20px rgba(0, 236, 255, 0.5);
  z-index: 50;
  pointer-events: none;
}

/* Controls */
.game-controls {
  padding: 1.5rem;
  display: flex;
  justify-content: center;
}

.controls-wrapper {
  display: flex;
  gap: 1rem;
}

.control-btn {
  padding: 1rem 2rem;
  border-radius: 99px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-size: 1rem;
  transition: all 0.2s;
}

.control-btn.primary {
  background: white;
  color: black;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-btn.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(255, 255, 255, 0.2);
}

.control-btn.give-up {
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.control-btn.give-up:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 720px) {
  .guess-actions {
    flex-direction: row;
    align-items: flex-start;
  }

  .submit-btn {
    width: auto;
    min-width: 180px;
  }
}

@media (max-width: 600px) {
  .control-btn {
    min-width: 100%;
  }

  .mode-banner {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 480px) {
  .panel {
    padding: 1rem;
    border-radius: 18px;
  }

  .chip {
    width: 100%;
    justify-content: center;
    font-size: 0.75rem;
  }

  .mode-banner {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .guess-actions {
    flex-direction: column;
  }

  .submit-btn {
    width: 100%;
  }

  .game-controls {
    flex-direction: column;
  }
}
</style>
