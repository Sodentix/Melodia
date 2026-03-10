import { ref } from 'vue'

/** Global error state for error boundary. Set by app.config.errorHandler or onErrorCaptured. */
export const appError = ref(null)

export function setAppError(err) {
  appError.value = err
}

export function clearAppError() {
  appError.value = null
}

export const errorStore = {
  appError,
  setError: setAppError,
  clearError: clearAppError
}
