const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Stats = require('../models/Stats');
const auth = require('../middleware/auth');
const { generateVerificationToken, sendVerificationEmail, sendEmailChangeVerificationEmail } = require('../services/emailService');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const appLogger = require('../utils/logger');

const USERNAME_PATTERN = /^[a-z0-9_.-]+$/;

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

function formatUserProfile(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    userRole: user.userRole || 'user',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function verifyPasswordWithSalt(password, salt, hash) {
  const saltedPassword = password + salt;
  return bcrypt.compare(saltedPassword, hash);
}

const avatarsDir = path.join(__dirname, '..', 'assets', 'avatars');
fs.mkdirSync(avatarsDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const filename = `${req.user.id}${ext}`;
    cb(null, filename);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type. Please upload a PNG or JPEG image.'));
    }
    cb(null, true);
  },
});

// Public profile - accessible to everyone
router.get('/profile/:username', auth(false, false), async (req, res) => {
    try {
        const username = sanitizeUsername(req.params.username || '');

        if (!username || !USERNAME_PATTERN.test(username)) {
            return res.status(400).json({ error: 'Invalid username.' });
        }

        const user = await User.findOneNotDeleted({ username });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const stats = await Stats.findOne({ user: user._id });

        const publicProfile = {
            firstname: user.firstName,
            displayName: user.username,
            avatarUrl: user.avatarUrl,
            stats: stats ? {
                totalGames: stats.totalPlayed,
                wins: stats.wins,
                averageTimeMs: stats.averageTimeMs,
                bestStreak: stats.bestStreak,
                currentStreak: stats.currentStreak,
                bestTimeMs: stats.bestTimeMs,
                totalPlayed: stats.totalPlayed,
                totalPoints: stats.totalPoints, 
                totalWins: stats.totalWins,
            } : "Never played any games"
        };

        res.json(publicProfile);

    } catch (error) {
        appLogger.error('Profile fetch error', { err: error });
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/me', auth(true, true), async (req, res) => {
    try {
        const user = await User.findByIdNotDeleted(req.user.id);

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
          userRole: user.userRole || 'user',
          createdAt: user.createdAt,
          avatarUrl: user.avatarUrl,
          settings: user.settings && typeof user.settings === 'object'
            ? {
                theme: user.settings.theme ?? 'dark',
                language: user.settings.language ?? 'de',
                soundEnabled: user.settings.soundEnabled !== false,
                musicVolume: Math.max(0, Math.min(100, Number(user.settings.musicVolume) || 80)),
                sfxVolume: Math.max(0, Math.min(100, Number(user.settings.sfxVolume) || 80)),
                notifications: user.settings.notifications !== false,
                showStatsOnHome: user.settings.showStatsOnHome !== false,
                reducedMotion: Boolean(user.settings.reducedMotion),
              }
            : { theme: 'dark', language: 'de', soundEnabled: true, musicVolume: 80, sfxVolume: 80, notifications: true, showStatsOnHome: true, reducedMotion: false },
          stats: stats
            ? {
                totalGames: stats.totalPlayed,
                wins: stats.wins,
                averageTimeMs: stats.averageTimeMs,
                bestStreak: stats.bestStreak,
                currentStreak: stats.currentStreak,
                bestTimeMs: stats.bestTimeMs,
                totalPlayed: stats.totalPlayed,
                totalPoints: stats.totalPoints,
                totalWins: stats.totalWins,
              }
            : null,
        };

        res.json(privateProfile);

    } catch (error) {
        appLogger.error('Get me error', { err: error });
        res.status(500).json({ error: 'Server error' });
    }
});

// Update own profile (name, username, email, ...)
router.put('/me', auth(true, true), async (req, res) => {
  try {
    const user = await User.findByIdNotDeleted(req.user.id).select('+passwordHash +salt');
    const passwordGiven =
      typeof req.body.password === 'string' ? req.body.password : '';

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!passwordGiven) {
      return res
        .status(400)
        .json({
          field: 'password',
          message: 'Password is required to update profile.',
        });
    }

    const passwordValid = await verifyPasswordWithSalt(
      passwordGiven,
      user.salt,
      user.passwordHash
    );

    if (!passwordValid) {
      return res
        .status(401)
        .json({ field: 'password', message: 'Password is incorrect.' });
    }

    const updates = {};

    const firstName = sanitizeName(req.body.firstName ?? req.body.firstname);
    const lastName = sanitizeName(req.body.lastName ?? req.body.lastname);
    const usernameInput = sanitizeUsername(req.body.username);
    const emailInput = sanitizeEmail(req.body.email);

    if (firstName) {
      updates.firstName = firstName;
    }

    if (lastName) {
      updates.lastName = lastName;
    }

    if (usernameInput && usernameInput !== user.username) {
      if (!USERNAME_PATTERN.test(usernameInput)) {
        return res.status(400).json({
          message:
            'Username may only contain letters, numbers, underscores, dashes, and dots.',
        });
      }

      const existingUsername = await User.findOneNotDeleted({
        _id: { $ne: user._id },
        username: usernameInput,
      });
      if (existingUsername) {
        return res.status(409).json({
          field: 'username',
          message: 'Username is already taken.',
        });
      }

      updates.username = usernameInput;
      updates.usernameLower = usernameInput;
    }

    let emailChanged = false;
    if (emailInput && emailInput !== user.email) {
      const existingEmail = await User.findOneNotDeleted({
        _id: { $ne: user._id },
        email: emailInput,
      });
      if (existingEmail) {
        return res.status(409).json({
          field: 'email',
          message: 'Email is already registered.',
        });
      }

      emailChanged = true;
      const verificationToken = generateVerificationToken();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      updates.pendingEmail = emailInput;
      updates.pendingEmailToken = verificationToken;
      updates.pendingEmailExpires = verificationExpires;
      updates.emailVerificationToken = undefined;
      updates.emailVerificationExpires = undefined;

      try {
        const emailSent = await sendEmailChangeVerificationEmail(emailInput, verificationToken);
        if (!emailSent) {
          appLogger.warn('Failed to send email change verification', { email: emailInput });
        }
      } catch (err) {
        appLogger.error('Error sending email change verification', { err });
      }
    }

    Object.assign(user, updates);
    await user.save();

    return res.json({
      message: emailChanged
        ? 'Profile updated. A verification code has been sent to your new email.'
        : 'Profile updated successfully.',
      verificationRequired: emailChanged,
      user: formatUserProfile(user),
    });
  } catch (error) {
    appLogger.error('Update profile error', { err: error });
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
});

// Verify email with code (used from in-app profile flow)
router.post('/verify-email-code', auth(true, true), async (req, res) => {
  try {
    const code =
      typeof req.body.code === 'string' ? req.body.code.trim() : String(req.body.code || '').trim();

    if (!code) {
      return res.status(400).json({ message: 'Verification code is required.' });
    }

    const user = await User.findOneNotDeleted({
      _id: req.user.id,
      emailVerificationToken: code,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Verification code is invalid or expired.' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.json({
      message: 'Email verified successfully.',
      user: formatUserProfile(user),
    });
  } catch (error) {
    appLogger.error('Verify email code error', { err: error });
    return res.status(500).json({ message: 'Failed to verify email.' });
  }
});

const SETTINGS_THEMES = ['dark', 'light', 'system'];
const SETTINGS_LANGUAGES = ['de', 'en', 'fr'];

// PATCH /users/me/settings - Update user preferences
router.patch('/me/settings', auth(true, true), async (req, res) => {
  try {
    const user = await User.findByIdNotDeleted(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const settings = user.settings && typeof user.settings === 'object' ? { ...user.settings } : { theme: 'dark', language: 'de', soundEnabled: true };

    if (req.body.theme !== undefined) {
      const theme = typeof req.body.theme === 'string' ? req.body.theme.trim().toLowerCase() : '';
      if (SETTINGS_THEMES.includes(theme)) {
        settings.theme = theme;
      }
    }
    if (req.body.language !== undefined) {
      const language = typeof req.body.language === 'string' ? req.body.language.trim().toLowerCase() : '';
      if (SETTINGS_LANGUAGES.includes(language)) {
        settings.language = language;
      }
    }
    if (req.body.soundEnabled !== undefined) {
      settings.soundEnabled = Boolean(req.body.soundEnabled);
    }
    if (req.body.musicVolume !== undefined) {
      const v = Number(req.body.musicVolume);
      settings.musicVolume = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 80;
    }
    if (req.body.sfxVolume !== undefined) {
      const v = Number(req.body.sfxVolume);
      settings.sfxVolume = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 80;
    }
    if (req.body.notifications !== undefined) {
      settings.notifications = Boolean(req.body.notifications);
    }
    if (req.body.showStatsOnHome !== undefined) {
      settings.showStatsOnHome = Boolean(req.body.showStatsOnHome);
    }
    if (req.body.reducedMotion !== undefined) {
      settings.reducedMotion = Boolean(req.body.reducedMotion);
    }

    user.settings = settings;
    await user.save();

    const responseSettings = {
      theme: settings.theme ?? 'dark',
      language: settings.language ?? 'de',
      soundEnabled: settings.soundEnabled !== false,
      musicVolume: Math.max(0, Math.min(100, Number(settings.musicVolume) || 80)),
      sfxVolume: Math.max(0, Math.min(100, Number(settings.sfxVolume) || 80)),
      notifications: settings.notifications !== false,
      showStatsOnHome: settings.showStatsOnHome !== false,
      reducedMotion: Boolean(settings.reducedMotion),
    };

    return res.json({
      message: 'Settings updated.',
      settings: responseSettings,
      user: formatUserProfile(user),
    });
  } catch (error) {
    appLogger.error('Patch settings error', { err: error });
    return res.status(500).json({ message: 'Failed to update settings.' });
  }
});

// DELETE /users/me - Soft delete own account (requires password)
router.delete('/me', auth(true, true), async (req, res) => {
  try {
    const passwordGiven = typeof req.body.password === 'string' ? req.body.password : '';
    if (!passwordGiven) {
      return res.status(400).json({ message: 'Password is required to delete your account.' });
    }

    const user = await User.findByIdNotDeleted(req.user.id).select('+passwordHash +salt');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passwordValid = await verifyPasswordWithSalt(passwordGiven, user.salt, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Password is incorrect.' });
    }

    const idStr = String(user._id);
    user.deletedEmail = user.email;
    user.deletedUsername = user.username;
    user.deletedAt = new Date();
    user.email = `deleted_${idStr}@deleted.local`;
    user.username = `deleted_${idStr}`;
    user.usernameLower = `deleted_${idStr}`;
    await user.save();

    return res.json({ message: 'Account deleted.' });
  } catch (error) {
    appLogger.error('Delete account error', { err: error });
    return res.status(500).json({ message: 'Failed to delete account.' });
  }
});

// DELETE /users/me/avatar - Remove the current avatar
router.delete('/me/avatar', auth(true, true), async (req, res) => {
  try {
    const user = await User.findByIdNotDeleted(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.avatarUrl) {
      const filename = path.basename(user.avatarUrl);
      const filePath = path.join(avatarsDir, filename);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          appLogger.error('Failed to delete avatar file from disk', { err });
        }
      }
    }

    user.avatarUrl = null;
    await user.save();

    return res.json({
      message: 'Avatar deleted successfully.',
      user: formatUserProfile(user),
    });
  } catch (error) {
    appLogger.error('Delete avatar error', { err: error });
    return res.status(500).json({ message: 'Server error while deleting avatar.' });
  }
});

function handleAvatarUpload(req, res, next) {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 2MB.' });
      }
      if (err.message && err.message.includes('Unsupported file type')) {
        return res.status(400).json({ message: err.message });
      }
      appLogger.error('Multer avatar error', { err });
      return res.status(400).json({ message: 'Invalid file upload.' });
    }
    next();
  });
}

router.post(
  '/me/avatar',
  auth(true, true),
  handleAvatarUpload,
  async (req, res) => {
    try {
      const user = await User.findByIdNotDeleted(req.user.id).select('+passwordHash +salt');

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const passwordGiven =
        typeof req.body.password === 'string' ? req.body.password : '';

      if (!passwordGiven) {
        return res.status(400).json({
          field: 'password',
          message: 'Password is required to update avatar.',
        });
      }

      const passwordValid = await verifyPasswordWithSalt(
        passwordGiven,
        user.salt,
        user.passwordHash
      );

      if (!passwordValid) {
        return res
          .status(401)
          .json({ field: 'password', message: 'Password is incorrect.' });
      }

      // Remove avatar when no file is provided
      if (!req.file) {
        if (user.avatarUrl) {
          const existingPath = path.join(avatarsDir, path.basename(user.avatarUrl));
          fs.unlink(existingPath, (err) => {
            if (err && err.code !== 'ENOENT') {
              appLogger.error('Failed to remove old avatar', { err });
            }
          });
        }

        user.avatarUrl = undefined;
        await user.save();

        return res.json({
          message: 'Avatar removed successfully.',
          avatarUrl: null,
        });
      }

      if (user.avatarUrl) {
        const existingFilename = path.basename(user.avatarUrl);
        const newFilename = req.file.filename;

        if (existingFilename && existingFilename !== newFilename) {
          const existingPath = path.join(avatarsDir, existingFilename);
          fs.unlink(existingPath, (err) => {
            if (err && err.code !== 'ENOENT') {
              appLogger.error('Failed to remove old avatar', { err });
            }
          });
        }
      }

      const publicPath = `/avatars/${req.file.filename}`;
      user.avatarUrl = publicPath;
      await user.save();

      return res.json({
        message: 'Avatar updated successfully.',
        avatarUrl: publicPath,
      });
    } catch (error) {
      appLogger.error('Avatar upload error', { err: error });
      return res.status(500).json({ message: 'Failed to upload avatar.' });
    }
  }
);

module.exports = router;
