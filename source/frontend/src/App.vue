<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import Navbar from '@/components/NavbarComponent.vue'
import { onMounted } from 'vue';
import { userStore } from './stores/userStore';


async function validateSession() {
  const token = localStorage.getItem('melodia_token');
  
  if (!token) {
    userStore.clearUser(); // Sicherstellen, dass wir sauber sind
    return;
  }

  try {
    // API Call...
    const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/isAuthed`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (data?.loggedIn && data.user) {
      // WICHTIG: Store mit den "echten" Server-Daten updaten
      // Falls sich das Bild im Backend geändert hat, wird es hier aktualisiert
      userStore.setUser(data.user); 
    } else {
      userStore.clearUser();
    }
  } catch (e) {
    userStore.clearUser();
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
  <div>
    <Navbar v-if="showNavbar"/>
    <RouterView />
  </div>
  
</template>

<style scoped>
</style>
