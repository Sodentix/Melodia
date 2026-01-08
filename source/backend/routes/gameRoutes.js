const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const Stats = require('../models/Stats');
const { fetchRandomClip, getLocalClipsStatus, listTracksByCategory } = require('../services/clipService');
const { GameRoundStore, isGuessCorrect, calculatePoints } = require('../services/gameService');
const { listCategories, findCategoryById } = require('../services/categoryService');

const router = express.Router();
const rounds = new GameRoundStore();
const DEBUG_GAME = String(process.env.DEBUG_GAME || '').toLowerCase() === 'true';
function logDebug(message, extra) {
  if (!DEBUG_GAME) return;
  const payload = { ts: new Date().toISOString(), area: 'game', message };
  if (extra && typeof extra === 'object') Object.assign(payload, extra);
  try { console.log(JSON.stringify(payload)); } catch (_) { /* noop */ }
}

const ALLOWED_MODES = new Set(['competitive', 'freeplay']);

// Record the result of a game for the authenticated (and email-verified) user
router.post('/record', auth(true, true), async (req, res) => {
  try {
    const win = Boolean(req.body.win);
    const correctGuesses = Number(req.body.correctGuesses || 0);
    const wrongGuesses = Number(req.body.wrongGuesses || 0);
    const timeMs = req.body.timeMs === undefined || req.body.timeMs === null ? null : Number(req.body.timeMs);
    const mode = typeof req.body.mode === 'string' && req.body.mode.trim() ? req.body.mode.trim() : null;
    const playedAt = req.body.playedAt ? new Date(req.body.playedAt) : new Date();

    if (Number.isNaN(correctGuesses) || correctGuesses < 0) {
      return res.status(400).json({ message: 'correctGuesses must be a non-negative number' });
    }
    if (Number.isNaN(wrongGuesses) || wrongGuesses < 0) {
      return res.status(400).json({ message: 'wrongGuesses must be a non-negative number' });
    }
    if (timeMs !== null && (Number.isNaN(timeMs) || timeMs < 0)) {
      return res.status(400).json({ message: 'timeMs must be null or a non-negative number' });
    }

    await Stats.recordGame({
      userId: req.user.id,
      win,
      correctGuesses,
      wrongGuesses,
      points: 0, // Legacy: /record endpoint doesn't calculate points, use /guess for that
      timeMs,
      mode,
      playedAt,
    });

    return res.status(200).json({ message: 'Game recorded' });
  } catch (err) {
    console.error('Record game error:', err);
    return res.status(500).json({ message: 'Failed to record game' });
  }
});

router.get('/categories', (_req, res) => {
  try {
    const categories = listCategories();
    return res.json({ categories });
  } catch (err) {
    console.error('List categories error:', err);
    return res.status(500).json({ message: 'Failed to load categories' });
  }
});

router.get('/category/:categoryId/tracks', auth(true, true), (req, res) => {
  try {
    const categoryId = req.params.categoryId || 'all';
    const base = `${req.protocol}://${req.get('host')}`;
    const tracks = listTracksByCategory(base, categoryId);
    console.log(`[DEBUG] /category/${categoryId}/tracks returning ${tracks.length} tracks. First item:`, tracks[0]);
    return res.json({ tracks });
  } catch (err) {
    console.error('List category tracks error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'Failed to load category tracks' : String(err.message || err);
    return res.status(500).json({ message });
  }
});

// Start a new round: returns roundId and preview URL (no answer)
router.post('/start', auth(true, true), async (req, res) => {
  try {
    const requestedMode = typeof req.body.mode === 'string' ? req.body.mode.toLowerCase() : 'competitive';
    const mode = ALLOWED_MODES.has(requestedMode) ? requestedMode : 'competitive';

    const rawCategory = typeof req.body.categoryId === 'string' ? req.body.categoryId.trim() : 'all';
    const category = findCategoryById(rawCategory) ? rawCategory : 'all';

    // Parse excludeIds to prevent songs from repeating in a session
    let excludeIds = [];
    if (Array.isArray(req.body.excludeIds)) {
      excludeIds = req.body.excludeIds.filter(id => typeof id === 'string' && id.trim());
    }

    const base = `${req.protocol}://${req.get('host')}`;
    const track = await fetchRandomClip(base, { categoryId: category, excludeIds });
    if (!track?.preview_url) {
      logDebug('start_no_preview', {});
      return res.status(503).json({ message: 'No preview available, try again' });
    }
    const { roundId } = rounds.create(track, req.user.id, { mode, categoryId: category });
    logDebug('round_started', { roundId, trackId: track.id, source: 'local', userId: req.user.id, mode, category, excludedCount: excludeIds.length });
    return res.json({ roundId, preview_url: track.preview_url, trackId: track.id, mode, categoryId: category });
  } catch (err) {
    console.error('Start round error:', err);
    const status = /No clips available/i.test(String(err.message || '')) ? 503 : 500;
    const message = process.env.NODE_ENV === 'production' ? 'Failed to start round' : String(err.message || err);
    return res.status(status).json({ message });
  }
});

// Submit a guess for a round
router.post('/guess', auth(true, true), async (req, res) => {
  try {
    const roundId = (req.body.roundId || '').toString();
    const guess = (req.body.guess || '').toString();
    if (!roundId) return res.status(400).json({ message: 'roundId is required' });
    if (!guess.trim()) return res.status(400).json({ message: 'guess is required' });

    const round = rounds.get(roundId);
    if (!round) return res.status(404).json({ message: 'Round not found or expired' });

    // Verify user owns this round (compare ObjectId values, not references)
    if (String(round.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized for this round' });
    }

    const correct = isGuessCorrect(guess, round.track);
    const updatedRound = rounds.addGuess(roundId, guess, correct);

    const correctGuesses = updatedRound.guesses.filter(g => g.correct).length;
    const wrongGuesses = updatedRound.guesses.filter(g => !g.correct).length;

    logDebug('guess_evaluated', {
      roundId,
      correct,
      guessLength: guess.length,
      trackId: round.track?.id,
      totalGuesses: updatedRound.guesses.length,
      correctGuesses,
      wrongGuesses,
    });

    let points = 0;
    const mode = round.mode || 'competitive';
    let completionTimeMs = null;
    if (correct) {
      // Calculate points based on attempts and time
      const correctIndex = updatedRound.guesses.findIndex(g => g.correct);
      points = mode === 'competitive' ? calculatePoints(updatedRound, correctIndex) : 0;
      completionTimeMs = updatedRound.guesses[correctIndex].timestamp - updatedRound.createdAt;

      if (mode === 'competitive') {
        // Record game stats immediately when correct
        await Stats.recordGame({
          userId: req.user.id,
          win: true,
          correctGuesses: correctGuesses,
          wrongGuesses: wrongGuesses,
          points,
          timeMs: completionTimeMs,
          mode,
          playedAt: new Date(),
        });
      }

      // end the round when guessed correctly
      rounds.delete(roundId);
      logDebug('round_completed', { roundId, trackId: round.track?.id, points, timeMs: completionTimeMs });
    }

    // Return result with points if correct
    return res.json({
      correct,
      points: correct ? points : 0,
      totalGuesses: updatedRound.guesses.length,
      track: correct ? { id: round.track.id, name: round.track.name, artists: round.track.artists } : null,
      mode,
      categoryId: round.categoryId || 'all',
    });
  } catch (err) {
    console.error('Guess error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'Failed to process guess' : String(err.message || err);
    return res.status(500).json({ message });
  }
});

// Give up on a round: reveals the answer and ends the round
router.post('/giveup', auth(true, true), async (req, res) => {
  try {
    const roundId = (req.body.roundId || '').toString();
    if (!roundId) return res.status(400).json({ message: 'roundId is required' });

    const round = rounds.get(roundId);
    if (!round) return res.status(404).json({ message: 'Round not found or expired' });

    // Verify user owns this round
    if (String(round.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized for this round' });
    }

    const track = round.track;
    const mode = round.mode || 'competitive';

    // Record the loss in competitive mode
    if (mode === 'competitive') {
      const correctGuesses = round.guesses.filter(g => g.correct).length;
      const wrongGuesses = round.guesses.filter(g => !g.correct).length;
      await Stats.recordGame({
        userId: req.user.id,
        win: false,
        correctGuesses,
        wrongGuesses,
        points: 0,
        timeMs: Date.now() - round.createdAt,
        mode,
        playedAt: new Date(),
      });
    }

    // Delete the round
    rounds.delete(roundId);
    logDebug('round_giveup', { roundId, trackId: track?.id });

    // Return the track info so it can be displayed
    return res.json({
      track: {
        id: track.id,
        name: track.name,
        artists: track.artists,
        image: track.image || null,
      },
      mode,
      categoryId: round.categoryId || 'all',
    });
  } catch (err) {
    console.error('Give up error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'Failed to process give up' : String(err.message || err);
    return res.status(500).json({ message });
  }
});

// Get album art from Deezer API (proxied to avoid CORS)
router.get('/album-art/:trackId', auth(true, true), async (req, res) => {
  try {
    const trackId = (req.params.trackId || '').toString();
    if (!trackId || !trackId.startsWith('deezer-')) {
      return res.status(400).json({ message: 'Invalid track ID' });
    }

    const deezerId = trackId.replace('deezer-', '').trim();
    if (!deezerId) {
      return res.status(400).json({ message: 'Invalid Deezer ID' });
    }

    // Fetch from Deezer API (server-side, no CORS issues)
    const deezerRes = await axios.get(`https://api.deezer.com/track/${encodeURIComponent(deezerId)}`);
    const data = deezerRes.data;
    const albumImage =
      data?.album?.cover_medium ||
      data?.album?.cover_big ||
      data?.album?.cover ||
      null;

    if (!albumImage) {
      return res.status(404).json({ message: 'Album art not available' });
    }

    return res.json({ albumImage });
  } catch (err) {
    console.error('Album art fetch error:', err);
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ message: 'Track not found on Deezer' });
    }
    const message = process.env.NODE_ENV === 'production' ? 'Failed to fetch album art' : String(err.message || err);
    return res.status(500).json({ message });
  }
});

// Debug endpoint to inspect local clips availability (requires auth and DEBUG_GAME)
router.get('/local-clips', auth(true, true), async (req, res) => {
  const debugEnabled = String(process.env.DEBUG_GAME || '').toLowerCase() === 'true';
  if (!debugEnabled) {
    return res.status(404).json({ message: 'Not found' });
  }
  try {
    const status = getLocalClipsStatus();
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to read local clips status' });
  }
});

module.exports = router;


