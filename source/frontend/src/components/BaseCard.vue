<script setup>
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
  iconColor: {
    type: String,
    required: false,
    default: 'red'
  },
  iconWidth: {
    type: String,
    required: false,
    default: '7rem' // bisherige Breite
  },
  iconHeight: {
    type: String,
    required: false,
    default: '7rem' // bisherige Höhe
  },
  cardWidth: {
    type: String,
    required: false,
    default: '15rem'
  },
  cardHeight: {
    type: String,
    required: false,
    default: '14rem'
  }
});
</script>

<template>
  <div class="card" :style="{ width: cardWidth, height: cardHeight }">
    <div class="imageContent">
      <Icon
        :icon="icon"
        :width="iconWidth"
        :height="iconHeight"
        :color="iconColor"
      />
    </div>
    <div class="textContent">
      <p class="title">{{ title }}</p>
      <p class="description">{{ description }}</p>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  justify-content: center;
  background-color: var(--card);
  padding: 1rem;
  border-radius: 1rem;
  gap: 0.5rem;
  transition: transform 0.28s ease, box-shadow 0.28s ease;
}

.title {
  font-weight: 700;
  font-size: 1.2rem;
  color: var(--text);
}

.description {
  font-size: 0.95rem;
  color: var(--text);
  opacity: 0.8;
}

.card:hover {
  transform: translateY(-0.3rem);
  filter: brightness(2);
}

</style>
