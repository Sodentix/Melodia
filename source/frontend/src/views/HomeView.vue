<script>
import { defineComponent } from 'vue'
import GamemodeCard from '@/components/GamemodeCard.vue'
import LeaderboardComponent from '@/components/LeaderboardComponent.vue';

export default defineComponent({
  components: {
    GamemodeCard,
    LeaderboardComponent
  },
})
</script>

<template>
  <div class="main">
    <div class="topSection">
      <div class="topLeft">
        <h1>Kannst du den Song erraten?</h1>
        <h2>Teste dein Musikwissen. Spiel' gegen die Zeit. Erklimme das Leaderboard.</h2>
      
        <div class="gamemodeDiv">
          <!-- Parameter sind title, description, icon, iconColor, iconWidth und iconHeight-->
          <!-- Icons werden je nach Icon-Collection unterschiedlich angegeben - in der Doku nachlesen!-->
          <GamemodeCard title="Free Play" description="Teste dein Können ohne Zeitdruck" icon="mdi:music" iconColor="purple"/>
          <GamemodeCard title="Challenge Mode" description="Spiele gegen die Uhr und erklimme das Leaderboard" icon="mdi:trophy-outline" iconColor="yellow"/>
        </div>
      </div>
      <div class="leaderboardDiv">
        <LeaderboardComponent/>
      </div>
    </div>
  </div>
</template>

<style>
body {
  background-color: var(--bg);
}

h1 {
  background: linear-gradient(90deg, var(--accent-pink), var(--accent-cyan), var(--accent-green));
  background-size: 1000px; /* Große Breite, damit Gradient über mehrere Texte hinweg gleich bleibt */
  background-repeat: repeat;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 3rem;
  font-weight: 700;
}

p, h2 {
  color: var(--text);
}

.gamemodeDiv {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  padding-top: 2rem;
}

.leaderboardDiv {
  padding-right: 5rem;
}

.topSection {
  display: flex;
  flex-direction: row;
}

.topLeft {
  flex-direction: column;
}

.main {
  margin-top: 5rem;
  margin-left: 2.5rem;
}
</style>
