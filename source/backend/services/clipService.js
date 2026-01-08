const fs = require('fs');
const path = require('path');

// Tracks metadata is expected at source/backend/assets/tracks.json
// Each entry: { id, name, artists: [string], file: "<filename>.mp3", duration_ms? }

let cache = null;
let lastMtime = 0;
const DEBUG_GAME = String(process.env.DEBUG_GAME || '').toLowerCase() === 'true';
const CATEGORY_TRACK_SUFFIX = '.tracks.json';

function logDebug(message, extra) {
  if (!DEBUG_GAME) return;
  const payload = { ts: new Date().toISOString(), area: 'clips', message };
  if (extra && typeof extra === 'object') Object.assign(payload, extra);
  try { console.log(JSON.stringify(payload)); } catch (_) { /* noop */ }
}

function getAssetsPath() {
  return path.join(__dirname, '..', 'assets');
}

function readTracksFile() {
  const assetsDir = getAssetsPath();
  const filePath = path.join(assetsDir, 'tracks.json');
  try {
    const stat = fs.statSync(filePath);
    if (!cache || stat.mtimeMs !== lastMtime) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(raw);
      cache = Array.isArray(json) ? json : [];
      lastMtime = stat.mtimeMs;
    }
  } catch (_) {
    cache = [];
  }
  return cache;
}

function readCategoryTracksFile(categoryId) {
  if (!categoryId) return [];
  const assetsDir = getAssetsPath();

  // Map category IDs to filenames in assets/songData/
  // Map category IDs to filenames in assets/songData/
  // User requested category names to be file names.
  // We expect {categoryId}.json to exist.
  const filename = categoryId;

  const filePath = path.join(assetsDir, 'songData', `${filename}.json`);

  try {
    if (!fs.existsSync(filePath)) {
      logDebug('category_file_not_found', { categoryId, filePath });
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const tracks = JSON.parse(raw); // Expecting array directly: [{id, artist, title, url}, ...]

    logDebug('category_file_read', { categoryId, trackCount: tracks.length });

    if (!Array.isArray(tracks)) {
      return [];
    }

    return tracks
      .filter((t) => t && t.url)
      .map((t) => ({
        id: `deezer-${t.id}`, // Prefix to avoid collisions
        name: t.title,
        artists: [t.artist], // Convert string to array
        file: t.url, // Remote URL
        image: null,
        duration_ms: 30000, // Default for previews
        categoryId: categoryId,
        categoryName: categoryId.charAt(0).toUpperCase() + categoryId.slice(1), // Simple capitalization
      }));
  } catch (err) {
    logDebug('category_tracks_read_failed', { categoryId, err: err.message });
    return [];
  }
}

function simplifyClip(entry, baseUrl) {
  let previewUrl = entry.file;
  // If not a remote URL, prepend base URL
  if (!previewUrl.startsWith('http')) {
    previewUrl = `${baseUrl}/clips/${encodeURIComponent(entry.file)}`;
  }

  return {
    id: entry.id,
    name: entry.name,
    artists: (entry.artists || []).map(n => ({ id: null, name: n })),
    album: null,
    image: entry.image || null,
    preview_url: previewUrl,
    external_urls: {},
    duration_ms: entry.duration_ms || null,
    categoryId: entry.categoryId || 'all',
    categoryName: entry.categoryName || 'Hit Mix',
  };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function filterByCategory(entries, categoryId) {
  if (!categoryId || categoryId === 'all') {
    return entries;
  }
  return entries.filter((entry) => (entry.categoryId || 'all') === categoryId);
}

function buildTrackPool(categoryId) {
  const assetsDir = getAssetsPath();
  const clipsDir = path.join(assetsDir, 'clips');

  // 1. Try to load from new songData JSONs first (including 'all' -> 'all.json')
  // This is the primary data source now.
  const fileTracks = readCategoryTracksFile(categoryId || 'all');
  const validRemoteTracks = fileTracks.filter(t => t.file.startsWith('http'));

  if (validRemoteTracks.length > 0) {
    return validRemoteTracks;
  }

  // 2. Fallback to local files (Legacy support)
  // Only executed if no remote tracks are found.
  const tracks = readTracksFile();
  let existing = tracks
    .filter(t => t && t.file && fs.existsSync(path.join(clipsDir, t.file)))
    .map(entry => ({
      ...entry,
      categoryId: entry.categoryId || 'all',
      categoryName: entry.categoryName || 'Hit Mix',
    }));

  if (existing.length === 0) {
    let files = [];
    try { files = fs.readdirSync(clipsDir); } catch (_) { /* ignore */ }

    // Auto-index fallback
    const audioExt = new Set(['.mp3', '.m4a', '.wav', '.ogg']);
    const auto = files
      .filter(f => audioExt.has(path.extname(f).toLowerCase()))
      .map(f => ({
        id: `auto-${f}`,
        name: path.parse(f).name,
        artists: ['Local Clip'],
        file: f,
        image: null,
        categoryId: 'all',
        categoryName: 'Hit Mix',
      }));
    existing = auto.filter(t => fs.existsSync(path.join(clipsDir, t.file)));
  }

  // Filter local clips by category if we fell back
  let pool = existing;
  if (categoryId && categoryId !== 'all') {
    const filtered = filterByCategory(existing, categoryId);
    pool = filtered.length > 0 ? filtered : existing;
  }

  if (pool.length === 0) {
    throw new Error('No clips available for selection.');
  }

  return pool;
}

async function fetchRandomClip(baseUrl, options = {}) {
  const { categoryId, excludeIds = [] } = options;
  let pool = buildTrackPool(categoryId);
  
  // Filter out already played songs if excludeIds provided
  if (excludeIds && excludeIds.length > 0) {
    const excludeSet = new Set(excludeIds);
    const filteredPool = pool.filter(track => !excludeSet.has(track.id));
    // Only use filtered pool if we still have songs left
    if (filteredPool.length > 0) {
      pool = filteredPool;
      logDebug('excluded_tracks', { excludedCount: excludeIds.length, remainingCount: filteredPool.length });
    } else {
      logDebug('exclude_reset', { reason: 'All tracks played, resetting pool' });
    }
  }
  
  const chosen = pickRandom(pool);
  return simplifyClip(chosen, baseUrl);
}

function getLocalClipsStatus() {
  const assetsDir = getAssetsPath();
  const clipsDir = path.join(assetsDir, 'clips');
  const tracks = readTracksFile();
  let files = [];
  try { files = fs.readdirSync(clipsDir); } catch (_) { /* ignore */ }
  const existing = tracks.filter(t => t && t.file && fs.existsSync(path.join(clipsDir, t.file)));
  return {
    assetsDir,
    clipsDir,
    tracksCount: tracks.length,
    existingCount: existing.length,
    filesInClipsDir: files,
    sampleTracks: tracks.slice(0, 5),
  };
}

function buildIndexFromFiles() {
  const assetsDir = getAssetsPath();
  const clipsDir = path.join(assetsDir, 'clips');
  let files = [];
  try { files = fs.readdirSync(clipsDir); } catch (_) { files = []; }
  const audioExt = new Set(['.mp3', '.m4a', '.wav', '.ogg']);
  return files
    .filter(f => audioExt.has(path.extname(f).toLowerCase()))
    .map(f => ({ id: `auto-${f}`, name: path.parse(f).name, artists: ['Local Clip'], file: f, image: null }));
}

function listClips(baseUrl) {
  const assetsDir = getAssetsPath();
  const clipsDir = path.join(assetsDir, 'clips');
  const fromJson = readTracksFile();
  const auto = buildIndexFromFiles();
  const byFile = new Map();
  for (const e of [...fromJson, ...auto]) {
    if (!e || !e.file) continue;
    const filepath = path.join(clipsDir, e.file);
    if (!fs.existsSync(filepath)) continue;
    byFile.set(e.file, e);
  }
  const entries = Array.from(byFile.values());
  return entries.map(e => simplifyClip(e, baseUrl));
}

// Normalize string for search (remove punctuation, special chars, normalize spaces)
function normalizeSearchString(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
}

function searchClips(query, baseUrl) {
  const q = normalizeSearchString(query);
  if (!q) return [];
  const items = listClips(baseUrl);
  return items.filter(it => {
    const hay = normalizeSearchString([it.name, ...(it.artists || []).map(a => a.name)].join(' '));
    return hay.includes(q);
  }).slice(0, 30); // Increased from 20 to 30 for more results
}

function listTracksByCategory(baseUrl, categoryId) {
  const pool = buildTrackPool(categoryId);
  return pool.map(entry => ({
    id: entry.id,
    name: entry.name,
    artists: (entry.artists || []).map(n => ({ id: null, name: n })),
    categoryId: entry.categoryId || 'all',
    categoryName: entry.categoryName || 'Hit Mix',
    preview_url: entry.file.startsWith('http') ? entry.file : `${baseUrl}/clips/${encodeURIComponent(entry.file)}`,
  }));
}

module.exports = {
  fetchRandomClip,
  getLocalClipsStatus,
  listClips,
  searchClips,
  listTracksByCategory,
};
