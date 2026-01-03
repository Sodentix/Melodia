<script setup>
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { userStore } from '@/stores/userStore';

const props = defineProps({
  canToggle: {
    type: Boolean,
    default: true,
  },
  isEditable: {
    type: Boolean,
    default: false,
  },
  previewImage: {
    type: String,
    default: null,
  },
  size: {
    type: Number,
    default: 72,
  },
  staticSrc: {
    type: String,
    default: null
  }
});

const isOrbActive = ref(false);

const finalImageSrc = computed(() => {
  // Vorschau - Bild wird angezeigt nach upload
  if (props.previewImage) {
    return props.previewImage;
  }

  // Store an sich
  if (props.staticSrc) {
    return props.staticSrc;
  }

  if (userStore.user && userStore.user.avatarUrl) {
    const rawUrl = userStore.user.avatarUrl;
    
    const baseUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/\/$/, '') 
      : '';
      
    const fullUrl = rawUrl.startsWith('http') 
      ? rawUrl 
      : `${baseUrl}${rawUrl}`;


    // Falls später auch URL erlaubt ist, ist das essentiell!!
    return `${fullUrl}?t=${userStore.avatarTimestamp}`;
  }

  return null;
});

const handleOrbClick = () => {
  if (!props.canToggle) return;

  isOrbActive.value = !isOrbActive.value;
};
</script>

<template>
  <div class="orb-wrapper">
    <div
      class="profile-orb"
      :class="{
        'is-active': isOrbActive,
        'is-clickable': canToggle,
      }"
      :style="{ width: size + 'px', height: size + 'px' }"
      @click="handleOrbClick"
    >
      <img
        v-if="finalImageSrc"
        :src="finalImageSrc"
        alt="Profile"
        class="profile-image"
      />
      
      <Icon
        v-else
        icon="solar:user-bold-duotone"
        class="userIcon"
      />
    </div>

    <div
      v-if="isEditable"
      class="edit-badge"
      :style="{
        width: size * 0.4 + 'px',
        height: size * 0.4 + 'px',
      }"
    >
      <Icon
        icon="solar:pen-2-bold"
        class="editIcon"
        :style="{ fontSize: size * 0.22 + 'px' }"
      />
    </div>
  </div>
</template>

<style scoped>
svg {
  height: 60%;
  width: 60%;
}

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
  cursor: default;
  overflow: hidden;

  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 0, 200, 0.55),
    rgba(0, 236, 255, 0.5),
    rgba(61, 255, 140, 0.45)
  );

  box-shadow:
    0 0 14px rgba(255, 0, 200, 0.55),
    0 0 28px rgba(0, 236, 255, 0.45),
    0 0 42px rgba(61, 255, 140, 0.35);

  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.12);

  transition:
    transform 0.22s ease,
    box-shadow 0.24s ease;
}

.profile-orb.is-clickable {
  cursor: pointer;
}

.profile-orb:hover,
.profile-orb.is-active {
  transform: translateY(-2px);
  box-shadow:
    0 0 20px rgba(255, 0, 200, 0.75),
    0 0 32px rgba(0, 236, 255, 0.6),
    0 0 50px rgba(61, 255, 140, 0.5);
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
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
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
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
