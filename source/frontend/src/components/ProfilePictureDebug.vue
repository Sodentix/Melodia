<script setup>
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

// Definition der Props, die von außen reinkommen
const props = defineProps({
  // 1. Das Bild: Ist es leer, wird das Icon gezeigt. Kein Import-Crash mehr.
  imageSrc: {
    type: String,
    default: null
  },
  // 2. Der "Modus": Darf man klicken? (True/False)
  canToggle: {
    type: Boolean,
    default: true
  },
  // 3. Edit Mode (optional, falls du den Stift von außen steuern willst)
  isEditable: {
    type: Boolean,
    default: false
  }
});

const isOrbActive = ref(false);

const handleOrbClick = () => {
  // Wenn canToggle FALSE ist, brechen wir hier sofort ab.
  // Es passiert also nichts (kein active State).
  if (!props.canToggle) return;

  isOrbActive.value = !isOrbActive.value;
}
</script>

<template>
  <div class="orb-wrapper">
    
    <div 
      class="profile-orb" 
      :class="{ 
        'is-active': isOrbActive, 
        'is-clickable': canToggle 
      }"
      @click="handleOrbClick"
    >
      <img
        v-if="imageSrc"
        :src="imageSrc"
        alt="Profile"
        class="profile-image"
      />
      <Icon
        v-else
        icon="solar:user-bold-duotone"
        class="userIcon"
      />
    </div>

    <div v-if="isEditable" class="edit-badge">
      <Icon icon="solar:pen-2-bold" class="editIcon" />
    </div>

  </div>
</template>

<style scoped>
.orb-wrapper {
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
  
  /* DEFAULT: Cursor ist normal (keine Hand), da wir nur Hover haben */
  cursor: default; 
  overflow: hidden; /* Wichtig für runde Bilder */

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

/* LOGIK FÜR DEN MAUSZEIGER:
   Nur wenn die Klasse .is-clickable drauf ist (via Prop),
   wird der Cursor zur Hand (Pointer).
*/
.profile-orb.is-clickable {
  cursor: pointer;
}

/* HOVER & ACTIVE EFFEKT:
   Passiert immer beim Hovern.
   Passiert dauerhaft, wenn .is-active gesetzt ist.
*/
.profile-orb:hover,
.profile-orb.is-active {
  transform: translateY(-2px);
  box-shadow:
    0 0 20px rgba(255, 0, 200, 0.75),
    0 0 32px rgba(0, 236, 255, 0.60),
    0 0 50px rgba(61, 255, 140, 0.50);
}

.profile-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-orb :deep(.userIcon) {
  font-size: 22px;
  color: white;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.7));
}

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
  pointer-events: none;
  z-index: 10;
}

.edit-badge :deep(.editIcon) {
  font-size: 12px;
  color: #fff;
}

@keyframes popIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
