<script setup>
import { ref, onErrorCaptured, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import ErrorBoundary from './ErrorBoundary.vue'

const hasError = ref(false)
const errorDetails = ref(null)
const route = useRoute()

onErrorCaptured((err, instance, info) => {
  console.error('[ErrorBoundary] Caught error:', err, info)
  hasError.value = true
  errorDetails.value = { err, info }
  return false // Prevent propagation
})

// Reset error state on route change so user can try navigating to a different page
watch(() => route.path, () => {
  hasError.value = false
  errorDetails.value = null
})

function handleReload() {
  hasError.value = false
  errorDetails.value = null
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload()
  }
}
</script>

<template>
  <ErrorBoundary v-if="hasError" :error="errorDetails?.err" @reload="handleReload" />
  <RouterView v-else />
</template>
