<template>
  <div class="game-view">
    <h1>Guess The Song</h1>

    <!-- Audio Player -->
    <div v-if="currentRound" class="audio-section">
      <p class="game-instruction">Listen to the preview and guess the song!</p>
      <audio 
        ref="audioPlayer" 
        :src="currentRound.preview_url" 
        controls 
        autoplay
        @ended="onAudioEnded"
      />
      <div v-if="currentRound.guessCount > 0" class="guess-info">
        <p>Guesses: {{ currentRound.guessCount }}</p>
      </div>
    </div>

    <!-- Guess Input with Suggestions -->
    <div class="guess-section">
      <div class="input-wrapper">
        <input 
          v-model="guessInput" 
          @input="onGuessInput" 
          @keydown="handleKeydown"
          @focus="onInputFocus"
          placeholder="Type your guess..." 
          :disabled="!currentRound || isSubmitting"
          class="guess-input"
        />
        
        <!-- Suggestions Dropdown -->
        <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-dropdown">
          <div
            v-for="(suggestion, index) in suggestions"
            :key="suggestion.id"
            @click="selectSuggestion(suggestion)"
            @mouseenter="selectedIndex = index"
            :class="['suggestion-item', { selected: selectedIndex === index }]"
          >
            <img v-if="suggestion.image" :src="suggestion.image" alt="" class="suggestion-image" />
            <div class="suggestion-info">
              <div class="suggestion-name">{{ suggestion.name }}</div>
              <div class="suggestion-artists">
                {{ suggestion.artists.map(a => a.name).join(', ') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button 
        @click="submitGuess" 
        :disabled="!currentRound || !guessInput.trim() || isSubmitting"
        class="submit-btn"
      >
        {{ isSubmitting ? 'Submitting...' : 'Submit Guess' }}
      </button>
    </div>

    <!-- Game Controls -->
    <div class="game-controls">
      <button @click="startNewRound" :disabled="isSubmitting" class="control-btn">
        Start New Round
      </button>
      <button v-if="currentRound" @click="giveUp" :disabled="isSubmitting" class="control-btn secondary">
        Give Up
      </button>
    </div>

    <!-- Messages / Feedback -->
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>

    <!-- Points Display -->
    <div v-if="lastPoints > 0" class="points-display">
      <p>🎉 Correct! You earned {{ lastPoints }} points!</p>
    </div>

    <!-- Round Status -->
    <div v-if="currentRound && !currentRound.completed" class="round-status">
      <p>Round active - Make your guess!</p>
    </div>
  </div>
</template>

<script>
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
    };
  },
  mounted() {
    this.verifySession();
  },
  methods: {
    async verifySession() {
      const token = localStorage.getItem('melodia_token') || localStorage.getItem('token');
      if (!token) {
        this.handleInvalidSession('Bitte melde dich an, um zu spielen.');
        return;
      }

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
      } catch (error) {
        console.error('Session validation failed:', error);
        this.handleInvalidSession('Bitte melde dich erneut an.');
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

      try {
        const res = await fetch(`${base}/game/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to start round');
        }

        const data = await res.json();
        this.currentRound = {
          roundId: data.roundId,
          preview_url: data.preview_url,
          guessCount: 0,
          completed: false,
        };

        this.showMessage('success', 'Round started! Listen and guess the song.');
        
        // Auto-play audio
        this.$nextTick(() => {
          if (this.$refs.audioPlayer) {
            this.$refs.audioPlayer.play().catch(e => {
              console.warn('Auto-play prevented:', e);
            });
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
          this.lastPoints = data.points || 0;
          this.currentRound.completed = true;
          this.currentRound.guessCount = data.totalGuesses || 0;
          this.showMessage('success', `Correct! You earned ${data.points} points!`);
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

      this.currentRound.completed = true;
      this.showMessage('info', 'Round ended. Start a new round to continue playing.');
      
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.pause();
      }
    },

    onAudioEnded() {
      // Audio preview ended - can still make guesses
      if (this.currentRound && !this.currentRound.completed) {
        this.showMessage('info', 'Preview ended. You can still make guesses!');
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
  },
};
</script>

<style scoped>
.game-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  text-align: center;
  margin-bottom: 2rem;
}

.audio-section {
  margin-bottom: 2rem;
  text-align: center;
}

.game-instruction {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: #666;
}

audio {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.guess-info {
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #666;
}

.guess-section {
  margin-bottom: 2rem;
}

.input-wrapper {
  position: relative;
  margin-bottom: 1rem;
}

.guess-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box;
}

.guess-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.guess-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 4px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: #f5f5f5;
}

.suggestion-image {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  margin-right: 0.75rem;
}

.suggestion-info {
  flex: 1;
}

.suggestion-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.suggestion-artists {
  font-size: 0.9rem;
  color: #666;
}

.submit-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.submit-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.game-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.control-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.control-btn:hover:not(:disabled) {
  background-color: #0b7dda;
}

.control-btn.secondary {
  background-color: #ff9800;
}

.control-btn.secondary:hover:not(:disabled) {
  background-color: #e68900;
}

.control-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.message {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  text-align: center;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.points-display {
  text-align: center;
  padding: 1rem;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 1.2rem;
  font-weight: 600;
}

.round-status {
  text-align: center;
  padding: 0.5rem;
  color: #666;
  font-size: 0.9rem;
}
</style>
