<script setup>
import { onMounted } from 'vue'

// Hilfsfunktion zum Verknüpfen eines Farb-Inputs mit einer CSS-Variable
function bindColorInput(inputId, variableName) {
  const input = document.getElementById(inputId)
  if (!input) return

  // Beim Ändern des Farbwerts die CSS-Variable aktualisieren
  input.addEventListener('input', (event) => {
    document.documentElement.style.setProperty(variableName, event.target.value)
  })
}

onMounted(() => {
  // Inputs mit Variablen verbinden
  bindColorInput('gradientStartInput', '--gradient-start')
  bindColorInput('gradientMiddleInput', '--gradient-middle')
  bindColorInput('gradientEndInput', '--gradient-end')

  document.getElementById('gradientStartInput').value = --gradient-start
})
</script>

<template>
  <div>
    <h1 class="gradient-text">Eine Testseite</h1>
    <br>
    <input type="color" id="gradientStartInput" />
    <input type="color" id="gradientMiddleInput" />
    <input type="color" id="gradientEndInput" />
    <br>
    <button class="gradient-text"></button>
  </div>
</template>

<style scoped>
h1 {
  font-weight: 500;
  font-size: 2.6rem;
}

h3 {
  font-size: 1.2rem;
}

.gradient-text {
  /* Gradient auf den Text anwenden */
  display: inline-block;
  background: linear-gradient(
    90deg,
    var(--gradient-start),
    var(--gradient-middle),
    var(--gradient-end)
  );

  /* Text mit Gradient füllen */
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

</style>
