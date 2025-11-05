<script setup>
import { RouterLink, RouterView } from 'vue-router'
import Navbar from '@/components/NavbarComponent.vue'
</script>

<template>
  <div>
    <Navbar/>
    <RouterView />
  </div>
  
</template>

<style scoped>
</style>
