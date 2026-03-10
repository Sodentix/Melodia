<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="legal-page">
    <div class="page-bg"></div>
    <div class="legal-page__card card glass-card">
      <h1 class="legal-page__title">{{ $t('nav.terms') }}</h1>
      <p class="legal-page__updated">
        {{ $t('termsPage.updated') }}
      </p>

      <section class="legal-page__section">
        <h2>{{ $t('termsPage.acceptanceTitle') }}</h2>
        <p>{{ $t('termsPage.acceptanceBody') }}</p>
      </section>

      <section class="legal-page__section">
        <h2>{{ $t('termsPage.useTitle') }}</h2>
        <p>{{ $t('termsPage.useBody') }}</p>
      </section>

      <section class="legal-page__section">
        <h2>{{ $t('termsPage.accountTitle') }}</h2>
        <p>{{ $t('termsPage.accountBody') }}</p>
      </section>

      <section class="legal-page__section">
        <h2>{{ $t('termsPage.terminationTitle') }}</h2>
        <p>{{ $t('termsPage.terminationBody') }}</p>
      </section>

      <RouterLink to="/home" class="btn btn--primary legal-page__back">
        {{ $t('termsPage.back') }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  min-height: 100vh;
  padding: 2rem;
  padding-top: 7rem;
  position: relative;
}

.legal-page__card {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem;
}

.legal-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.5rem 0;
}

.legal-page__updated {
  font-size: 0.875rem;
  color: rgba(234, 238, 255, 0.6);
  margin: 0 0 1.5rem 0;
}

.legal-page__section {
  margin-bottom: 1.5rem;
}

.legal-page__section h2 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 0.5rem 0;
}

.legal-page__section p {
  font-size: 0.95rem;
  line-height: 1.5;
  color: rgba(234, 238, 255, 0.85);
  margin: 0;
}

.legal-page__back {
  display: inline-block;
  margin-top: 1rem;
}
</style>
