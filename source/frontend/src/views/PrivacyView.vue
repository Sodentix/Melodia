<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="legal-page">
    <div class="page-bg"></div>
    <div class="legal-page__card card glass-card">
      <h1 class="legal-page__title">{{ $t('nav.privacy') }}</h1>
      <div class="legal-page__content">
        <section>
          <h2>{{ $t('privacyPage.sectionCollectTitle') }}</h2>
          <p>{{ $t('privacyPage.sectionCollectBody') }}</p>
        </section>
        <section>
          <h2>{{ $t('privacyPage.sectionUseTitle') }}</h2>
          <p>{{ $t('privacyPage.sectionUseBody') }}</p>
        </section>
        <section>
          <h2>{{ $t('privacyPage.sectionCookiesTitle') }}</h2>
          <p>{{ $t('privacyPage.sectionCookiesBody') }}</p>
        </section>
        <section>
          <h2>{{ $t('privacyPage.sectionContactTitle') }}</h2>
          <p>{{ $t('privacyPage.sectionContactBody') }}</p>
        </section>
      </div>
      <button type="button" class="btn btn--secondary" @click="router.push({ name: 'home' })">
        {{ $t('privacyPage.back') }}
      </button>
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
}

.legal-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 1.5rem 0;
}

.legal-page__content {
  color: rgba(234, 238, 255, 0.9);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.legal-page__content section {
  margin-bottom: 1.25rem;
}

.legal-page__content h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 0.5rem 0;
}

.legal-page__content p {
  margin: 0;
  font-size: 0.95rem;
}
</style>
