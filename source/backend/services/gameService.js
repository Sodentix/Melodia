const crypto = require('crypto');

class GameRoundStore {
  constructor() {
    this.rounds = new Map(); // roundId -> { track, createdAt, userId, mode, categoryId, guesses: [{guess, correct, timestamp}] }
    const ttlMs = Number(process.env.GAME_ROUND_TTL_MS || 5 * 60 * 1000);
    const sweepMs = Math.min(ttlMs, 60 * 1000);
    setInterval(() => this.sweep(ttlMs), sweepMs).unref?.();
  }

  create(track, userId, options = {}) {
    const roundId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const createdAt = Date.now();
    const { mode = 'competitive', categoryId = 'all' } = options;
    this.rounds.set(roundId, { track, createdAt, userId, guesses: [], mode, categoryId });
    return { roundId, track };
  }

  get(roundId) {
    return this.rounds.get(roundId) || null;
  }

  addGuess(roundId, guess, correct) {
    const round = this.rounds.get(roundId);
    if (!round) return null;
    const guessEntry = {
      guess: guess.trim(),
      correct,
      timestamp: Date.now(),
    };
    round.guesses.push(guessEntry);
    return round;
  }

  delete(roundId) {
    this.rounds.delete(roundId);
  }

  sweep(ttlMs) {
    const now = Date.now();
    for (const [id, { createdAt }] of this.rounds.entries()) {
      if (now - createdAt > ttlMs) this.rounds.delete(id);
    }
  }
}

// Calculate points for a completed round
// Base: 100 points for correct guess
// Speed bonus: up to 50 points for fast guesses (0-30 seconds)
// Accuracy penalty: -5 points per wrong guess
function calculatePoints(round, correctGuessIndex) {
  if (correctGuessIndex < 0) return 0;
  
  const basePoints = 100;
  const wrongGuesses = correctGuessIndex;
  const wrongPenalty = wrongGuesses * 5;
  
  // Calculate time bonus (max 30 seconds for full bonus)
  const startTime = round.createdAt;
  const correctTime = round.guesses[correctGuessIndex].timestamp;
  const timeMs = correctTime - startTime;
  const timeSeconds = timeMs / 1000;
  const maxTimeBonus = 50;
  const timeBonus = Math.max(0, maxTimeBonus * (1 - timeSeconds / 30));
  
  const points = Math.max(0, basePoints - wrongPenalty + Math.round(timeBonus));
  return points;
}

function normalizeTitle(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\((feat\.|feat|with|remaster(?:ed)?|live|version)[^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      }
      prev = temp;
    }
  }
  return dp[n];
}

    function isGuessCorrect(guess, track) {
      const g = normalizeTitle(guess);
      const t = normalizeTitle(track?.name || '');
      if (!g || !t) return false;

      // Exact match
      if (g === t) return true;

      // Very short strings must match exactly to avoid false positives
      const maxLen = Math.max(g.length, t.length);
      if (maxLen <= 4) return false;

      // If both contain numeric sequences and they differ, consider incorrect
      const gNums = (g.match(/\d+/g) || []).join('-');
      const tNums = (t.match(/\d+/g) || []).join('-');
      if (gNums && tNums && gNums !== tNums) {
        return false;
      }

      // Levenshtein similarity
      const dist = editDistance(g, t);
      const similarity = 1 - dist / maxLen; // 0..1

      // Require a fairly high similarity; avoid naive substring matches
      const required = maxLen > 10 ? 0.88 : maxLen > 6 ? 0.9 : 0.92;
      return similarity >= required;
    }

module.exports = {
  GameRoundStore,
  normalizeTitle,
  isGuessCorrect,
  calculatePoints,
};


