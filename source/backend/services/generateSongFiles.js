/*
 * Service to fetch song previews from Deezer API and save them as JSON files.
 * Reads categories from categories.json. Runs on startup and every 5 minutes.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { listCategories } = require('./categoryService');

const outputDir = path.join(__dirname, '../assets/songData');
const categoriesDir = path.join(__dirname, '../assets/categories');

// Legacy default mapping for categories that don't yet have playlistIds/trackIds
// in categories.json. This keeps existing categories working until you update
// them via the admin UI.
const LEGACY_CATEGORY_SOURCES = {
  pop: { playlistIds: [1282483245, 8282573142, 2159765062, 8074581462] },
  holiday: { playlistIds: [8454338222] },
  masterplaylist: { playlistIds: [14800694023] },
  newAlternative: { playlistIds: [1402845615] },
  hiphop: { playlistIds: [14800693283] },
  eightiesNineties: { playlistIds: [13785202001] },
};

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(categoriesDir)) {
  fs.mkdirSync(categoriesDir, { recursive: true });
}

async function fetchPlaylistPreviews(playlistId, minRank = 0) {
  try {
    const allTracks = [];
    let index = 0;
    const limit = 100;
    let totalTracks = null;
    let totalFetched = 0;

    while (true) {
      const url = `https://api.deezer.com/playlist/${playlistId}/tracks?limit=${limit}&index=${index}`;
      const response = await axios.get(url);

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        break;
      }

      if (totalTracks === null && response.data.total !== undefined) {
        totalTracks = response.data.total;
      }

      const tracks = response.data.data;
      totalFetched += tracks.length;

      const validTracks = tracks
        .filter((t) => t.preview && t.rank >= minRank)
        .map((t) => ({
          id: t.id,
          artist: t.artist ? t.artist.name : 'Unknown Artist',
          title: t.title,
          url: t.preview,
        }));

      allTracks.push(...validTracks);

      if (totalTracks !== null && totalFetched >= totalTracks) break;
      if (tracks.length < limit) break;

      index += limit;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`✅ Fetched ${allTracks.length} tracks from playlist ${playlistId}`);
    return allTracks;
  } catch (error) {
    console.error(`❌ Error fetching playlist ${playlistId}:`, error.message);
    return [];
  }
}

async function fetchTrackPreviews(trackIds) {
  const results = [];
  for (const trackId of trackIds) {
    try {
      const url = `https://api.deezer.com/track/${trackId}`;
      const response = await axios.get(url);
      const t = response.data;
      if (t && t.preview) {
        results.push({
          id: t.id,
          artist: t.artist ? t.artist.name : 'Unknown Artist',
          title: t.title,
          url: t.preview,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`❌ Error fetching track ${trackId}:`, err.message);
    }
  }
  return results;
}

async function gatherCategoryData(category) {
  const legacy = LEGACY_CATEGORY_SOURCES[category.id] || {};
  const playlistIdsFromCat = Array.isArray(category.playlistIds) ? category.playlistIds : [];
  const trackIdsFromCat = Array.isArray(category.trackIds) ? category.trackIds : [];

  // Use explicit values from categories.json when present; otherwise fall back
  // to the legacy hard-coded mapping.
  const playlistIds =
    playlistIdsFromCat.length > 0 ? playlistIdsFromCat : Array.isArray(legacy.playlistIds) ? legacy.playlistIds : [];
  const trackIds =
    trackIdsFromCat.length > 0 ? trackIdsFromCat : Array.isArray(legacy.trackIds) ? legacy.trackIds : [];
  const allTracks = [];

  for (const pid of playlistIds) {
    const tracks = await fetchPlaylistPreviews(pid);
    allTracks.push(...tracks);
  }

  if (trackIds.length > 0) {
    const tracks = await fetchTrackPreviews(trackIds);
    allTracks.push(...tracks);
  }

  return Array.from(new Map(allTracks.map((t) => [t.id, t])).values());
}

async function gatherAllCategoryData() {
  const categories = listCategories();
  const collected = {};

  for (const cat of categories) {
    const tracks = await gatherCategoryData(cat);
    if (!tracks || tracks.length === 0) continue;
    collected[cat.id] = tracks;
  }

  return collected;
}

function writeCategoryFiles(data) {
  for (const [categoryId, tracks] of Object.entries(data)) {
    const outputFile = path.join(outputDir, `${categoryId}.json`);
    try {
      fs.writeFileSync(outputFile, JSON.stringify(tracks, null, 2));
      console.log(`📁 ${categoryId}: ${tracks.length} tracks saved`);
    } catch (err) {
      console.error(`❌ Error writing ${outputFile}:`, err.message);
    }
  }
}

async function updateAllCategories() {
  console.log('🔄 [SongService] Starting playlist update...', new Date().toLocaleTimeString());
  try {
    const allData = await gatherAllCategoryData();
    writeCategoryFiles(allData);
    console.log('✅ [SongService] Playlist update completed.\n');
  } catch (err) {
    console.error('❌ [SongService] Update failed:', err);
  }
}

async function updateCategoryById(categoryId) {
  const categories = listCategories();
  const cat = categories.find((c) => String(c.id).toLowerCase() === String(categoryId).toLowerCase());
  if (!cat) {
    throw new Error(`Category "${categoryId}" not found`);
  }
  const tracks = await gatherCategoryData(cat);
  if (!tracks || tracks.length === 0) {
    throw new Error(`Category "${categoryId}" has no usable playlist or track IDs`);
  }
  const outputFile = path.join(outputDir, `${cat.id}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(tracks, null, 2));
  console.log(`📁 ${cat.id}: ${tracks.length} tracks saved (manual refresh)`);
  return tracks;
}

function startSongGenerationService() {
  updateAllCategories();
  cron.schedule('*/5 * * * *', () => {
    updateAllCategories();
  });
}

module.exports = {
  startSongGenerationService,
  updateAllCategories,
  updateCategoryById,
};