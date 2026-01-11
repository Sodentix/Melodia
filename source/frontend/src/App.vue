<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed, onMounted, ref } from 'vue' 
import Navbar from '@/components/NavbarComponent.vue'
import { userStore } from './stores/userStore';
import axios from 'axios';

const isInitializing = ref(true);

async function validateSession() {
  const token = localStorage.getItem('melodia_token');
  
  if (!token) {
    userStore.clearUser();
    isInitializing.value = false; // App is ready
    return;
  }

  try {
    const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/isAuthed`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (data?.loggedIn && data.user) {
      userStore.setUser(data.user); 
    } else {
      userStore.clearUser();
    }
  } catch (e) {
    userStore.clearUser();
  } finally {
    isInitializing.value = false; // Only stop loading after the check is completely done (success or fail)
  }
}

onMounted(() => {
  validateSession();
});

const route = useRoute()
const showNavbar = computed(() => {
  return route.name !== 'game'
})
</script>

<template>
  <div v-if="isInitializing" class="loading-screen">
    Loading...
  </div>

  <div v-else>
    <Navbar v-if="showNavbar"/>
    <RouterView />
  </div>
</template>