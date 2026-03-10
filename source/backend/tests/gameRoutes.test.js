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

describe('Game routes', () => {
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
    firstName: 'Game',
    lastName: 'User',
    username: 'gameuser',
    email: 'game@example.com',
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

  test('GET /game/categories returns 200 and categories array', async () => {
    const res = await request(app).get('/game/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  test('GET /game/category/:categoryId/tracks requires auth', async () => {
    const res = await request(app).get('/game/category/all/tracks');
    expect(res.status).toBe(401);
  });

  test('GET /game/category/:categoryId/tracks with auth returns tracks array', async () => {
    const token = await signUpAndLogin();

    const res = await request(app)
      .get('/game/category/all/tracks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tracks');
    expect(Array.isArray(res.body.tracks)).toBe(true);
  });

  test('GET /game/category with invalid categoryId does not expose arbitrary files', async () => {
    const token = await signUpAndLogin();

    const res = await request(app)
      .get('/game/category/../../etc/passwd/tracks')
      .set('Authorization', `Bearer ${token}`);

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('tracks');
      expect(Array.isArray(res.body.tracks)).toBe(true);
    }
  });
});
