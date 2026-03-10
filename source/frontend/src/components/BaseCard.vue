<script setup>
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false,
    default: ''
  },
  icon: {
    type: String,
    required: false, 
  },
  // Farbe für das große Hintergrund-Icon
  iconColor: {
    type: String,
    required: false,
    default: 'currentColor'
  },
  cardWidth: {
    type: String,
    required: false,
    default: '15rem'
  },
  cardHeight: {
    type: String,
    required: false,
    default: '16rem'
  }
});

const cardStyle = computed(() => ({
  width: '100%',
  maxWidth: props.cardWidth,
  minHeight: props.cardHeight,
}));
</script>

<template>
  <div class="game-card" :style="cardStyle">
    
    <div class="bg-icon-wrapper" :style="{ color: iconColor }">
      <Icon
        :icon="icon"
        width="120%"
        height="120%"
      />
    </div>

    <div class="text-content">
      <p class="title">{{ title }}</p>
      <p class="description">{{ description }}</p>
    </div>

    <div class="play-action-wrapper">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24"
        class="play-svg"
      >
        <defs>
          <linearGradient id="triColorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="var(--accent-pink, #f02eaa)" />
            <stop offset="50%" stop-color="var(--accent-cyan, #06b6d4)" />
            <stop offset="100%" stop-color="var(--accent-green, #4ade80)" />
          </linearGradient>
        </defs>
        
        <path 
          class="play-path"
          fill="url(#triColorGrad)" 
          d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10S17.523 2 12 2M9.5 16.5v-9l7 4.5z"
        />
      </svg>
    </div>

  </div>
</template>

<style scoped>
.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  
  background: rgba(10, 12, 28, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 1.5rem;
  padding: 1.5rem;
  overflow: hidden;
  cursor: pointer;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 79, 219, 0.04);
  transition: transform 0.28s ease, box-shadow 0.28s ease, filter 0.28s ease;
}

/* --- Hintergrund Icon --- */
.bg-icon-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-10deg);
  width: 100%;
  height: 100%;
  opacity: 0.08; /* Subtil */
  z-index: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.4s ease, opacity 0.4s ease;
}

/* --- Text Content --- */
.text-content {
  position: relative;
  z-index: 2;
  text-align: center;
  margin-bottom: 1rem;
}

.title {
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--text);
  margin-bottom: 0.2rem;
  text-transform: uppercase;
  letter-spacing: 0.05rem;
}

.description {
  font-size: 0.9rem;
  color: var(--text);
  opacity: 0.7;
}

/* --- Play Button Wrapper --- */
.play-action-wrapper {
  position: relative;
  z-index: 5;
  width: 4.5rem;
  height: 4.5rem;
  margin-top: auto;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* Ein Glow hinter dem Button (nutzt die Pinke Akzentfarbe) */
.play-action-wrapper::after {
  content: '';
  position: absolute;
  top: 15%;
  left: 15%;
  width: 70%;
  height: 70%;
  border-radius: 50%;
  background: var(--accent-pink, #f02eaa);
  z-index: -1;
  filter: blur(15px);
  animation: pulse-glow 3s infinite;
}

.play-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
}

.play-path {
  transition: filter 0.3s ease;
}

/* --- HOVER EFFEKTE (Der "Alte" Look + Game Feel) --- */

.game-card:hover {
  transform: translateY(-0.3rem);
  
  /* HIER IST DER ALTE GESTAFFELTE SCHATTEN */
  box-shadow: 
    rgba(240, 46, 170, 0.4) 5px 5px, 
    rgba(240, 46, 170, 0.3) 10px 10px, 
    rgba(240, 46, 170, 0.2) 15px 15px, 
    rgba(240, 46, 170, 0.1) 20px 20px, 
    rgba(240, 46, 170, 0.05) 25px 25px;
    
  /* Helligkeit leicht erhöht (brightness(2) ist oft zu extrem für Text, 1.15 ist safer) */
  filter: brightness(1.15);
}

/* Button springt beim Hover */
.game-card:hover .play-action-wrapper {
  transform: scale(1.25);
}

/* Button leuchtet heller (macht die Farben knalliger) */
.game-card:hover .play-path {
  filter: brightness(1.2);
}

/* Hintergrund-Icon bewegt sich */
.game-card:hover .bg-icon-wrapper {
  transform: translate(-50%, -50%) rotate(0deg) scale(1.15);
  opacity: 0.15;
}

@keyframes pulse-glow {
  0% { transform: scale(0.8); opacity: 0.3; }
  50% { transform: scale(1.1); opacity: 0.6; }
  100% { transform: scale(0.8); opacity: 0.3; }
}
</style>