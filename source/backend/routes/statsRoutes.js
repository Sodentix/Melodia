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
router.get('/leaderboard', auth(false), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const leaderboard = await Stats.find({ totalPoints: { $gt: 0 } })
      .sort({ totalPoints: -1, totalWins: -1, bestStreak: -1, bestTimeMs: 1 })
      .limit(limit)
      .skip(skip)
      .populate('user', 'username email firstName lastName')
      .lean();

    const formatted = leaderboard.map((stat, index) => {
      const played = stat.totalPlayed || 0;
      const wins = stat.totalWins || 0;
      const winRate = played > 0 ? ((wins / played) * 100).toFixed(1) : '0.0';

      return {
        rank: skip + index + 1,
        username: stat.user?.username || 'Unknown',
        firstName: stat.user?.firstName,
        lastName: stat.user?.lastName,
        totalPoints: stat.totalPoints || 0,
        totalWins: wins,
        totalPlayed: played,
        winRate: winRate,
        correctGuesses: stat.correctGuesses || 0,
        bestStreak: stat.bestStreak || 0,
        averageTimeMs: stat.averageTimeMs ? Math.round(stat.averageTimeMs) : null,
      };
    });

    let userRank = null;
    let userStats = null;
    let currentUsername = null;

    console.log('Leaderboard request user:', req.user);

    if (req.user) {
      const userStatDoc = await Stats.findOne({ user: req.user.id }).populate('user', 'username');
      console.log('User stats doc found:', !!userStatDoc);
      if (userStatDoc) {
        const count = await Stats.countDocuments({
          $or: [
            { totalPoints: { $gt: userStatDoc.totalPoints } },
            { totalPoints: userStatDoc.totalPoints, totalWins: { $gt: userStatDoc.totalWins } },
            { totalPoints: userStatDoc.totalPoints, totalWins: userStatDoc.totalWins, bestStreak: { $gt: userStatDoc.bestStreak } },
            { totalPoints: userStatDoc.totalPoints, totalWins: userStatDoc.totalWins, bestStreak: userStatDoc.bestStreak, bestTimeMs: { $lt: userStatDoc.bestTimeMs } }
          ]
        });
        userRank = count + 1;
        userStats = userStatDoc.toObject();
        currentUsername = userStatDoc.user?.username;
        console.log('Calculated rank:', userRank, 'Username:', currentUsername);
      }
    }

    return res.json({
      leaderboard: formatted,
      userRank,
      userStats,
      currentUsername
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;


