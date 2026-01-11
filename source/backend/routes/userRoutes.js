const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Stats = require('../models/Stats');
const auth = require('../middleware/auth');
const { generateVerificationToken, sendVerificationEmail } = require('../services/emailService');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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
    // Debug: ensure we know where avatars are stored
    console.log('[avatarStorage] destination:', avatarsDir);
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const filename = `${req.user.id}${ext}`;
    // Debug: log final avatar filename
    console.log('[avatarStorage] filename for user', req.user?.id, '=>', filename);
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
        const username = req.params.username;

        const user = await User.findOne({ username })
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const stats = await Stats.findOne({ user: user._id });

        console.log('User from DB:', user); 
  console.log('Avatar URL specific:', user.avatarUrl);
        
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
        }; //Es gibt noch mehr stats - nur die "wichtigsten" mal gefetched!

        console.log(publicProfile);
        res.json(publicProfile);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/me', auth(true, true), async (req, res) => {
    try {
        // req.user.id is set by auth middleware after verifying the token
        const user = await User.findById(req.user.id);
        console.log(user._id);

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
          createdAt: user.createdAt,
          avatarUrl: user.avatarUrl,
          // any other private fields you want to expose to the logged-in user
          stats: stats
            ? {
                totalGames: stats.totalGames,
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
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update own profile (name, username, email, ...)
router.put('/me', auth(true, true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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

      const existingUsername = await User.findOne({
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
      const existingEmail = await User.findOne({
        _id: { $ne: user._id },
        email: emailInput,
      });
      if (existingEmail) {
        return res.status(409).json({
          field: 'email',
          message: 'Email is already registered.',
        });
      }

      updates.email = emailInput;
      updates.emailVerified = false;
      emailChanged = true;

      const verificationToken = generateVerificationToken();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      updates.emailVerificationToken = verificationToken;
      updates.emailVerificationExpires = verificationExpires;

      try {
        const emailSent = await sendVerificationEmail(emailInput, verificationToken);
        if (!emailSent) {
          console.error('Failed to send verification email on profile update.', {
            email: emailInput,
          });
        }
      } catch (err) {
        console.error('Error sending verification email on profile update:', err);
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
    console.error('Update profile error:', error);
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

    const user = await User.findOne({
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
    console.error('Verify email code error:', error);
    return res.status(500).json({ message: 'Failed to verify email.' });
  }
});

// DELETE /users/me/avatar - Remove the current avatar
router.delete('/me/avatar', auth(true, true), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // If an avatar exists, try to delete the file from the filesystem
    if (user.avatarUrl) {
      const filename = path.basename(user.avatarUrl);
      const filePath = path.join(avatarsDir, filename);

      fs.unlink(filePath, (err) => {
        // We ignore ENOENT (file not found) errors in case the file was already deleted manually
        if (err && err.code !== 'ENOENT') {
          console.error('Failed to delete avatar file from disk:', err);
        }
      });
    }

    // Remove the reference from the database
    user.avatarUrl = null;
    await user.save();

    return res.json({
      message: 'Avatar deleted successfully.',
      user: formatUserProfile(user),
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    return res.status(500).json({ message: 'Server error while deleting avatar.' });
  }
});

router.post(
  '/me/avatar',
  auth(true, true),
  avatarUpload.single('avatar'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);

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
              console.error('Failed to remove old avatar:', err);
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

        // Nur löschen, wenn sich der Dateiname wirklich ändert
        if (existingFilename && existingFilename !== newFilename) {
          const existingPath = path.join(avatarsDir, existingFilename);
          fs.unlink(existingPath, (err) => {
            if (err && err.code !== 'ENOENT') {
              console.error('Failed to remove old avatar:', err);
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
      console.error('Avatar upload error:', error);
      return res.status(500).json({ message: 'Failed to upload avatar.' });
    }
  }
);

module.exports = router;
