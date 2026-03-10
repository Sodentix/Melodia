const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../services/emailService', () => ({
  generateVerificationToken: jest.fn(() => 'test-verification-token'),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
}));

const connectDB = require('../config/database');
const app = require('../app');
const User = require('../models/User');

describe('Stats routes', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await connectDB();
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  const baseUserPayload = {
    firstName: 'Bob',
    lastName: 'Taylor',
    username: 'bobt',
    email: 'bob@example.com',
    password: 'StrongPass!!22AA',
  };

  async function signUpAndLogin() {
    await request(app).post('/auth/signup').send(baseUserPayload);
    await User.updateOne({ email: baseUserPayload.email }, { emailVerified: true });
    const login = await request(app).post('/auth/login').send({
      email: baseUserPayload.email,
      password: baseUserPayload.password,
    });
    return login.body.token;
  }

  test('GET /stats/me returns zeroed stats for new user', async () => {
    const token = await signUpAndLogin();

    const res = await request(app)
      .get('/stats/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalPlayed: 0,
      totalWins: 0,
      correctGuesses: 0,
      wrongGuesses: 0,
      bestTimeMs: null,
      averageTimeMs: null,
      currentStreak: 0,
      bestStreak: 0,
      lastPlayedAt: null,
    });
  });

  test('POST /game/record increments and GET /stats/me reflects updates', async () => {
    const token = await signUpAndLogin();

    const record1 = await request(app)
      .post('/game/record')
      .set('Authorization', `Bearer ${token}`)
      .send({ win: true, correctGuesses: 3, wrongGuesses: 1, timeMs: 1200, mode: 'classic' });
    expect(record1.status).toBe(200);

    const record2 = await request(app)
      .post('/game/record')
      .set('Authorization', `Bearer ${token}`)
      .send({ win: false, correctGuesses: 1, wrongGuesses: 4, timeMs: 2000, mode: 'classic' });
    expect(record2.status).toBe(200);

    const res = await request(app)
      .get('/stats/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPlayed).toBe(2);
    expect(res.body.totalWins).toBe(1);
    expect(res.body.correctGuesses).toBe(4);
    expect(res.body.wrongGuesses).toBe(5);
    expect(res.body.bestTimeMs).toBe(1200);
    expect(res.body.averageTimeMs).toBeGreaterThanOrEqual(1200);
    expect(res.body.averageTimeMs).toBeLessThanOrEqual(2000);
    expect(res.body.modes.classic.totalPlayed).toBe(2);
  });

  test('GET /stats/leaderboard without auth returns leaderboard and no email in entries', async () => {
    const res = await request(app).get('/stats/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leaderboard');
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
    res.body.leaderboard.forEach((entry) => {
      expect(entry).not.toHaveProperty('email');
      expect(entry).toHaveProperty('username');
      expect(entry).toHaveProperty('totalPoints');
      expect(entry).toHaveProperty('rank');
    });
  });

  test('GET /stats/leaderboard with auth returns userRank when user has stats', async () => {
    const token = await signUpAndLogin();
    await request(app)
      .post('/game/record')
      .set('Authorization', `Bearer ${token}`)
      .send({ win: true, correctGuesses: 1, wrongGuesses: 0, timeMs: 1000, mode: 'competitive' });

    const res = await request(app)
      .get('/stats/leaderboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leaderboard');
    expect(res.body).toHaveProperty('userRank');
    expect(res.body.userRank).toBeGreaterThanOrEqual(1);
  });

  test('GET /stats/leaderboard respects limit and skip', async () => {
    const res = await request(app)
      .get('/stats/leaderboard?limit=5&skip=0');
    expect(res.status).toBe(200);
    expect(res.body.leaderboard.length).toBeLessThanOrEqual(5);
  });
});


