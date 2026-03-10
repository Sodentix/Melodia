const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');
const User = require('../models/User');
const Stats = require('../models/Stats');

// Load env vars
dotenv.config();

// Config
const NUM_USERS = 20;

const FIRST_NAMES = [
    'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Oliver', 'Isabella', 'Elijah',
    'Sophia', 'James', 'Mia', 'William', 'Charlotte', 'Benjamin', 'Amelia',
    'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander'
];

const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
    'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateRandomStats = () => {
    const totalPlayed = randomInt(10, 500);
    // Win rate between 20% and 80%
    const winRate = randomInt(20, 80) / 100;
    const totalWins = Math.round(totalPlayed * winRate);
    const correctGuesses = totalWins * 5 + randomInt(0, totalPlayed * 2);
    // ^ Approximating 5 guesses per win, plus some extras
    const wrongGuesses = (totalPlayed * 5) - correctGuesses + randomInt(0, 100);
    // ^ Some arbitrary wrong guess calculation
    const currentStreak = randomInt(0, 5);
    const bestStreak = randomInt(currentStreak, 20);
    // Points logic: roughly 100 points per win maybe?
    const totalPoints = totalWins * 100 + correctGuesses * 10;

    // Time stats
    const bestTimeMs = randomInt(500, 5000); // 0.5s to 5s
    const averageTimeMs = randomInt(bestTimeMs, 8000);

    return {
        totalPlayed,
        totalWins,
        correctGuesses,
        wrongGuesses: Math.max(0, wrongGuesses),
        totalPoints,
        bestTimeMs,
        averageTimeMs,
        currentStreak,
        bestStreak,
        lastPlayedAt: new Date(Date.now() - randomInt(0, 1000000000))
    };
};

const createDemoUser = async (i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];

    // Ensure username is <= 12 chars
    // prefix "d_" (2) + shortened name (max 6) + suffix (max 3) = ~11 chars
    const suffix = randomInt(1, 999);
    const namePart = firstName.toLowerCase().slice(0, 6);
    const username = `d_${namePart}${suffix}`;

    const email = `${username}@example.com`;

    // Fake password params
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.pbkdf2Sync('password123', salt, 1000, 64, 'sha512').toString('hex');

    try {
        // Check if exists
        const exists = await User.findOne({ email });
        if (exists) {
            console.log(`Skipping ${username}, already exists.`);
            return;
        }

        const user = new User({
            firstName,
            lastName,
            username,
            email,
            passwordHash,
            salt,
            emailVerified: true
        });

        await user.save();
        console.log(`Created user: ${username}`);

        // Create Stats
        const statsData = generateRandomStats();

        await Stats.updateOne(
            { user: user._id },
            {
                $set: {
                    ...statsData,
                    user: user._id
                }
            },
            { upsert: true }
        );

        // Link stat to user (though the stats model has the ref, user has one too)
        user.stats = (await Stats.findOne({ user: user._id }))._id;
        await user.save();

        console.log(`   -> Stats created for ${username}: ${statsData.totalPoints} pts, ${statsData.totalWins} wins.`);

    } catch (err) {
        console.error(`Failed to create ${username}:`, err.message);
    }
};

const main = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/melodia');
        console.log('Connected.');

        console.log(`Creating ${NUM_USERS} demo users...`);
        for (let i = 0; i < NUM_USERS; i++) {
            await createDemoUser(i);
        }

        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Script failed:', err);
        process.exit(1);
    }
};

main();
