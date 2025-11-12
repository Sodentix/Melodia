const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const User = require('../models/User');
const { generateVerificationToken, sendVerificationEmail } = require('../services/emailService');
const auth = require('../middleware/auth');
const loginSecurity = require('../services/loginSecurity');

const router = express.Router();

const USERNAME_PATTERN = /^[a-z0-9_.-]+$/;

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/g;
const INVISIBLE_CHAR_REGEX = /[\u200B-\u200D\uFEFF]/g;
const SCRIPT_CONTENT_REGEX = /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const MALICIOUS_PROTOCOL_REGEX =
  /\b(?:javascript|vbscript|data:(?:text|application)\/(?:html|javascript))[^\s]*/gi;

function sanitizeText(value, { toLowerCase = false } = {}) {
  if (typeof value !== 'string') {
    return '';
  }

  let sanitized = value;
  try {
    sanitized = sanitized.normalize('NFKC');
  } catch (error) {
    // Fallback to original string if normalization fails.
  }
  sanitized = sanitized.replace(CONTROL_CHAR_REGEX, '');
  sanitized = sanitized.replace(INVISIBLE_CHAR_REGEX, '');
  sanitized = sanitized.replace(SCRIPT_CONTENT_REGEX, '');
  sanitized = sanitized.replace(HTML_TAG_REGEX, '');
  sanitized = sanitized.replace(MALICIOUS_PROTOCOL_REGEX, '');
  sanitized = sanitized.trim();

  return toLowerCase ? sanitized.toLowerCase() : sanitized;
}

function sanitizeName(value) {
  return sanitizeText(value);
}

function sanitizeEmail(value) {
  return sanitizeText(value, { toLowerCase: true });
}

function sanitizeUsername(value) {
  return sanitizeText(value, { toLowerCase: true });
}

function sanitizeForOutput(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return sanitizeText(value);
}

function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];

  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
    return xForwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    const candidate = xForwardedFor[0];
    if (typeof candidate === 'string') {
      return candidate.trim();
    }
  }

  return req.ip;
}

function getUserAgent(req) {
  const userAgentHeader = req.headers['user-agent'];
  if (Array.isArray(userAgentHeader)) {
    return userAgentHeader[0] || '';
  }
  return typeof userAgentHeader === 'string' ? userAgentHeader : '';
}

const USER_DEVICE_USER_AGENT_MAX_LENGTH = 500;
const USER_DEVICE_STATUS_MAX_LENGTH = 60;
const USER_DEVICE_COUNTRY_CODE_MAX_LENGTH = 3;
const USER_DEVICE_MAX_ENTRIES = 20;

function fetchCountryCode(ipAddress) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    if (!ipAddress) {
      settle(null);
      return;
    }

    try {
      const encodedIp = encodeURIComponent(ipAddress);
      const url = `https://api.country.is/${encodedIp}`;

      const request = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          settle(null);
          return;
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const country = typeof parsed.country === 'string' ? parsed.country.trim() : '';
            settle(country || null);
          } catch (error) {
            console.error('Country lookup parse error:', error);
            settle(null);
          }
        });
      });

      request.on('error', (error) => {
        console.error('Country lookup request error:', error);
        settle(null);
      });

      request.setTimeout(3000, () => {
        console.warn('Country lookup timeout');
        request.destroy();
        settle(null);
      });
    } catch (error) {
      console.error('Country lookup failed:', error);
      settle(null);
    }
  });
}

async function recordUserLoginDevice(user, { clientIp, userAgent, success, blocked, status, countryCode }) {
  if (!user) {
    return;
  }

  try {
    const sanitizedIp = clientIp ? sanitizeText(clientIp) : '';
    const sanitizedAgent = userAgent ? sanitizeText(userAgent) : '';
    const sanitizedStatus = status ? sanitizeText(status) : '';
    const sanitizedCountryCode = countryCode ? sanitizeText(countryCode) : '';

    if (!Array.isArray(user.loginDevices)) {
      user.loginDevices = [];
    }

    const ipValue = sanitizedIp ? sanitizedIp.slice(0, 100) : '';
    const userAgentValue = sanitizedAgent
      ? sanitizedAgent.slice(0, USER_DEVICE_USER_AGENT_MAX_LENGTH)
      : '';
    const statusValue = sanitizedStatus
      ? sanitizedStatus.slice(0, USER_DEVICE_STATUS_MAX_LENGTH)
      : undefined;
    const countryValue = sanitizedCountryCode
      ? sanitizedCountryCode.toUpperCase().slice(0, USER_DEVICE_COUNTRY_CODE_MAX_LENGTH)
      : undefined;

    const now = new Date();

    let deviceEntry = user.loginDevices.find(
      (entry) =>
        (entry.ip || '') === ipValue &&
        (entry.userAgent || '') === userAgentValue
    );

    if (!deviceEntry) {
      deviceEntry = {
        ip: ipValue || undefined,
        userAgent: userAgentValue || undefined,
        countryCode: countryValue || undefined,
        lastAttemptAt: now,
        lastSuccessAt: success ? now : undefined,
        lastStatus: statusValue,
        attemptCount: 1,
        blocked: Boolean(blocked) && !success,
      };
      user.loginDevices.unshift(deviceEntry);
      if (user.loginDevices.length > USER_DEVICE_MAX_ENTRIES) {
        user.loginDevices.length = USER_DEVICE_MAX_ENTRIES;
      }
    } else {
      deviceEntry.lastAttemptAt = now;
      deviceEntry.lastStatus = statusValue;
      deviceEntry.attemptCount = (deviceEntry.attemptCount || 0) + 1;
      deviceEntry.blocked = Boolean(blocked) && !success;
      if (countryValue) {
        deviceEntry.countryCode = countryValue;
      }
      if (success) {
        deviceEntry.lastSuccessAt = now;
        deviceEntry.blocked = false;
      }
    }

    await user.save();
  } catch (error) {
    console.error('Failed to record user login device:', error);
  }
}

function formatUser(user) {
  return {
    id: user.id,
    email: sanitizeForOutput(user.email),
    username: sanitizeForOutput(user.username),
    firstName: sanitizeForOutput(user.firstName),
    lastName: sanitizeForOutput(user.lastName),
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validatePassword(password) {
  const errors = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long.');
  }

  const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
  if (uppercaseCount < 2) {
    errors.push('Password must contain at least 2 uppercase letters.');
  }

  const numberCount = (password.match(/[0-9]/g) || []).length;
  if (numberCount < 2) {
    errors.push('Password must contain at least 2 digits.');
  }

  const specialCharCount = (password.match(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/g) || []).length;
  if (specialCharCount < 2) {
    errors.push('Password must contain at least 2 special characters (!@#$%^&* etc.).');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function generateSalt() {
  return crypto.randomBytes(32).toString('hex');
}

async function hashPasswordWithSalt(password, salt) {
  const saltedPassword = password + salt;
  return bcrypt.hash(saltedPassword, 12);
}

async function verifyPasswordWithSalt(password, salt, hash) {
  const saltedPassword = password + salt;
  return bcrypt.compare(saltedPassword, hash);
}

router.post('/signup', async (req, res) => {
  try {
    const firstName = sanitizeName(req.body.firstName);
    const lastName = sanitizeName(req.body.lastName);
    const usernameInput = sanitizeUsername(req.body.username);
    const email = sanitizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    const missing = [];
    if (!firstName) missing.push('firstName');
    if (!lastName) missing.push('lastName');
    if (!usernameInput) missing.push('username');
    if (!email) missing.push('email');
    if (!password) missing.push('password');

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    if (!USERNAME_PATTERN.test(usernameInput)) {
      return res.status(400).json({
        message: 'Username may only contain letters, numbers, underscores, dashes, and dots.',
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'Password does not meet the security requirements.',
        errors: passwordValidation.errors,
      });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const existingUsername = await User.findOne({ username: usernameInput });
    if (existingUsername) {
      return res.status(409).json({ message: 'Username is already taken.' });
    }

    const salt = generateSalt();
    const passwordHash = await hashPasswordWithSalt(password, salt);
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      firstName,
      lastName,
      username: usernameInput,
      usernameLower: usernameInput,
      email,
      passwordHash,
      salt,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    const emailSent = await sendVerificationEmail(email, verificationToken);
    if (!emailSent) {
      console.error('Verification email could not be sent.', { email });
    }

    return res.status(201).json({
      message: 'Account created. Please verify your email address.',
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Signup failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    const rawClientIp = getClientIp(req);
    const clientIp = sanitizeText(rawClientIp) || rawClientIp;
    const userAgent = getUserAgent(req);
    const identifier = email ? `${email}|${clientIp}` : clientIp;
    const countryCodePromise = clientIp ? fetchCountryCode(clientIp) : Promise.resolve(null);

    if (loginSecurity.isBlocked(identifier)) {
      const blockedUntil = loginSecurity.getBlockExpiresAt(identifier);
      const retryAfterSeconds = blockedUntil
        ? Math.ceil((blockedUntil - Date.now()) / 1000)
        : undefined;

      const countryCode = await countryCodePromise;
      if (email) {
        try {
          const blockedUser = await User.findOne({ email });
          await recordUserLoginDevice(blockedUser, {
            clientIp,
            userAgent,
            success: false,
            blocked: true,
            status: 'blocked',
            countryCode,
          });
        } catch (error) {
          console.error('Failed to record blocked login device:', error);
        }
      }

      res.set('Retry-After', retryAfterSeconds || '60');
      return res.status(429).json({
        message: 'Too many login attempts. Please try again later.',
      });
    }

    if (!email || !password) {
      loginSecurity.recordFailedAttempt(identifier);
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      loginSecurity.recordFailedAttempt(identifier);
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const validPassword = await verifyPasswordWithSalt(password, user.salt, user.passwordHash);
    if (!validPassword) {
      loginSecurity.recordFailedAttempt(identifier);
      await recordUserLoginDevice(user, {
        clientIp,
        userAgent,
        success: false,
        blocked: false,
        status: 'invalid_credentials',
        countryCode: await countryCodePromise,
      });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.emailVerified) {
      await recordUserLoginDevice(user, {
        clientIp,
        userAgent,
        success: false,
        blocked: false,
        status: 'email_not_verified',
        countryCode: await countryCodePromise,
      });
      return res.status(403).json({
        message: 'Please verify your email address before logging in.',
        emailVerified: false,
      });
    }

    const token = createToken(user);
    loginSecurity.resetAttempts(identifier);
    await recordUserLoginDevice(user, {
      clientIp,
      userAgent,
      success: true,
      blocked: false,
      status: 'success',
      countryCode: await countryCodePromise,
    });
    return res.json({
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed.' });
  }
});

router.put('/change-password', auth(true, true), async (req, res) => {
  try {
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Current password and new password are required.' });
    }

    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ message: 'New password must be different from the current password.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const currentPasswordValid = await verifyPasswordWithSalt(
      currentPassword,
      user.salt,
      user.passwordHash
    );
    if (!currentPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'Password does not meet the security requirements.',
        errors: passwordValidation.errors,
      });
    }

    const reusesCurrentPassword = await verifyPasswordWithSalt(
      newPassword,
      user.salt,
      user.passwordHash
    );
    if (reusesCurrentPassword) {
      return res.status(400).json({ message: 'You cannot reuse a recent password.' });
    }

    for (const entry of user.passwordHistory) {
      const matchesHistoricalPassword = await verifyPasswordWithSalt(
        newPassword,
        entry.salt,
        entry.passwordHash
      );
      if (matchesHistoricalPassword) {
        return res.status(400).json({ message: 'You cannot reuse a recent password.' });
      }
    }

    if (!Array.isArray(user.passwordHistory)) {
      user.passwordHistory = [];
    }
    user.passwordHistory.unshift({
      passwordHash: user.passwordHash,
      salt: user.salt,
      changedAt: new Date(),
    });

    const newSalt = generateSalt();
    const newHash = await hashPasswordWithSalt(newPassword, newSalt);

    user.salt = newSalt;
    user.passwordHash = newHash;

    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Failed to change password.' });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const token = sanitizeText(
      typeof req.query.token === 'string' ? req.query.token : ''
    );

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Verification token is invalid or expired.' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ message: 'Email verification failed.' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const email = sanitizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified.' });
    }

    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    const emailSent = await sendVerificationEmail(email, verificationToken);
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send verification email.' });
    }

    return res.json({ message: 'Verification email sent.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ message: 'Failed to resend verification email.' });
  }
});

function createToken(user) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  const payload = {
    sub: String(user._id),
    email: user.email,
    username: user.username,
  };
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
}

module.exports = router;
