<template>
  <div class="auth-animation" :class="{ 'is-register': isRegisterMode }">
    <button
      type="button"
      class="mode-toggle"
      @click="toggleMode"
      :aria-pressed="isRegisterMode"
    >
      <span class="sr-only">
        Switch to {{ isRegisterMode ? 'Login' : 'Register' }} layout
      </span>
      <span class="mode-thumb"></span>
    </button>

    <div class="panel accent-panel" aria-hidden="true"></div>

    <div class="panel neutral-panel">
      <div class="content-block" aria-hidden="true"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const isRegisterMode = ref(false)

const toggleMode = () => {
  isRegisterMode.value = !isRegisterMode.value
}
</script>

<style scoped>
.auth-animation {
  position: relative;
  display: flex;
  min-height: 100vh;
  background: #ffffff;
  transition: flex-direction 0.6s ease;
}

.auth-animation.is-register {
  flex-direction: row-reverse;
}

.mode-toggle {
  --thumb-gap: clamp(0.35rem, calc(1vw + 0.1rem), 0.55rem);

  position: absolute;
  top: clamp(1.5rem, 5vw, 2.5rem);
  right: clamp(1.5rem, 6vw, 3rem);
  width: clamp(4.5rem, 12vw, 6rem);
  height: clamp(1.9rem, 6vw, 2.4rem);
  z-index: 3;
  border: none;
  border-radius: 999px;
  background: #d9d9d9;
  cursor: pointer;
  padding: 0;
  transition: background 0.35s ease;
}

.mode-toggle:focus-visible {
  outline: 3px solid rgba(139, 0, 0, 0.45);
  outline-offset: 4px;
}

.mode-thumb {
  position: absolute;
  top: var(--thumb-gap);
  bottom: var(--thumb-gap);
  left: var(--thumb-gap);
  width: calc(50% - var(--thumb-gap));
  border-radius: 999px;
  background: #5d0000;
  transition: transform 0.4s ease;
}

.auth-animation.is-register .mode-thumb {
  transform: translateX(100%);
}

.panel {
  flex: 1 1 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.6s ease;
}

.accent-panel {
  background: #e50000;
}

.neutral-panel {
  position: relative;
  background: #ffffff;
  padding: clamp(2rem, 8vw, 5rem);
}

.auth-animation.is-register .neutral-panel {
  background: #d9d9d9;
}

.content-block {
  width: min(20rem, 60%);
  aspect-ratio: 1 / 1;
  background: #4e4e4e;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 900px) {
  .auth-animation {
    flex-direction: column;
  }

  .auth-animation.is-register {
    flex-direction: column;
  }

  .panel {
    flex: 1 1 auto;
    min-height: 50vh;
  }

  .mode-toggle {
    top: clamp(1rem, 6vw, 2rem);
    right: clamp(1rem, 8vw, 2.4rem);
  }
}
</style>
