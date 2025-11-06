const express = require('express');
const auth = require('../middleware/auth');
const Stats = require('../models/Stats');
const { fetchRandomClip, getLocalClipsStatus } = require('../services/clipService');
const { GameRoundStore, isGuessCorrect, calculatePoints } = require('../services/gameService');

const router = express.Router();
const rounds = new GameRoundStore();
const DEBUG_GAME = String(process.env.DEBUG_GAME || '').toLowerCase() === 'true';
function logDebug(message, extra) {
  if (!DEBUG_GAME) return;
  const payload = { ts: new Date().toISOString(), area: 'game', message };
  if (extra && typeof extra === 'object') Object.assign(payload, extra);
  try { console.log(JSON.stringify(payload)); } catch (_) { /* noop */ }
}

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

// Start a new round: returns roundId and preview URL (no answer)
router.post('/start', auth(true, true), async (req, res) => {
  try {
    const base = `${req.protocol}://${req.get('host')}`;
    const track = await fetchRandomClip(base);
    if (!track?.preview_url) {
      logDebug('start_no_preview', {});
      return res.status(503).json({ message: 'No preview available, try again' });
    }
    const { roundId } = rounds.create(track, req.user.id);
    logDebug('round_started', { roundId, trackId: track.id, source: 'local', userId: req.user.id });
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
    if (correct) {
      // Calculate points based on attempts and time
      const correctIndex = updatedRound.guesses.findIndex(g => g.correct);
      points = calculatePoints(updatedRound, correctIndex);
      
      // Record game stats immediately when correct
      const timeMs = updatedRound.guesses[correctIndex].timestamp - updatedRound.createdAt;
      await Stats.recordGame({
        userId: req.user.id,
        win: true,
        correctGuesses: correctGuesses,
        wrongGuesses: wrongGuesses,
        points,
        timeMs,
        mode: 'classic',
        playedAt: new Date(),
      });
      
      // end the round when guessed correctly
      rounds.delete(roundId);
      logDebug('round_completed', { roundId, trackId: round.track?.id, points, timeMs });
    }
    
    // Return result with points if correct
    return res.json({ 
      correct, 
      points: correct ? points : 0,
      totalGuesses: updatedRound.guesses.length,
      track: correct ? { id: round.track.id, name: round.track.name, artists: round.track.artists } : null 
    });
  } catch (err) {
    console.error('Guess error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'Failed to process guess' : String(err.message || err);
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


