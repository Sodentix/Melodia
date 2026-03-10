<script>
import { defineComponent } from 'vue'
import BaseCard from '@/components/BaseCard.vue'
import LeaderboardComponent from '@/components/LeaderboardComponent.vue'
import SecondBaseCard from '@/components/SecondBaseCard.vue'
import FooterComponent from '@/components/FooterComponent.vue'

export default defineComponent({
  components: {
    BaseCard,
    SecondBaseCard,
    LeaderboardComponent,
    FooterComponent
  },
})
</script>

<template>
  <div class="main">
    <div class="page-bg"></div>
    <div class="topSection">
      <div class="topLeft">
        <h1>{{ $t('home.headline') }}</h1>
        <h2>{{ $t('home.subheadline') }}</h2>
      
        <div class="gamemodeDiv">
          <BaseCard
            class="gamemodeCard"
            :title="$t('home.startGame')"
            :description="$t('home.startGameDesc')"
            icon="mdi:music"
            iconColor="purple"
            cardWidth="100%"
            cardHeight="12rem"
            @click="$router.push({ name: 'game-select' })"
          />
        </div>
      </div>
      <div class="leaderboardDiv">
        <LeaderboardComponent/>
      </div>
    </div>
    <div class="bottomSection">
      <h1 id="howtoplay">{{ $t('home.howToPlayTitle') }}</h1>
      <h2>{{ $t('home.howToPlaySub') }}</h2>
      <div class="explanationDiv">
        <SecondBaseCard
          class="explanationCard"
          :title="$t('home.step1Title')"
          :description="$t('home.step1Desc')"
          icon="fa6-solid:headphones"
          iconColor="#b3b300"
          cardWidth="100%"
          cardHeight="16rem"
        />
        <SecondBaseCard
          class="explanationCard"
          :title="$t('home.step2Title')"
          :description="$t('home.step2Desc')"
          icon="mdi:lightbulb-on-outline"
          iconColor="#b3b300"
          cardWidth="100%"
          cardHeight="16rem"
        />
        <SecondBaseCard
          class="explanationCard"
          :title="$t('home.step3Title')"
          :description="$t('home.step3Desc')"
          icon="mdi:star-shooting-outline"
          iconColor="#b3b300"
          cardWidth="100%"
          cardHeight="16rem"
        />
      </div>
    </div>
    <FooterComponent />
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
  cursor: pointer;
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
  position: relative;
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
