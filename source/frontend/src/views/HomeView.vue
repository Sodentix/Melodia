<script>
import { defineComponent } from 'vue'
import BaseCard from '@/components/BaseCard.vue'
import LeaderboardComponent from '@/components/LeaderboardComponent.vue';

export default defineComponent({
  components: {
    BaseCard,
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
          <!-- Parameter sind title, description, icon, iconColor, iconWidth, iconHeight, cardWidth, cardHeight-->
          <!-- Icons werden je nach Icon-Collection unterschiedlich angegeben - in der Doku nachlesen!-->
          <BaseCard title="Free Play" description="Teste dein Können ohne Zeitdruck" icon="mdi:music" iconColor="purple"/>
          <BaseCard title="Challenge Mode" description="Spiele gegen die Uhr und erklimme das Leaderboard" icon="mdi:trophy-outline" iconColor="#b3b300"/>
        </div>
      </div>
      <div class="leaderboardDiv">
        <LeaderboardComponent/>
      </div>
    </div>
    <div class="bottomSection">
      <h1 id="howtoplay">How to play</h1>
      <h2>Drei einfache Schritte zwischen dir und dem Sieg. Höre, erkenne, und dominiere die Charts.</h2>
      <div class="explanationDiv">
        <BaseCard class="explanationCard" title="1. Listen" description="Ein kurzer Song-Ausschnitt startet. Lausche genau auf Melodie und Rhythmus." icon="fa6-solid:headphones" iconColor="#b3b300" cardWidth="23rem" cardHeight="16rem"/>
        <BaseCard class="explanationCard" title="2. Guess" description="Tippe den Titel oder Künstler ein - je schneller du rätst, desto mehr Punkte gibt's!" icon="mdi:lightbulb-on-outline" iconColor="#b3b300" cardWidth="23rem" cardHeight="16rem"/>
        <BaseCard class="explanationCard" title="3. Score" description="Verdiene Punkte, steige im Ranking auf und werde der ultimative Beat-Master." icon="mdi:star-shooting-outline" iconColor="#b3b300" cardWidth="23rem" cardHeight="16rem"/>
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

.explanationCard {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.explanationCard .textContent {
  text-align: center; 
}

.bottomSection {
  margin-top: 2rem;
  margin-bottom: 5rem;
}

.explanationDiv {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 3rem 4rem auto 4rem;
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
