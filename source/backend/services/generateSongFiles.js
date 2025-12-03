/*
Ein JSON pro Kategorie (pop.json, christmas.json, …)
Mehrere Playlists pro Kategorie (Array in CATEGORIES)
Keine Duplikate → anhand der Deezer-Track-ID
Nur Tracks mit Preview werden gespeichert
Zufällige Auswahl im Game möglich durch Math.random auf das JSON
→ Alle 5 Minuten neues Komplett-Build
→ Datei wird erst geschrieben, wenn ALLES gesammelt wurde
*/

import axios from "axios";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import { fileURLToPath } from "url";

const categories = {
  christmas: [8454338222],
  pop: [1282483245, 8282573142]
};

// __dirname für ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfad für die Speicherung
const outputDir = path.join(__dirname, "../assets/songData");

// Playlist abrufen → gefilterte Tracks zurückgeben
async function fetchPlaylistPreviews(playlistId, minRank = 0) {
  const url = `https://api.deezer.com/playlist/${playlistId}`;
  const response = await axios.get(url);
  const tracks = response.data.tracks.data;

  return tracks
    .filter(t => t.preview && t.rank >= minRank)
    .map(t => ({
      id: t.id,
      artist: t.artist.name,
      title: t.title,
      url: t.preview
    }));
}

// Für jede Kategorie: alle Playlists laden → Tracks sammeln
async function gatherAllCategoryData() {
  const collected = {}; // { pop: [...], christmas: [...] }

  for (const [category, playlistIds] of Object.entries(categories)) {
    collected[category] = [];

    for (const playlistId of playlistIds) {
      const tracks = await fetchPlaylistPreviews(playlistId);
      collected[category].push(...tracks);
    }

    // Duplikate entfernen → anhand der Track-ID
    collected[category] = Array.from(
      new Map(collected[category].map(t => [t.id, t])).values()
    );
  }

  return collected;
}

// Erst schreiben, wenn ALLES gesammelt wurde
function writeCategoryFiles(data) {
  for (const [category, tracks] of Object.entries(data)) {
    const outputFile = path.join(outputDir, `${category}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(tracks, null, 2));
    console.log(`📁 ${tracks.length} Tracks gespeichert → ${outputFile}`);
  }
}

async function updateAllCategories() {
  console.log("🔄 Playlist-Update gestartet", new Date().toLocaleTimeString());

  const allData = await gatherAllCategoryData();
  writeCategoryFiles(allData);

  console.log("✅ Playlist-Update beendet\n");
}

// Initiales Update
updateAllCategories();

// Alle 5 Minuten neu
cron.schedule("*/5 * * * *", () => {
  updateAllCategories();
});
