const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../services/emailService', () => ({
  generateVerificationToken: jest.fn(() => 'test-verification-token'),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const connectDB = require('../config/database');
const app = require('../app');
const User = require('../models/User');
const emailService = require('../services/emailService');
const loginSecurity = require('../services/loginSecurity');

describe('Auth routes', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    await connectDB();
  });

  afterEach(async () => {
    loginSecurity.__testing.resetAll();
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
    firstName: 'Alice',
    lastName: 'Smith',
    username: 'alice123',
    email: 'alice@example.com',
    password: 'StrongPass!!22AA',
  };

  async function signUpUser(overrides = {}) {
    const payload = {
      ...baseUserPayload,
      ...overrides,
    };

    await request(app).post('/auth/signup').send(payload);
    return payload;
  }

  async function signUpAndVerify(overrides = {}) {
    const payload = await signUpUser(overrides);
    await User.updateOne({ email: payload.email }, { emailVerified: true });
    return payload;
  }

  test('signup creates a user and triggers verification email', async () => {
    const response = await request(app).post('/auth/signup').send(baseUserPayload);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      message: 'Account created. Please verify your email address.',
      user: expect.objectContaining({
        email: baseUserPayload.email,
        username: baseUserPayload.username,
        emailVerified: false,
      }),
    });

    const persistedUser = await User.findOne({ email: baseUserPayload.email });
    expect(persistedUser).not.toBeNull();
    expect(persistedUser.emailVerificationToken).toBe('test-verification-token');
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      baseUserPayload.email,
      'test-verification-token'
    );
  });

  test('login fails when email is not verified', async () => {
    await request(app).post('/auth/signup').send({
      ...baseUserPayload,
      email: 'unverified@example.com',
      username: 'unverifieduser',
    });

    const response = await request(app).post('/auth/login').send({
      email: 'unverified@example.com',
      password: baseUserPayload.password,
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      message: 'Please verify your email address before logging in.',
      emailVerified: false,
    });
  });

  test('login succeeds for verified users and returns a token', async () => {
    const verifiedPayload = await signUpAndVerify({
      email: 'verified@example.com',
      username: 'verifieduser',
    });

    const response = await request(app).post('/auth/login').send({
      email: verifiedPayload.email,
      password: verifiedPayload.password,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      token: expect.any(String),
      user: expect.objectContaining({
        email: verifiedPayload.email,
        emailVerified: true,
      }),
    });
  });

  test('login fails with invalid password', async () => {
    const verifiedPayload = await signUpAndVerify({
      email: 'wrongpass@example.com',
      username: 'wrongpassuser',
    });

    const response = await request(app).post('/auth/login').send({
      email: verifiedPayload.email,
      password: 'Incorrect!!44CC',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      message: 'Invalid credentials.',
    });
  });

  test('login fails when user does not exist', async () => {
    const response = await request(app).post('/auth/login').send({
      email: 'does-not-exist@example.com',
      password: 'StrongPass!!22AA',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      message: 'Invalid credentials.',
    });
  });

  test('login succeeds when correct password is provided before rate limit is exceeded', async () => {
    const verifiedPayload = await signUpAndVerify({
      email: 'prelimit@example.com',
      username: 'prelimituser',
    });

    const maxAttempts = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5);

    for (let i = 0; i < maxAttempts - 1; i += 1) {
      const res = await request(app).post('/auth/login').send({
        email: verifiedPayload.email,
        password: 'Wrong!!55DDPassword',
      });
      expect(res.status).toBe(401);
    }

    const successResponse = await request(app).post('/auth/login').send({
      email: verifiedPayload.email,
      password: verifiedPayload.password,
    });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.token).toBeTruthy();
  });

  test('login rate limiter blocks after repeated failed attempts', async () => {
    const verifiedPayload = await signUpAndVerify({
      email: 'ratelimit@example.com',
      username: 'ratelimituser',
    });

    const maxAttempts = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5);

    for (let i = 0; i < maxAttempts; i += 1) {
      const res = await request(app).post('/auth/login').send({
        email: verifiedPayload.email,
        password: 'Wrong!!66EEPassword',
      });
      expect(res.status).toBe(401);
    }

    const blockedResponse = await request(app).post('/auth/login').send({
      email: verifiedPayload.email,
      password: verifiedPayload.password,
    });

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body).toMatchObject({
      message: 'Too many login attempts. Please try again later.',
    });
    expect(blockedResponse.headers['retry-after']).toBeTruthy();
  });

  test('change-password updates the password and enforces requirements', async () => {
    const verifiedPayload = await signUpAndVerify({
      email: 'changer@example.com',
      username: 'changepassuser',
    });

    const loginResponse = await request(app).post('/auth/login').send({
      email: verifiedPayload.email,
      password: verifiedPayload.password,
    });

    const token = loginResponse.body.token;
    expect(token).toBeTruthy();

    const changeResponse = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: baseUserPayload.password,
        newPassword: 'NewStrongPass!!33BB',
      });

    expect(changeResponse.status).toBe(200);
    expect(changeResponse.body).toMatchObject({
      message: 'Password updated successfully.',
    });

    const failedLogin = await request(app).post('/auth/login').send({
      email: verifiedPayload.email,
      password: verifiedPayload.password,
    });
    expect(failedLogin.status).toBe(401);

    const successfulLogin = await request(app).post('/auth/login').send({
      email: verifiedPayload.email,
      password: 'NewStrongPass!!33BB',
    });
    expect(successfulLogin.status).toBe(200);
  });

  test('signup rejects weak passwords', async () => {
    const response = await request(app).post('/auth/signup').send({
      ...baseUserPayload,
      email: 'weakpass@example.com',
      username: 'weakpassuser',
      password: 'weak',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Password does not meet the security requirements.',
    });
  });

  test('signup rejects duplicate emails', async () => {
    await signUpUser({
      email: 'duplicate@example.com',
      username: 'duplicateuser',
    });

    const response = await request(app).post('/auth/signup').send({
      ...baseUserPayload,
      email: 'duplicate@example.com',
      username: 'anotherduplicate',
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      message: 'Email is already registered.',
    });
  });
});
