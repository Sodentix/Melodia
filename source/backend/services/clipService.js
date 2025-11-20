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
  const filePath = path.join(assetsDir, 'categories', `${categoryId}${CATEGORY_TRACK_SUFFIX}`);
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const tracks = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.tracks)
        ? parsed.tracks
        : [];
    const meta = Array.isArray(parsed) ? {} : parsed;
    const displayName =
      meta.name ||
      meta.categoryName ||
      meta.category?.name ||
      categoryId;

    return tracks
      .filter((t) => t && t.file)
      .map((t) => ({
        ...t,
        categoryId: t.categoryId || categoryId,
        categoryName: t.categoryName || displayName,
      }));
  } catch (err) {
    logDebug('category_tracks_read_failed', { categoryId, err: err.message });
    return [];
  }
}

function simplifyClip(entry, baseUrl) {
  return {
    id: entry.id,
    name: entry.name,
    artists: (entry.artists || []).map(n => ({ id: null, name: n })),
    album: null,
    image: entry.image || null,
    preview_url: `${baseUrl}/clips/${encodeURIComponent(entry.file)}`,
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
    logDebug('no_local_clips_found', {
      assetsDir,
      clipsDir,
      tracksCount: tracks.length,
      filesInClipsDir: files,
      tracksSample: tracks.slice(0, 3),
    });
    // Auto-index fallback: build entries from existing audio files if tracks.json is empty/outdated
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
  if (existing.length === 0) {
    throw new Error('No local clips available');
  }

  let pool = existing;
  if (categoryId && categoryId !== 'all') {
    const fileTracks = readCategoryTracksFile(categoryId)
      .filter(t => fs.existsSync(path.join(clipsDir, t.file)));

    if (fileTracks.length > 0) {
      pool = fileTracks;
    } else {
      const filtered = filterByCategory(existing, categoryId);
      pool = filtered.length > 0 ? filtered : existing;
    }
  }

  if (pool.length === 0) {
    throw new Error('No clips available for selection.');
  }

  return pool;
}

async function fetchRandomClip(baseUrl, options = {}) {
  const { categoryId } = options;
  const pool = buildTrackPool(categoryId);
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

function searchClips(query, baseUrl) {
  const q = (query || '').toString().trim().toLowerCase();
  if (!q) return [];
  const items = listClips(baseUrl);
  return items.filter(it => {
    const hay = [it.name, ...(it.artists || []).map(a => a.name)].join(' ').toLowerCase();
    return hay.includes(q);
  }).slice(0, 20);
}

function listTracksByCategory(baseUrl, categoryId) {
  const pool = buildTrackPool(categoryId);
  return pool.map(entry => ({
    id: entry.id,
    name: entry.name,
    artists: (entry.artists || []).map(n => ({ id: null, name: n })),
    categoryId: entry.categoryId || 'all',
    categoryName: entry.categoryName || 'Hit Mix',
    preview_url: `${baseUrl}/clips/${encodeURIComponent(entry.file)}`,
  }));
}

module.exports = {
  fetchRandomClip,
  getLocalClipsStatus,
  listClips,
  searchClips,
  listTracksByCategory,
};


