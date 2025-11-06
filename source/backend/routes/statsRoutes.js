const express = require('express');
const auth = require('../middleware/auth');
const Stats = require('../models/Stats');
const User = require('../models/User');

const router = express.Router();

// Get stats for the authenticated user
router.get('/me', auth(true, true), async (req, res) => {
  try {
    const doc = await Stats.findOne({ user: req.user.id });
    if (!doc) {
      return res.status(200).json({
        totalPlayed: 0,
        totalWins: 0,
        correctGuesses: 0,
        wrongGuesses: 0,
        bestTimeMs: null,
        averageTimeMs: null,
        currentStreak: 0,
        bestStreak: 0,
        lastPlayedAt: null,
        modes: {},
      });
    }

    // Return plain JSON, converting Map to object for modes
    const json = doc.toObject({ getters: false, virtuals: false });
    const modes = {};
    // Handle Mongoose Map or plain object
    const modesValue = doc.modes instanceof Map ? doc.modes : json.modes;
    if (modesValue) {
      if (modesValue instanceof Map) {
        for (const [key, val] of modesValue.entries()) {
          modes[key] = typeof val?.toObject === 'function' ? val.toObject() : val;
        }
      } else if (typeof modesValue === 'object') {
        for (const [key, val] of Object.entries(modesValue)) {
          modes[key] = val;
        }
      }
    }

    return res.json({
      totalPlayed: json.totalPlayed || 0,
      totalWins: json.totalWins || 0,
      correctGuesses: json.correctGuesses || 0,
      wrongGuesses: json.wrongGuesses || 0,
      totalPoints: json.totalPoints || 0,
      bestTimeMs: json.bestTimeMs ?? null,
      averageTimeMs: json.averageTimeMs ?? null,
      currentStreak: json.currentStreak || 0,
      bestStreak: json.bestStreak || 0,
      lastPlayedAt: json.lastPlayedAt || null,
      modes,
    });
  } catch (err) {
    console.error('Get stats error:', err);
    return res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// Leaderboard endpoint (top N users by points)
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    
    const leaderboard = await Stats.find({ totalPoints: { $gt: 0 } })
      .sort({ totalPoints: -1 })
      .limit(limit)
      .skip(skip)
      .populate('user', 'username email firstName lastName')
      .lean();
    
    const formatted = leaderboard.map((stat, index) => ({
      rank: skip + index + 1,
      username: stat.user?.username || 'Unknown',
      firstName: stat.user?.firstName,
      lastName: stat.user?.lastName,
      totalPoints: stat.totalPoints || 0,
      totalWins: stat.totalWins || 0,
      totalPlayed: stat.totalPlayed || 0,
      correctGuesses: stat.correctGuesses || 0,
      bestStreak: stat.bestStreak || 0,
    }));
    
    return res.json({ leaderboard: formatted });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;


