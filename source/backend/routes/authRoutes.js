const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { generateVerificationToken, sendVerificationEmail } = require('../services/emailService');
const auth = require('../middleware/auth');
const loginSecurity = require('../services/loginSecurity');

const router = express.Router();

const USERNAME_PATTERN = /^[a-z0-9_.-]+$/;
const PASSWORD_HISTORY_LIMIT = Math.max(
  Number(process.env.PASSWORD_HISTORY_LIMIT || 5),
  0
);

function sanitizeName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function sanitizeEmail(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function sanitizeUsername(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
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

    const identifier = email || req.ip;

    if (loginSecurity.isBlocked(identifier)) {
      const blockedUntil = loginSecurity.getBlockExpiresAt(identifier);
      const retryAfterSeconds = blockedUntil
        ? Math.ceil((blockedUntil - Date.now()) / 1000)
        : undefined;

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
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Please verify your email address before logging in.',
        emailVerified: false,
      });
    }

    const token = createToken(user);
    loginSecurity.resetAttempts(identifier);
    return res.json({
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed.' });
  }
});

router.get('/isAuthed', auth(true, true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        loggedIn: false,
        message: 'User not found.',
      });
    }

    return res.json({
      loggedIn: true,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(500).json({
      message: 'Failed to validate session.',
    });
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

    if (PASSWORD_HISTORY_LIMIT > 0) {
      user.passwordHistory.unshift({
        passwordHash: user.passwordHash,
        salt: user.salt,
        changedAt: new Date(),
      });

      if (user.passwordHistory.length > PASSWORD_HISTORY_LIMIT) {
        user.passwordHistory = user.passwordHistory.slice(0, PASSWORD_HISTORY_LIMIT);
      }
    }

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
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

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
