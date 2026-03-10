<script setup>
import { useI18n } from 'vue-i18n'

const emit = defineEmits(['reload'])
const { t } = useI18n()

function reload() {
  emit('reload')
}
</script>

<template>
  <div class="error-boundary">
    <div class="error-boundary__card card card--gradient">
      <h1 class="error-boundary__title">{{ $t('common.error') }}</h1>
      <p class="error-boundary__message">{{ $t('common.errorOccurred') }}</p>
      <button type="button" class="btn btn--primary" @click="reload">
        {{ $t('common.reload') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-boundary {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: var(--bg);
}

.error-boundary__card {
  max-width: 420px;
  text-align: center;
}

.error-boundary__title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
  margin: 0 0 1rem 0;
}

.error-boundary__message {
  color: rgba(234, 238, 255, 0.8);
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0 0 1.5rem 0;
}
</style>
