<script setup>
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

// Der Status, ob bearbeitet wird (später via Props)
const isBeingChanged = ref(false);
</script>

<template>
  <div class="demo-layout">
    
    <div class="orb-container">
      
      <div class="profile-orb">
        <Icon icon="solar:user-bold-duotone" class="userIcon" />
      </div>

      <div v-if="isBeingChanged" class="edit-badge">
        <Icon icon="solar:pen-2-bold" class="editIcon" />
      </div>

    </div>

    <button class="toggle-btn" @click="isBeingChanged = !isBeingChanged">
      Toggle Edit: {{ isBeingChanged }}
    </button>

  </div>
</template>

<style scoped>
/* Layout für die Demo: Orb links, Button rechts */
.demo-layout {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 2rem;
}

/* WICHTIG: position: relative, damit der Stift absolut dazu positioniert werden kann */
.orb-container {
  position: relative;
  width: max-content;
}

/* --- Profile Orb Styles (Original) --- */
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

.profile-orb:hover {
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

/* --- Der Stift (Edit Badge) --- */
.edit-badge {
  position: absolute;
  bottom: -4px; /* Überlappt den unteren Rand */
  right: -4px;  /* Überlappt den rechten Rand */
  
  width: 20px;
  height: 20px;
  border-radius: 50%;
  
  /* Dunkler Hintergrund oder Akzentfarbe für Kontrast */
  background: rgba(20, 20, 30, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 5px rgba(0,0,0,0.5);

  
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* Animation beim Erscheinen */
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.edit-badge :deep(.editIcon) {
  font-size: 12px;
  color: #fff;
}

@keyframes popIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* --- Nur für den Test-Button --- */
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