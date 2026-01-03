<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import Navbar from '@/components/NavbarComponent.vue'
import { onMounted } from 'vue';
import { userStore } from './stores/userStore';


onMounted(() => {
  userStore.init();
});

const route = useRoute()
const showNavbar = computed(() => {
  return route.name !== 'game'
})
</script>

<template>
  <div>
    <Navbar v-if="showNavbar"/>
    <RouterView />
  </div>
  
</template>

<style scoped>
</style>
