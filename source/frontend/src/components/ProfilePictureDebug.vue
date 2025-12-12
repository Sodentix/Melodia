<script setup>
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

// Der Status, ob bearbeitet wird (später via Props)
const isBeingChanged = ref(false);

const isOrbActive = ref(false);

const toggleOrb = () => {
  isOrbActive.value = !isOrbActive.value;
}
</script>

<template>
  <div class="demo-layout">
    
    <div class="orb-container">
      
      <div 
        class="profile-orb" 
        :class="{ 'is-active': isOrbActive }"
        @click="toggleOrb"
      >
        <Icon icon="solar:user-bold-duotone" class="userIcon" />
      </div>

      <div v-if="isBeingChanged" class="edit-badge">
        <Icon icon="solar:pen-2-bold" class="editIcon" />
      </div>

    </div>

    <button class="toggle-btn" @click="isBeingChanged = !isBeingChanged">
      Toggle Edit Badge
    </button>

  </div>
</template>

<style scoped>
.demo-layout {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 2rem;
}

.orb-container {
  position: relative;
  width: max-content;
}

.profile-orb {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 0, 200, 0.55),
    rgba(0, 236, 255, 0.50),
    rgba(61, 255, 140, 0.45)
  );

  box-shadow:
    0 0 14px rgba(255, 0, 200, 0.55),
    0 0 28px rgba(0, 236, 255, 0.45),
    0 0 42px rgba(61, 255, 140, 0.35);

  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.12);

  transition: transform 0.22s ease, box-shadow 0.24s ease;
}

/* WICHTIG: Hier fügen wir die Klasse .is-active hinzu.
   Das Komma bedeutet "ODER". 
   Die Styles greifen also bei Hover ODER bei Klick (is-active).
*/
.profile-orb:hover,
.profile-orb.is-active {
  transform: translateY(-2px);
  box-shadow:
    0 0 20px rgba(255, 0, 200, 0.75),
    0 0 32px rgba(0, 236, 255, 0.60),
    0 0 50px rgba(61, 255, 140, 0.50);
}

.profile-orb :deep(.userIcon) {
  font-size: 22px;
  color: white;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.7));
}

/* Stift Badge Styles bleiben gleich... */
.edit-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(20, 20, 30, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 5px rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  /* Damit Klicks auf den Stift nicht den Orb auslösen (optional) */
  pointer-events: none; 
}

.edit-badge :deep(.editIcon) {
  font-size: 12px;
  color: #fff;
}

@keyframes popIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.toggle-btn {
  padding: 8px 16px;
  background: #333;
  color: white;
  border: 1px solid #555;
  border-radius: 6px;
  cursor: pointer;
}
.toggle-btn:hover {
  background: #444;
}
</style>