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
const Stats = require('../models/Stats');

describe('User routes', () => {
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
    firstName: 'Jane',
    lastName: 'Doe',
    username: 'janedoe',
    email: 'jane@example.com',
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

  test('GET /users/me requires auth', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  test('GET /users/me returns profile with totalPlayed in stats', async () => {
    const token = await signUpAndLogin();

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: baseUserPayload.username,
      email: baseUserPayload.email,
    });
    if (res.body.stats != null) {
      expect(res.body.stats).toHaveProperty('totalPlayed');
      expect(res.body.stats).toHaveProperty('totalGames');
      expect(typeof res.body.stats.totalPlayed).toBe('number');
    }
  });

  test('PUT /users/me requires password and auth', async () => {
    const token = await signUpAndLogin();

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'JaneUpdated' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      message: 'Password is required to update profile.',
    });
  });

  test('GET /users/profile/:username returns 400 for invalid username', async () => {
    const res = await request(app).get('/users/profile/user%40name');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid username.' });
  });

  test('GET /users/profile/:username returns 404 for non-existent user', async () => {
    const res = await request(app).get('/users/profile/nonexistent99');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'User not found' });
  });

  test('GET /users/profile/:username returns public profile for existing user', async () => {
    await signUpAndLogin();

    const res = await request(app).get('/users/profile/janedoe');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayName: 'janedoe',
      firstname: baseUserPayload.firstName,
    });
    expect(res.body).not.toHaveProperty('email');
  });
});
