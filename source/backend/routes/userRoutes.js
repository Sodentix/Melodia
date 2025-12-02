const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Stats = require('../models/Stats');
const auth = require('../middleware/auth');

// Public profile - accessible to everyone
router.get('/profile/:username', auth(false, false), async (req, res) => {
    try {
        const username = req.params.username;

        const user = await User.findOne({ username })
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const stats = await Stats.findOne({ user: user._id });
        
        const publicProfile = {
            firstname: user.firstName,
            displayName: user.username,
            stats: stats ? {
                totalGames: stats.averageTimeMs,
                wins: stats.wins,
                averageTimeMs: stats.averageTimeMs,
                bestStreak: stats.bestStreak,
                currentStreak: stats.currentStreak,
                bestTimeMs: stats.bestTimeMs,
                totalPlayed: stats.totalPlayed,
                totalPoints: stats.totalPoints, 
                totalWins: stats.totalWins,
            } : "Never played any games"
        }; //Es gibt noch mehr stats - nur die "wichtigsten" mal gefetched!

        console.log(publicProfile);
        res.json(publicProfile);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/me', auth(true, true), async (req, res) => {
    try {
        // req.user.id is set by auth middleware after verifying the token
        const user = await User.findById(req.user.id);
        console.log(user._id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const stats = await Stats.findOne({ user: user._id });

        const privateProfile = {
            id: user._id,
            username: user.username,
            firstname: user.firstName,
            lastname: user.lastName,
            email: user.email,
            createdAt: user.createdAt,
            // any other private fields you want to expose to the logged-in user
            stats: stats ? {
                totalGames: stats.totalGames,
                wins: stats.wins,
                averageTimeMs: stats.averageTimeMs,
                bestStreak: stats.bestStreak,
                currentStreak: stats.currentStreak,
                bestTimeMs: stats.bestTimeMs,
                totalPlayed: stats.totalPlayed,
                totalPoints: stats.totalPoints, 
                totalWins: stats.totalWins,
            } : null
        };

        res.json(privateProfile);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
