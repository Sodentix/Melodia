<template>
    <div>
        <div class="leaderboard">
            <div class="content">
                <div class="topText">
                    <div>
                        <p class="textType1">Live Chart</p>
                        <p class="textType2">Top Players</p>
                    </div>
                    <div>
                        <p class="textType1">Your rank</p>
                        <p class="textType2">#12</p>
                    </div>
                </div>
                <div class="ranking">
                    <div class="podium">
                        <div class="podiumItem second">
                            <p class="textType1">2</p>
                            <p class="textType2 username" :title="leaderboard[1]?.username">
                            {{ leaderboard[1]?.username || "–" }}
                            </p>
                            <p class="textType2">{{ leaderboard[1]?.totalPoints.toLocaleString() }}</p>
                        </div>

                        <div class="podiumItem first">
                            <p class="textType1">1</p>
                            <p class="textType2 username" :title="leaderboard[0]?.username">
                                {{ leaderboard[0]?.username || "–" }}
                            </p>
                            <p class="textType2">{{ leaderboard[0]?.totalPoints.toLocaleString() }}</p>
                        </div>

                        <div class="podiumItem third">
                            <p class="textType1">3</p>
                            <p class="textType2 username" :title="leaderboard[2]?.username">
                                {{ leaderboard[2]?.username || "–" }}
                            </p>
                            <p class="textType2">{{ leaderboard[2]?.totalPoints.toLocaleString() }}</p>
                        </div>
                    </div>

                    <div class="leaderboard-list">
                        <table>
                            <thead>
                                <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="player in leaderboard" :key="player.username">
                                <td>#{{ player.rank }}</td>
                                <td>{{ player.username }}</td>
                                <td>{{ player.totalPoints.toLocaleString() }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from "axios";

const leaderboard = ref([]);

onMounted(async () => {
  try {
    const { data } = await axios.get("http://localhost:5000/stats/leaderboard");
    console.log(data);
    leaderboard.value = data.leaderboard || [];
  } catch (err) {
    console.error("Fehler:", err);
  }
})
</script>


<style scoped>
.leaderboard {
    background-color: var(--card);
    width: 40rem;
    height: 33rem;
    border: 1px solid rgba(255,255,255,0.03);
    padding-top: 0;
    border-radius: 16px;
}

.content {
    padding: 1rem;
}

.topText {
    display: flex;
    justify-content: space-between;
    line-height: 1.5rem;
}

.ranking {
    margin: 2.5rem;
    height: 26rem;
    border: 1px solid rgba(255,255,255,0.03);
    border-radius: 16px;
}

.podium {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 1rem;
    margin: 2rem;
}

.podiumItem {
    background-color: var(--stroke);
    text-align: center;
    width: 9rem;
    border-radius: 16px;
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
}

.podiumItem.first {
    transform: translateY(-1.5rem);
}

.podiumItem.second {
    transform: translateY(-0.7rem);
}

.podiumItem.third {
    transform: translateY(0);
}


table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}

th, td {
  padding: 0.5rem;
  color: var(--text);
}

th {
  opacity: 0.8;
  font-weight: 600;
}

td {
  font-weight: 500;
}

.textType1 {
  font-size: 0.95rem;
  color: var(--text);
  opacity: 0.8;
}

.textType2 {
  font-weight: 700;
  font-size: 1.3rem;
  color: var(--text);
}

/* Nur für DarkLord--85 */
.username {
  display: inline-block;
  max-width: 7rem;          /* Breite begrenzen */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
  transition: color 0.2s;
}

.username:hover {
  color: #93c5fd;           /* leichtes Blau beim Hover */
}
</style>
