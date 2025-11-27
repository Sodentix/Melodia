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
          <BaseCard
            class="gamemodeCard"
            title="Start Your Game"
            description="Wähle deinen Modus und Rate drauf los"
            icon="mdi:music"
            iconColor="purple"
            cardWidth="100%"
            cardHeight="12rem"
          />
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
        <BaseCard
          class="explanationCard"
          title="1. Listen"
          description="Ein kurzer Song-Ausschnitt startet. Lausche genau auf Melodie und Rhythmus."
          icon="fa6-solid:headphones"
          iconColor="#b3b300"
          cardWidth="100%"
          cardHeight="16rem"
        />
        <BaseCard
          class="explanationCard"
          title="2. Guess"
          description="Tippe den Titel oder Künstler ein - je schneller du rätst, desto mehr Punkte gibt's!"
          icon="mdi:lightbulb-on-outline"
          iconColor="#b3b300"
          cardWidth="100%"
          cardHeight="16rem"
        />
        <BaseCard
          class="explanationCard"
          title="3. Score"
          description="Verdiene Punkte, steige im Ranking auf und werde der ultimative Beat-Master."
          icon="mdi:star-shooting-outline"
          iconColor="#b3b300"
          cardWidth="100%"
          cardHeight="16rem"
        />
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
  line-height: 1.2;
  margin-bottom: 0.5rem;
}

p, h2 {
  color: var(--text);
  line-height: 1.5;
}

.gamemodeDiv {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  padding-top: 2rem;
}

.gamemodeCard {
  height: 100%;
}

.leaderboardDiv {
  flex: 1 1 360px;
  width: 100%;
  display: flex;
  justify-content: flex-end;
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 3rem 0;
}

.topSection {
  display: flex;
  flex-wrap: wrap;
  gap: 4rem;
  justify-content: space-between;
}

.topLeft {
  flex-direction: column;
  flex: 1 1 320px;
  min-width: 0;
}

.main {
  margin: 5rem auto 0;
  padding: 0 3rem 2.5rem;
  width: 100%;
  max-width: 1920px; /* Prevent extreme stretching on ultra-wide */
}

@media (max-width: 1000px) {
  .leaderboardDiv {
    justify-content: center;
  }
}

@media (max-width: 900px) {
  .main {
    margin-top: 3rem;
    padding: 0 1.25rem 2rem;
  }

  h1 {
    font-size: 2.25rem;
  }

  .leaderboardDiv {
    padding-right: 0;
    order: 3;
  }

  .gamemodeDiv,
  .explanationDiv {
    grid-template-columns: 1fr;
  }

  .explanationCard {
    width: 100%;
  }

  .topSection {
    flex-direction: column;
  }
}
</style>
