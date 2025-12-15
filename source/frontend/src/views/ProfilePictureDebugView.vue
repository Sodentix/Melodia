<script setup>
import { ref } from 'vue';
import ProfilePictureDebug from '@/components/ProfilePictureDebug.vue';
import testProfilePicture from '@/components/1.jpg';

const imageSrc = ref(testProfilePicture);
const canToggle = ref(true);
const isEditable = ref(true);
</script>

<template>
  <div class="debug-layout">
    <h1 class="debug-title">Profile Picture Debug</h1>

    <ProfilePictureDebug
      :image-src="imageSrc"
      :can-toggle="canToggle"
      :is-editable="isEditable"
    />
  </div>
</template>

<style scoped>
.debug-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 1.5rem;
  padding: 2rem;
}

.debug-title {
  font-size: 1.4rem;
  font-weight: 600;
}
</style>
