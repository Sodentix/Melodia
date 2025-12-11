/*
 * Service to fetch song previews from Deezer API and save them as JSON files.
 * Runs on startup and then every 5 minutes.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const categories = {
  all: {
    playlistIds: [1282483245, 8282573142, 2159765062, 8074581462],
    name: "Hit Mix",
    description: "A mix of all available songs",
    difficulty: "medium",
    accent: "#FF0055"
  },
  holiday: {
    playlistIds: [8454338222],
    name: "Holiday Vibes",
    description: "Festive tunes for the season",
    difficulty: "easy",
    accent: "#00FF55"
  }
};

// Output directories
const outputDir = path.join(__dirname, '../assets/songData');
const categoriesDir = path.join(__dirname, '../assets/categories');

// Ensure output directories exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(categoriesDir)) {
  fs.mkdirSync(categoriesDir, { recursive: true });
}

// Fetch tracks from a single playlist
async function fetchPlaylistPreviews(playlistId, minRank = 0) {
  try {
    const url = `https://api.deezer.com/playlist/${playlistId}`;
    const response = await axios.get(url);

    if(!response.data || !response.data.tracks || !response.data.tracks.data){
        console.warn("⚠️ Playlist mit der ID " + playlistId + " ist ungültig")
        return []
    }

    const tracks = response.data.tracks.data;

    return tracks
      .filter(t => t.preview && t.rank >= minRank)
      .map(t => ({
        id: t.id,
        artist: t.artist ? t.artist.name : 'Unknown Artist',
        title: t.title,
        url: t.preview
      }));
  } catch (error) {
    console.error(`❌ Error fetching playlist ${playlistId}:`, error.message);
    return [];
  }
}

// Gather data for all categories
async function gatherAllCategoryData() {
  const collected = {};

  for (const [category, data] of Object.entries(categories)) {
    collected[category] = [];

    for (const playlistId of data.playlistIds) {
      const tracks = await fetchPlaylistPreviews(playlistId);
      collected[category].push(...tracks);
    }

    // Remove duplicates based on Track ID
    const uniqueTracks = Array.from(
      new Map(collected[category].map(t => [t.id, t])).values()
    );

    collected[category] = uniqueTracks;
  }

  return collected;
}

// Write data to JSON files
function writeCategoryFiles(data) {
  for (const [category, tracks] of Object.entries(data)) {
    const outputFile = path.join(outputDir, `${category}.json`);
    try {
      fs.writeFileSync(outputFile, JSON.stringify(tracks, null, 2));
      console.log(`📁 ${category}: ${tracks.length} tracks saved to ${outputFile}`);
    } catch (err) {
      console.error(`❌ Error writing file ${outputFile}:`, err.message);
    }
  }
}

// Generate categories.json file
function generateCategoriesFile() {
  const categoryList = Object.entries(categories).map(([id, data]) => ({
    id: id,
    name: data.name,
    description: data.description,
    difficulty: data.difficulty,
    accent: data.accent
  }));

  const outputFile = path.join(categoriesDir, 'categories.json');
  try {
    fs.writeFileSync(outputFile, JSON.stringify(categoryList, null, 2));
    console.log(`📁 Categories metadata saved to ${outputFile}`);
  } catch (err) {
    console.error(`❌ Error writing categories file:`, err.message);
  }
}

// Main update function
async function updateAllCategories() {
  console.log("🔄 [SongService] Starting playlist update...", new Date().toLocaleTimeString());

  try {
    const allData = await gatherAllCategoryData();
    writeCategoryFiles(allData);
    generateCategoriesFile(); // Generate categories.json
    console.log("✅ [SongService] Playlist update completed.\n");
  } catch (err) {
    console.error("❌ [SongService] Update failed:", err);
  }
}

// Service entry point
function startSongGenerationService() {
  // Run immediately on start
  updateAllCategories();

  // Schedule cron job (every 5 minutes)
  cron.schedule('*/5 * * * *', () => {
    updateAllCategories();
  });
}

module.exports = { startSongGenerationService };
