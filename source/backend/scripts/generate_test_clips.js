/*
  Generates 10 short royalty‑free test clips using ffmpeg tone synthesis
  and writes entries into source/backend/assets/tracks.json.

  Requirements: ffmpeg available in PATH
  Usage:  node source/backend/scripts/generate_test_clips.js
*/

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const assetsDir = path.join(__dirname, '..', 'assets');
const clipsDir = path.join(assetsDir, 'clips');
const tracksFile = path.join(assetsDir, 'tracks.json');

const titles = [
  { name: 'Neon Skyline', artists: ['Test Artist'] },
  { name: 'Midnight Run', artists: ['Test Artist'] },
  { name: 'Crimson Wave', artists: ['Test Artist'] },
  { name: 'Echo City', artists: ['Test Artist'] },
  { name: 'Starlight Drive', artists: ['Test Artist'] },
  { name: 'Quantum Drift', artists: ['Test Artist'] },
  { name: 'Hollow Sun', artists: ['Test Artist'] },
  { name: 'Lunar Bloom', artists: ['Test Artist'] },
  { name: 'Aurora Fields', artists: ['Test Artist'] },
  { name: 'Violet Horizon', artists: ['Test Artist'] },
];

const baseFreq = 330; // Hz
const duration = 8; // seconds

function ensureDirs() {
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  if (!fs.existsSync(clipsDir)) fs.mkdirSync(clipsDir, { recursive: true });
}

function ffmpegSine(outPath, freq, seconds) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', `sine=frequency=${freq}:duration=${seconds}`,
      '-q:a', '4',
      '-ac', '2',
      '-ar', '44100',
      outPath,
      '-y',
    ];
    const proc = spawn('ffmpeg', args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve(); else reject(new Error(`ffmpeg exited with ${code}`));
    });
  });
}

async function run() {
  ensureDirs();
  const tracks = [];
  for (let i = 0; i < titles.length; i++) {
    const idx = String(i + 1).padStart(3, '0');
    const file = `test_${idx}.mp3`;
    const outPath = path.join(clipsDir, file);
    const freq = baseFreq + i * 30;
    process.stdout.write(`Generating ${file} @ ${freq}Hz...\n`);
    await ffmpegSine(outPath, freq, duration);
    tracks.push({
      id: `local-${idx}`,
      name: titles[i].name,
      artists: titles[i].artists,
      file,
      image: null,
      duration_ms: duration * 1000,
    });
  }
  fs.writeFileSync(tracksFile, JSON.stringify(tracks, null, 2));
  process.stdout.write(`\nWrote ${tracks.length} tracks to ${tracksFile}\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


