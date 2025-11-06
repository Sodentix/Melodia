const mongoose = require('mongoose');

const ModeStatsSchema = new mongoose.Schema(
    {
        totalPlayed: { type: Number, default: 0, min: 0 },
        totalWins: { type: Number, default: 0, min: 0 },
        correctGuesses: { type: Number, default: 0, min: 0 },
        wrongGuesses: { type: Number, default: 0, min: 0 },
        bestTimeMs: { type: Number, default: null, min: 0 },
        averageTimeMs: { type: Number, default: null, min: 0 },
        currentStreak: { type: Number, default: 0, min: 0 },
        bestStreak: { type: Number, default: 0, min: 0 },
        lastPlayedAt: { type: Date, default: null },
    },
    { _id: false }
);

const StatsSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true, required: true },
        totalPlayed: { type: Number, default: 0, min: 0 },
        totalWins: { type: Number, default: 0, min: 0 },
        correctGuesses: { type: Number, default: 0, min: 0 },
        wrongGuesses: { type: Number, default: 0, min: 0 },
        totalPoints: { type: Number, default: 0, min: 0, index: true },
        bestTimeMs: { type: Number, default: null, min: 0 },
        averageTimeMs: { type: Number, default: null, min: 0 },
        currentStreak: { type: Number, default: 0, min: 0 },
        bestStreak: { type: Number, default: 0, min: 0 },
        lastPlayedAt: { type: Date, default: null },
        modes: { type: Map, of: ModeStatsSchema, default: undefined },
    },
    { timestamps: true }
);

// Atomic recorder
StatsSchema.statics.recordGame = async function ({
                                                     userId, win, correctGuesses = 0, wrongGuesses = 0, points = 0, timeMs = null, mode = null, playedAt = new Date(),
                                                 }) {
    const base = mode ? `modes.${mode}` : null;

    // upsert doc first
    await this.updateOne(
        { user: userId },
        { $setOnInsert: { user: userId } },
        { upsert: true }
    );

    // Always update global stats, and also update mode-specific stats if provided
    const inc = {
        totalPlayed: 1,
        correctGuesses: correctGuesses,
        wrongGuesses: wrongGuesses,
        totalPoints: points,
    };
    if (win) inc.totalWins = 1;
    if (base) {
        inc[`${base}.totalPlayed`] = 1;
        inc[`${base}.correctGuesses`] = correctGuesses;
        inc[`${base}.wrongGuesses`] = wrongGuesses;
        if (win) inc[`${base}.totalWins`] = 1;
    }

    const set = { lastPlayedAt: playedAt };
    if (base) set[`${base}.lastPlayedAt`] = playedAt;

    const update = { $inc: inc, $set: set };
    if (timeMs != null) {
        const min = { bestTimeMs: timeMs };
        if (base) min[`${base}.bestTimeMs`] = timeMs;
        update.$min = min;
    }

    await this.updateOne({ user: userId }, update);

    // pipeline for streak + rolling average (apply to global and optionally to mode)
    const stages = [];

    // helper to push stages for a given path set
    function pushStages(curPath, bestPath, avgPath, totalPathStr, bestTimePath) {
        stages.push({
            $set: {
                [curPath]: win ? { $add: [{ $ifNull: [`$${curPath}`, 0] }, 1] } : 0,
            },
        });
        stages.push({
            $set: {
                [bestPath]: {
                    $max: [{ $ifNull: [`$${bestPath}`, 0] }, { $ifNull: [`$${curPath}`, 0] }],
                },
            },
        });
        if (timeMs != null && bestTimePath) {
            // Initialize bestTimeMs if it is currently null
            stages.push({
                $set: {
                    [bestTimePath]: {
                        $cond: [
                            { $eq: [ { $ifNull: [ `$${bestTimePath}`, null ] }, null ] },
                            timeMs,
                            `$${bestTimePath}`
                        ]
                    }
                }
            });
            // Ensure bestTimeMs is the minimum of current and new timeMs
            stages.push({
                $set: {
                    [bestTimePath]: {
                        $cond: [
                            { $gt: [ `$${bestTimePath}`, timeMs ] },
                            timeMs,
                            `$${bestTimePath}`
                        ]
                    }
                }
            });
        }
        if (timeMs != null) {
            stages.push({
                $set: {
                    [avgPath]: {
                        $let: {
                            vars: {
                                oldAvg: { $ifNull: [`$${avgPath}`, timeMs] },
                                n: { $ifNull: [totalPathStr, 1] },
                            },
                            in: {
                                $cond: [
                                    { $lte: ['$$n', 1] },
                                    timeMs,
                                    { $add: ['$$oldAvg', { $divide: [{ $subtract: [timeMs, '$$oldAvg'] }, '$$n'] }] },
                                ],
                            },
                        },
                    },
                },
            });
        }
    }

    // global paths
    pushStages('currentStreak', 'bestStreak', 'averageTimeMs', '$totalPlayed', 'bestTimeMs');

    // mode-specific paths if any
    if (base) {
        pushStages(`${base}.currentStreak`, `${base}.bestStreak`, `${base}.averageTimeMs`, `$${base}.totalPlayed`, `${base}.bestTimeMs`);
    }

    if (stages.length > 0) {
        await this.updateOne({ user: userId }, stages);
    }
};

module.exports = mongoose.model('Stats', StatsSchema);
