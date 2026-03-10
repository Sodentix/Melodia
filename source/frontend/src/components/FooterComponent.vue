<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <footer class="footer">
    <RouterLink to="/privacy" class="footer__link">{{ $t('nav.privacy') }}</RouterLink>
    <span class="footer__sep">|</span>
    <RouterLink to="/terms" class="footer__link">{{ $t('nav.terms') }}</RouterLink>
  </footer>
</template>

<style scoped>
.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  font-size: 0.875rem;
}

.footer__link {
  color: rgba(234, 238, 255, 0.7);
  text-decoration: none;
}

.footer__link:hover {
  color: var(--text);
  text-decoration: underline;
}

.footer__sep {
  color: rgba(234, 238, 255, 0.5);
}
</style>
