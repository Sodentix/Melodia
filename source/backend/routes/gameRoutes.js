const express = require('express');
const auth = require('../middleware/auth');
const Stats = require('../models/Stats');
const { fetchRandomTrack } = require('../services/spotifyService');
const { fetchRandomClip } = require('../services/clipService');
const { GameRoundStore, isGuessCorrect } = require('../services/gameService');

const router = express.Router();
const rounds = new GameRoundStore();

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

// Start a new round: returns roundId and preview URL (no answer)
router.post('/start', auth(true, true), async (_req, res) => {
  try {
    let track;
    try {
      track = await fetchRandomTrack();
    } catch (e) {
      const base = `${_req.protocol}://${_req.get('host')}`;
      track = await fetchRandomClip(base);
    }
    if (!track?.preview_url) {
      return res.status(503).json({ message: 'No preview available, try again' });
    }
    const { roundId } = rounds.create(track);
    return res.json({ roundId, preview_url: track.preview_url });
  } catch (err) {
    console.error('Start round error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'Failed to start round' : String(err.message || err);
    return res.status(500).json({ message });
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

    const correct = isGuessCorrect(guess, round.track);
    if (correct) {
      // end the round when guessed correctly
      rounds.delete(roundId);
    }
    // Do not reveal full track when incorrect, but return minimal hint structure
    return res.json({ correct, track: correct ? { id: round.track.id, name: round.track.name, artists: round.track.artists } : null });
  } catch (err) {
    console.error('Guess error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'Failed to process guess' : String(err.message || err);
    return res.status(500).json({ message });
  }
});

module.exports = router;


