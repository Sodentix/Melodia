const fs = require('fs');
const path = require('path');

// Tracks metadata is expected at source/backend/assets/tracks.json
// Each entry: { id, name, artists: [string], file: "<filename>.mp3", duration_ms? }

let cache = null;
let lastMtime = 0;
const DEBUG_GAME = String(process.env.DEBUG_GAME || '').toLowerCase() === 'true';
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
  };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchRandomClip(baseUrl) {
  const tracks = readTracksFile();
  const assetsDir = getAssetsPath();
  const clipsDir = path.join(assetsDir, 'clips');
  let existing = tracks.filter(t => t && t.file && fs.existsSync(path.join(clipsDir, t.file)));
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
      .map(f => ({ id: `auto-${f}`, name: path.parse(f).name, artists: ['Local Clip'], file: f, image: null }));
    existing = auto.filter(t => fs.existsSync(path.join(clipsDir, t.file)));
  }
  if (existing.length === 0) {
    throw new Error('No local clips available');
  }
  const chosen = pickRandom(existing);
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

module.exports = {
  fetchRandomClip,
  getLocalClipsStatus,
  listClips,
  searchClips,
};


