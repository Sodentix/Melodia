const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const EventEmitter = require('events');
const jwt = require('jsonwebtoken');

jest.mock('../services/emailService', () => ({
  generateVerificationToken: jest.fn(() => 'test-verification-token'),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('https', () => {
  const EventEmitter = require('events');
  const mockGet = jest.fn((url, callback) => {
    const response = new EventEmitter();
    response.statusCode = 200;
    response.setEncoding = jest.fn();

    process.nextTick(() => {
      callback(response);
      process.nextTick(() => {
        response.emit('data', JSON.stringify({ ip: '127.0.0.1', country: 'US' }));
        response.emit('end');
      });
    });

    return {
      on: jest.fn(),
      setTimeout: jest.fn(),
      destroy: jest.fn(),
    };
  });

  return { get: mockGet };
});

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
    jest.clearAllMocks();
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

  const passwordFailureCases = [
    {
      description: 'too short password',
      password: 'Short1!A',
      expectedError: 'Password must be at least 12 characters long.',
      email: 'pw-short@example.com',
      username: 'pwshortuser',
    },
    {
      description: 'missing uppercase letters',
      password: 'lowercase!!22aa',
      expectedError: 'Password must contain at least 2 uppercase letters.',
      email: 'pw-noupper@example.com',
      username: 'pwnoupper',
    },
    {
      description: 'missing digits in password',
      password: 'NoDigits!!AAzz',
      expectedError: 'Password must contain at least 2 digits.',
      email: 'pw-nodigit@example.com',
      username: 'pwnodigit',
    },
    {
      description: 'missing special characters',
      password: 'NoSpecials11AAzz',
      expectedError: 'Password must contain at least 2 special characters',
      email: 'pw-nospecial@example.com',
      username: 'pwnospecial',
    },
    {
      description: 'only one uppercase letter',
      password: 'Onlyoneupper!!22',
      expectedError: 'Password must contain at least 2 uppercase letters.',
      email: 'pw-oneupper@example.com',
      username: 'pwoneupper',
    },
    {
      description: 'only one digit in password',
      password: 'TwoUpper!!2aa',
      expectedError: 'Password must contain at least 2 digits.',
      email: 'pw-onedigit@example.com',
      username: 'pwonedigit',
    },
  ];

  const missingFieldCases = [
    { field: 'firstName', email: 'missing-first@example.com', username: 'missingfirst' },
    { field: 'lastName', email: 'missing-last@example.com', username: 'missinglast' },
    { field: 'username', email: 'missing-username@example.com', username: undefined },
    { field: 'email', email: 'missing-email@example.com', username: 'missingemail' },
    { field: 'password', email: 'missing-password@example.com', username: 'missingpassword' },
    { field: 'firstName,lastName', email: 'missing-both@example.com', username: 'missingboth' },
  ];

  const loginInvalidInputCases = [
    {
      description: 'empty email string',
      body: { email: '', password: baseUserPayload.password },
      expectedStatus: 400,
      expectedMessage: 'Email and password are required.',
    },
    {
      description: 'empty password string',
      body: { email: baseUserPayload.email, password: '' },
      expectedStatus: 400,
      expectedMessage: 'Email and password are required.',
    },
    {
      description: 'whitespace email',
      body: { email: '   ', password: baseUserPayload.password },
      expectedStatus: 400,
      expectedMessage: 'Email and password are required.',
    },
    {
      description: 'whitespace password',
      body: { email: baseUserPayload.email, password: '   ' },
      expectedStatus: 401,
      expectedMessage: 'Invalid credentials.',
    },
    {
      description: 'null email value',
      body: { email: null, password: baseUserPayload.password },
      expectedStatus: 400,
      expectedMessage: 'Email and password are required.',
    },
    {
      description: 'null password value',
      body: { email: baseUserPayload.email, password: null },
      expectedStatus: 400,
      expectedMessage: 'Email and password are required.',
    },
  ];

  const resendSanitizationCases = [
    {
      description: 'uppercase email',
      rawEmail: 'RESEND@EXAMPLE.COM',
      storedEmail: 'resend@example.com',
      username: 'resendupper',
      expectedStatus: 200,
      expectedMessage: 'Verification email sent.',
    },
    {
      description: 'leading and trailing whitespace',
      rawEmail: '  resend-whitespace@example.com  ',
      storedEmail: 'resend-whitespace@example.com',
      username: 'resendwhitespace',
      expectedStatus: 200,
      expectedMessage: 'Verification email sent.',
    },
    {
      description: 'email with angle brackets',
      rawEmail: '<resend-brackets@example.com>',
      storedEmail: 'resend-brackets@example.com',
      username: 'resendbrackets',
      expectedStatus: 400,
      expectedMessage: 'Email is required.',
    },
    {
      description: 'email with script tags',
      rawEmail: '<script>alert(1)</script>resend@example.com',
      storedEmail: 'resend@example.com',
      username: 'resendscript',
      expectedStatus: 200,
      expectedMessage: 'Verification email sent.',
    },
    {
      description: 'email containing newline',
      rawEmail: 'resend-newline@example.com\n',
      storedEmail: 'resend-newline@example.com',
      username: 'resendnewline',
      expectedStatus: 200,
      expectedMessage: 'Verification email sent.',
    },
    {
      description: 'email with zero width spaces',
      rawEmail: 're\u200Bsend\u200C@example.com',
      storedEmail: 'resend@example.com',
      username: 'resendzerowidth',
      expectedStatus: 200,
      expectedMessage: 'Verification email sent.',
    },
  ];

  const changePasswordAuthCases = [
    {
      description: 'missing bearer scheme',
      headerValue: 'InvalidTokenValue',
      expectedStatus: 401,
      expectedMessage: 'Unauthorized',
    },
    {
      description: 'malformed bearer token',
      headerValue: 'Bearer malformed.token.value',
      expectedStatus: 401,
      expectedMessage: 'Invalid token',
    },
    {
      description: 'token signed for unknown user',
      headerValue: null, // placeholder will be set in test
      expectedStatus: 401,
      expectedMessage: 'User not found',
      generateUnknownUserToken: true,
    },
    {
      description: 'token for unverified user is rejected',
      headerValue: null,
      expectedStatus: 403,
      expectedMessage: 'Email verification required',
      generateUnverifiedToken: true,
      testEmail: 'change-unverified@example.com',
      username: 'changeunverified',
    },
    {
      description: 'current password mismatch returns unauthorized',
      headerValue: null,
      expectedStatus: 401,
      expectedMessage: 'Current password is incorrect.',
      expectLogin: true,
      wrongCurrentPassword: true,
      testEmail: 'change-wrongcurrent@example.com',
      username: 'changewrongcurrent',
    },
    {
      description: 'change password rejects missing new password body',
      headerValue: null,
      expectedStatus: 400,
      expectedMessage: 'Current password and new password are required.',
      expectLogin: true,
      omitNewPassword: true,
      testEmail: 'change-missingnew@example.com',
      username: 'changemissingnew',
    },
  ];

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

  test('signup trims and normalizes input values', async () => {
    const response = await request(app).post('/auth/signup').send({
      firstName: '  Bob  ',
      lastName: '  Brown ',
      username: ' Bob-User ',
      email: '  BOB@Example.COM ',
      password: 'StrongPass!!22AA',
    });

    expect(response.status).toBe(201);

    const savedUser = await User.findOne({ email: 'bob@example.com' });
    expect(savedUser).not.toBeNull();
    expect(savedUser.firstName).toBe('Bob');
    expect(savedUser.lastName).toBe('Brown');
    expect(savedUser.username).toBe('bob-user');
    expect(savedUser.email).toBe('bob@example.com');
  });

  test('signup returns 400 when required fields are missing', async () => {
    const response = await request(app).post('/auth/signup').send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Missing required fields');
  });

  test('signup rejects usernames with invalid characters', async () => {
    const response = await request(app).post('/auth/signup').send({
      ...baseUserPayload,
      email: 'invaliduser@example.com',
      username: 'Invalid!User',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Username may only contain letters, numbers, underscores, dashes, and dots.',
    });
  });

  test('signup rejects duplicate usernames case-insensitively', async () => {
    await signUpUser({
      email: 'firstunique@example.com',
      username: 'uniqueUser',
    });

    const response = await request(app).post('/auth/signup').send({
      ...baseUserPayload,
      email: 'secondunique@example.com',
      username: 'UNIQUEUSER',
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      message: 'Username is already taken.',
    });
  });

  test('verify-email succeeds with a valid token', async () => {
    await signUpUser({
      email: 'verifyme@example.com',
      username: 'verifymeuser',
    });

    const userBefore = await User.findOne({ email: 'verifyme@example.com' });
    const token = userBefore.emailVerificationToken;

    const response = await request(app).get(`/auth/verify-email?token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Email verified successfully.',
    });

    const userAfter = await User.findOne({ email: 'verifyme@example.com' });
    expect(userAfter.emailVerified).toBe(true);
    expect(userAfter.emailVerificationToken).toBeUndefined();
    expect(userAfter.emailVerificationExpires).toBeUndefined();
  });

  test('verify-email rejects requests without token', async () => {
    const response = await request(app).get('/auth/verify-email');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Verification token is required.',
    });
  });

  test('verify-email rejects invalid tokens', async () => {
    const response = await request(app).get('/auth/verify-email?token=invalid-token');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Verification token is invalid or expired.',
    });
  });

  test('resend-verification requires an email', async () => {
    const response = await request(app).post('/auth/resend-verification').send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Email is required.',
    });
  });

  test('resend-verification returns 404 for unknown users', async () => {
    const response = await request(app).post('/auth/resend-verification').send({
      email: 'missing@example.com',
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      message: 'User not found.',
    });
  });

  test('resend-verification rejects already verified accounts', async () => {
    const payload = await signUpUser({
      email: 'verifiedalready@example.com',
      username: 'verifiedalreadyuser',
    });
    await User.updateOne({ email: payload.email }, { emailVerified: true });

    const response = await request(app).post('/auth/resend-verification').send({
      email: payload.email,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Email is already verified.',
    });
  });

  test('resend-verification refreshes token and emails the user', async () => {
    const payload = await signUpUser({
      email: 'resend@example.com',
      username: 'resenduser',
    });

    const userBefore = await User.findOne({ email: payload.email });
    const previousToken = userBefore.emailVerificationToken;

    emailService.generateVerificationToken.mockReturnValueOnce('resend-token');

    const response = await request(app).post('/auth/resend-verification').send({
      email: payload.email,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Verification email sent.',
    });
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      payload.email,
      'resend-token'
    );

    const userAfter = await User.findOne({ email: payload.email });
    expect(userAfter.emailVerificationToken).toBe('resend-token');
    expect(userAfter.emailVerificationToken).not.toBe(previousToken);
    expect(new Date(userAfter.emailVerificationExpires).getTime()).toBeGreaterThan(
      new Date(userBefore.emailVerificationExpires).getTime()
    );
  });

  test('login returns 400 when password is missing', async () => {
    const payload = await signUpAndVerify({
      email: 'missingpass@example.com',
      username: 'missingpassuser',
    });

    const response = await request(app).post('/auth/login').send({
      email: payload.email,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Email and password are required.',
    });
  });

  test('login returns 400 when email is missing', async () => {
    await signUpAndVerify({
      email: 'missinemail@example.com',
      username: 'missingemailuser',
    });

    const response = await request(app).post('/auth/login').send({
      password: baseUserPayload.password,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Email and password are required.',
    });
  });

  test('login stores device information for successful login', async () => {
    const payload = await signUpAndVerify({
      email: 'device-success@example.com',
      username: 'devicesuccess',
    });

    const response = await request(app).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });

    expect(response.status).toBe(200);

    const user = await User.findOne({ email: payload.email }).lean();
    expect(user.loginDevices).toHaveLength(1);
    const device = user.loginDevices[0];
    expect(device.lastStatus).toBe('success');
    expect(device.blocked).toBe(false);
    expect(device.lastSuccessAt).toBeTruthy();
    expect(device.countryCode).toBe('US');
  });

  test('login stores device metadata for invalid password attempts', async () => {
    const payload = await signUpAndVerify({
      email: 'device-invalid@example.com',
      username: 'deviceinvalid',
    });

    const response = await request(app).post('/auth/login').send({
      email: payload.email,
      password: 'Wrong!!44AA',
    });

    expect(response.status).toBe(401);

    const user = await User.findOne({ email: payload.email }).lean();
    expect(user.loginDevices).toHaveLength(1);
    const device = user.loginDevices[0];
    expect(device.lastStatus).toBe('invalid_credentials');
    expect(device.lastSuccessAt).toBeUndefined();
    expect(device.attemptCount).toBe(1);
  });

  test('login device attempt count increments across repeated failures', async () => {
    const payload = await signUpAndVerify({
      email: 'device-retry@example.com',
      username: 'deviceretry',
    });

    await request(app).post('/auth/login').send({
      email: payload.email,
      password: 'Wrong!!44AA',
    });
    const secondResponse = await request(app).post('/auth/login').send({
      email: payload.email,
      password: 'Wrong!!44AA',
    });

    expect(secondResponse.status).toBe(401);

    const user = await User.findOne({ email: payload.email }).lean();
    const device = user.loginDevices[0];
    expect(device.attemptCount).toBe(2);
    expect(device.lastStatus).toBe('invalid_credentials');
  });

  test('blocked login attempts mark device as blocked', async () => {
    const payload = await signUpAndVerify({
      email: 'blocked-device@example.com',
      username: 'blockeddevice',
    });

    const maxAttempts = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5);

    for (let i = 0; i < maxAttempts; i += 1) {
      const res = await request(app).post('/auth/login').send({
        email: payload.email,
        password: 'Wrong!!99XX',
      });
      expect(res.status).toBe(401);
    }

    const blockedResponse = await request(app).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });

    expect(blockedResponse.status).toBe(429);

    const user = await User.findOne({ email: payload.email }).lean();
    const device = user.loginDevices[0];
    expect(device.blocked).toBe(true);
    expect(device.lastStatus).toBe('blocked');
  });

  test('successful login clears blocked flag and records success metadata', async () => {
    const payload = await signUpAndVerify({
      email: 'blocked-clear@example.com',
      username: 'blockedclear',
    });

    await request(app).post('/auth/login').send({
      email: payload.email,
      password: 'Wrong!!11QQ',
    });

    const successResponse = await request(app).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });

    expect(successResponse.status).toBe(200);

    const user = await User.findOne({ email: payload.email }).lean();
    const device = user.loginDevices[0];
    expect(device.blocked).toBe(false);
    expect(device.lastStatus).toBe('success');
    expect(device.lastSuccessAt).toBeTruthy();
  });

  test('login without password does not record device entries', async () => {
    const payload = await signUpAndVerify({
      email: 'nodevice@example.com',
      username: 'nodeviceuser',
    });

    await request(app).post('/auth/login').send({
      email: payload.email,
    });

    const user = await User.findOne({ email: payload.email }).lean();
    expect(user.loginDevices || []).toHaveLength(0);
  });

  test('change-password requires a valid authorization token', async () => {
    const response = await request(app).put('/auth/change-password').send({
      currentPassword: 'whatever',
      newPassword: 'NewStrongPass!!33BB',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ message: 'Unauthorized' });
  });

  test('change-password rejects requests missing required fields', async () => {
    const payload = await signUpAndVerify({
      email: 'changemissing@example.com',
      username: 'changemissinguser',
    });

    const loginResponse = await request(app).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });

    const token = loginResponse.body.token;

    const response = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: payload.password,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Current password and new password are required.',
    });
  });

  test('change-password rejects reuse of the current password', async () => {
    const payload = await signUpAndVerify({
      email: 'change-same@example.com',
      username: 'changesame',
    });

    const loginResponse = await request(app).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });

    const token = loginResponse.body.token;

    const response = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: payload.password,
        newPassword: payload.password,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'New password must be different from the current password.',
    });
  });

  test('change-password rejects weak new passwords', async () => {
    const payload = await signUpAndVerify({
      email: 'change-weak@example.com',
      username: 'changeweak',
    });

    const loginResponse = await request(app).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });
    const token = loginResponse.body.token;

    const response = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: payload.password,
        newPassword: 'weak',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Password does not meet the security requirements.',
    });
  });

  test('change-password prevents reuse of recent passwords', async () => {
    const payload = await signUpAndVerify({
      email: 'change-history@example.com',
      username: 'changehistory',
    });

    const loginResponse = await request(app).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });
    const token = loginResponse.body.token;

    const firstChange = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: payload.password,
        newPassword: 'NewStrongPass!!33BB',
      });
    expect(firstChange.status).toBe(200);

    const loginAfterChange = await request(app).post('/auth/login').send({
      email: payload.email,
      password: 'NewStrongPass!!33BB',
    });
    const newToken = loginAfterChange.body.token;

    const secondChange = await request(app)
      .put('/auth/change-password')
      .set('Authorization', `Bearer ${newToken}`)
      .send({
        currentPassword: 'NewStrongPass!!33BB',
        newPassword: baseUserPayload.password,
      });

    expect(secondChange.status).toBe(400);
    expect(secondChange.body).toMatchObject({
      message: 'You cannot reuse a recent password.',
    });
  });

  test('successful login resets rate limiter for the identifier', async () => {
    const payload = await signUpAndVerify({
      email: 'ratelimit-reset@example.com',
      username: 'ratelimitreset',
    });

    const maxAttempts = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5);

    for (let i = 0; i < maxAttempts - 1; i += 1) {
      const res = await request(app).post('/auth/login').send({
        email: payload.email,
        password: 'Wrong!!88PP',
      });
      expect(res.status).toBe(401);
    }

    const successResponse = await request(app).post('/auth/login').send({
      email: payload.email,
      password: payload.password,
    });
    expect(successResponse.status).toBe(200);

    const postSuccessFailure = await request(app).post('/auth/login').send({
      email: payload.email,
      password: 'Wrong!!88PP',
    });
    expect(postSuccessFailure.status).toBe(401);
  });

  test('login accepts uppercase email addresses by normalizing input', async () => {
    const payload = await signUpAndVerify({
      email: 'normalize@example.com',
      username: 'normalizeuser',
    });

    const response = await request(app).post('/auth/login').send({
      email: 'NORMALIZE@EXAMPLE.COM',
      password: payload.password,
    });

    expect(response.status).toBe(200);
  });

  test('login returns 401 for non-existent users', async () => {
    const response = await request(app).post('/auth/login').send({
      email: 'ghost@example.com',
      password: 'Whatever!!11AA',
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      message: 'Invalid credentials.',
    });
  });

  test('signup strips control characters from names', async () => {
    const response = await request(app).post('/auth/signup').send({
      ...baseUserPayload,
      firstName: 'Ali\u0007ce',
      lastName: 'Sm\u0008ith',
      email: 'controlchars@example.com',
      username: 'controlcharsuser',
    });

    expect(response.status).toBe(201);

    const user = await User.findOne({ email: 'controlchars@example.com' });
    expect(user.firstName).toBe('Alice');
    expect(user.lastName).toBe('Smith');
  });

  describe('signup password validation scenarios', () => {
    test.each(passwordFailureCases)('rejects $description', async ({ description, password, expectedError, email, username }) => {
      const response = await request(app).post('/auth/signup').send({
        ...baseUserPayload,
        email,
        username,
        password,
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        message: 'Password does not meet the security requirements.',
      });
      expect(response.body.errors).toEqual(
        expect.arrayContaining([expect.stringContaining(expectedError)])
      );
    });
  });

  describe('signup missing field handling', () => {
    test.each(missingFieldCases)('rejects missing $field', async ({ field, email, username }) => {
      const payload = {
        ...baseUserPayload,
        email: email || baseUserPayload.email,
        username: typeof username === 'string' ? username : baseUserPayload.username,
      };

      field.split(',').forEach((fieldName) => {
        delete payload[fieldName];
      });

      const response = await request(app).post('/auth/signup').send(payload);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing required fields');
      field.split(',').forEach((fieldName) => {
        expect(response.body.message).toContain(fieldName);
      });
    });
  });

  describe('login invalid input validation', () => {
    test.each(loginInvalidInputCases)(
      'returns $expectedStatus when $description',
      async ({ description, body, expectedStatus, expectedMessage }) => {
        const response = await request(app).post('/auth/login').send(body);

        expect(response.status).toBe(expectedStatus);
        expect(response.body).toMatchObject({
          message: expectedMessage,
      });
    });
  });

  describe('resend verification sanitization', () => {
    test.each(resendSanitizationCases)(
      'sanitizes $description before sending email',
      async ({ description, rawEmail, storedEmail, username, expectedStatus, expectedMessage }) => {
        await signUpUser({
          email: storedEmail,
          username,
        });

        emailService.sendVerificationEmail.mockClear();
        emailService.generateVerificationToken.mockClear();
        emailService.generateVerificationToken.mockReturnValueOnce(`${username}-token`);

        const response = await request(app).post('/auth/resend-verification').send({
          email: rawEmail,
        });

        expect(response.status).toBe(expectedStatus);
        expect(response.body.message).toBe(expectedMessage);

        const updatedUser = await User.findOne({ email: storedEmail });

        if (expectedStatus === 200) {
          expect(emailService.sendVerificationEmail).toHaveBeenLastCalledWith(
            storedEmail,
            `${username}-token`
          );
          expect(updatedUser.emailVerificationToken).toBe(`${username}-token`);
          expect(updatedUser.emailVerificationExpires).toBeInstanceOf(Date);
        } else {
          expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
          expect(updatedUser.emailVerificationToken).toBe('test-verification-token');
        }
      }
    );
  });

  describe('change-password authorization edge cases', () => {
    test.each(changePasswordAuthCases)(
      'handles $description',
      async ({
        description,
        headerValue: initialHeaderValue,
        expectedStatus,
        expectedMessage,
        generateUnknownUserToken,
        generateUnverifiedToken,
        expectLogin,
        wrongCurrentPassword,
        omitNewPassword,
        testEmail,
        username,
      }) => {
        let headerValue = initialHeaderValue;
        let requestBody = {
          currentPassword: baseUserPayload.password,
          newPassword: 'NewStrongPass!!44DD',
        };

        if (generateUnknownUserToken) {
          const randomId = new mongoose.Types.ObjectId();
          const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
          const token = jwt.sign({ sub: randomId.toString(), email: 'ghost@example.com' }, secret);
          headerValue = `Bearer ${token}`;
        }

        if (generateUnverifiedToken) {
          const signupPayload = await signUpUser({
            email: testEmail,
            username,
          });
          const user = await User.findOne({ email: signupPayload.email });
          const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
          const token = jwt.sign({ sub: String(user._id), email: user.email }, secret);
          headerValue = `Bearer ${token}`;
        }

        let loginToken;
        if (expectLogin) {
          const verifiedPayload = await signUpAndVerify({
            email: testEmail,
            username,
          });
          const loginResponse = await request(app).post('/auth/login').send({
            email: verifiedPayload.email,
            password: verifiedPayload.password,
          });
          loginToken = loginResponse.body.token;
          headerValue = `Bearer ${loginToken}`;
        }

        if (wrongCurrentPassword) {
          requestBody.currentPassword = 'Incorrect!!44AA';
        }

        if (omitNewPassword) {
          delete requestBody.newPassword;
        }

        const changePasswordRequest = request(app)
          .put('/auth/change-password')
          .set('Authorization', headerValue || '');

        const response = await changePasswordRequest.send(requestBody);

        expect(response.status).toBe(expectedStatus);
        expect(response.body.message).toContain(expectedMessage);
      }
    );
  });
});
