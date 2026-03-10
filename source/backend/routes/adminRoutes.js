const express = require('express');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const User = require('../models/User');
const Stats = require('../models/Stats');
const AuditLog = require('../models/AuditLog');
const { listCategories, writeCategories, createCategory } = require('../services/categoryService');
const { updateCategoryById } = require('../services/generateSongFiles');
const { logAdminAction } = require('../services/auditLogService');
const appLogger = require('../utils/logger');

const avatarsDir = path.join(__dirname, '..', 'assets', 'avatars');

const router = express.Router();

router.use(auth(true, true));
router.use(requireAdmin);

router.get('/', (_req, res) => {
  res.json({ message: 'Admin area' });
});

router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const skip = (page - 1) * limit;

    const filter = {};
    if (search.length > 0) {
      const re = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ username: re }, { email: re }];
    }

    const includeDeleted = req.query.includeDeleted === 'true';
    const query = includeDeleted ? User.find(filter) : User.findNotDeleted(filter);
    const countQuery = includeDeleted ? User.countDocuments(filter) : User.findNotDeleted(filter).countDocuments();

    const [users, total] = await Promise.all([
      query
        .select('username firstName lastName email userRole emailVerified createdAt deletedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      countQuery,
    ]);

    return res.json({
      users: users.map((u) => ({
        id: u._id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        userRole: u.userRole || 'user',
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        deletedAt: u.deletedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    appLogger.error('Admin list users error', { err });
    return res.status(500).json({ message: 'Failed to list users.' });
  }
});

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.patch('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userRole = req.body.userRole;

    if (userRole !== undefined) {
      if (userRole !== 'user' && userRole !== 'admin') {
        return res.status(400).json({ message: 'userRole must be "user" or "admin".' });
      }
    } else {
      return res.status(400).json({ message: 'No updates provided.' });
    }

    const user = await User.findByIdNotDeleted(userId).select('username firstName lastName email userRole emailVerified createdAt');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const previousRole = user.userRole;
    user.userRole = userRole;
    await user.save();

    await logAdminAction({
      adminId: req.user.id,
      action: 'user.role_change',
      targetType: 'user',
      targetId: userId,
      details: { previousRole, newRole: userRole },
      req,
    });

    return res.json({
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userRole: user.userRole,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    appLogger.error('Admin update user error', { err });
    return res.status(500).json({ message: 'Failed to update user.' });
  }
});

router.get('/categories', (_req, res) => {
  try {
    const categories = listCategories();
    return res.json({ categories });
  } catch (err) {
    appLogger.error('Admin list categories error', { err });
    return res.status(500).json({ message: 'Failed to load categories.' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, description, accent, difficulty, playlistIds, trackIds, id } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    const category = createCategory({
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      accent: typeof accent === 'string' ? accent.trim() : '#05d9ff',
      difficulty: typeof difficulty === 'string' ? difficulty.trim() : 'easy',
      playlistIds: playlistIds ?? [],
      trackIds: trackIds ?? [],
      id,
    });
    await logAdminAction({
      adminId: req.user.id,
      action: 'categories.update',
      targetType: 'categories',
      targetId: category.id,
      details: { action: 'create', categoryId: category.id },
      req,
    });
    try {
      await updateCategoryById(category.id);
    } catch (refreshErr) {
      appLogger.warn('Category created but song refresh failed', { categoryId: category.id, err: refreshErr });
    }
    return res.status(201).json({ category });
  } catch (err) {
    appLogger.error('Admin create category error', { err });
    return res.status(400).json({ message: err.message || 'Failed to create category.' });
  }
});

router.post('/categories/:id/refresh', async (req, res) => {
  try {
    const categoryId = req.params.id;
    await updateCategoryById(categoryId);
    return res.json({ message: 'Category songs refreshed.', categoryId });
  } catch (err) {
    appLogger.error('Admin refresh category error', { err });
    return res.status(400).json({ message: err.message || 'Failed to refresh category songs.' });
  }
});

router.get('/audit-logs/export', async (req, res) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit, 10) || 1000));
    if (format !== 'csv' && format !== 'json') {
      return res.status(400).json({ message: 'Format must be csv or json.' });
    }
    const logs = await AuditLog.find()
      .populate('adminId', 'username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const rows = logs.map((l) => ({
      id: String(l._id),
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId || '',
      details: JSON.stringify(l.details || {}),
      adminUsername: l.adminId?.username ?? '',
      createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : '',
    }));
    if (format === 'csv') {
      const header = 'id,action,targetType,targetId,details,adminUsername,createdAt';
      const lines = rows.map((r) =>
        [r.id, r.action, r.targetType, r.targetId, `"${String(r.details).replace(/"/g, '""')}"`, r.adminUsername, r.createdAt].join(',')
      );
      const csv = [header, ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csv);
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.json({ logs: rows });
  } catch (err) {
    appLogger.error('Admin audit logs export error', { err });
    return res.status(500).json({ message: 'Failed to export audit logs.' });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find()
        .populate('adminId', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(),
    ]);

    return res.json({
      logs: logs.map((l) => ({
        id: l._id,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        details: l.details,
        adminUsername: l.adminId?.username ?? null,
        createdAt: l.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    appLogger.error('Admin audit logs error', { err });
    return res.status(500).json({ message: 'Failed to load audit logs.' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const body = req.body || {};
    const hardDelete = body.hardDelete === true || body.hardDelete === 'true';

    if (String(req.user.id) === userId) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (hardDelete) {
      await Stats.deleteOne({ user: user._id });
      if (user.avatarUrl) {
        const filename = path.basename(user.avatarUrl);
        const filePath = path.join(avatarsDir, filename);
        try {
          await fs.promises.unlink(filePath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            appLogger.error('Failed to delete avatar file', { err });
          }
        }
      }
      await User.findByIdAndDelete(userId);
      await logAdminAction({
        adminId: req.user.id,
        action: 'user.delete',
        targetType: 'user',
        targetId: userId,
        details: { softDelete: false },
        req,
      });
      return res.json({ message: 'User permanently deleted.' });
    }

    user.deletedEmail = user.email;
    user.deletedUsername = user.username;
    user.deletedAt = new Date();
    const idStr = String(user._id);
    const shortId = idStr.slice(-10);
    user.email = `deleted_${idStr}@deleted.local`;
    user.username = `d_${shortId}`;
    user.usernameLower = `d_${shortId}`;
    await user.save();

    await logAdminAction({
      adminId: req.user.id,
      action: 'user.delete',
      targetType: 'user',
      targetId: userId,
      details: { softDelete: true },
      req,
    });

    return res.json({ message: 'User deleted.' });
  } catch (err) {
    appLogger.error('Admin delete user error', { err });
    return res.status(500).json({ message: 'Failed to delete user.' });
  }
});

router.post('/users/:id/restore', async (req, res) => {
  try {
    const userId = req.params.id;
    const overrideEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    const overrideUsername = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : null;

    const user = await User.findById(userId).select('+deletedEmail +deletedUsername');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (!user.deletedAt) {
      return res.status(400).json({ message: 'User is not deleted.' });
    }

    let finalEmail;
    let finalUsername;

    if (overrideEmail && overrideUsername) {
      if (overrideEmail.length < 5 || !overrideEmail.includes('@')) {
        return res.status(400).json({ message: 'Invalid email format.' });
      }
      if (overrideUsername.length < 3 || overrideUsername.length > 12 || !/^[a-z0-9_.-]+$/.test(overrideUsername)) {
        return res.status(400).json({ message: 'Username must be 3-12 chars, lowercase letters, numbers, and _.- only.' });
      }
      finalEmail = overrideEmail;
      finalUsername = overrideUsername;
    } else if (!user.deletedEmail || !user.deletedUsername) {
      return res.status(400).json({
        message: 'Restore not possible: original email/username not stored. Provide email and username in request body.',
      });
    } else {
      finalEmail = user.deletedEmail;
      finalUsername = user.deletedUsername;
    }

    const existingEmail = await User.findOneNotDeleted({ email: finalEmail, _id: { $ne: user._id } });
    if (existingEmail) {
      return res.status(409).json({
        message: 'Email is already taken by another user. Provide new email and username in request body.',
        code: 'EMAIL_TAKEN',
      });
    }
    const existingUsername = await User.findOneNotDeleted({
      username: finalUsername,
      _id: { $ne: user._id },
    });
    if (existingUsername) {
      return res.status(409).json({
        message: 'Username is already taken by another user. Provide new email and username in request body.',
        code: 'USERNAME_TAKEN',
      });
    }

    user.email = finalEmail;
    user.username = finalUsername;
    user.usernameLower = finalUsername.toLowerCase();
    user.deletedAt = null;
    user.deletedEmail = undefined;
    user.deletedUsername = undefined;
    await user.save();

    await logAdminAction({
      adminId: req.user.id,
      action: 'user.restore',
      targetType: 'user',
      targetId: userId,
      details: overrideEmail && overrideUsername ? { restoredWithNewCredentials: true } : {},
      req,
    });

    return res.json({
      message: 'User restored.',
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userRole: user.userRole || 'user',
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    appLogger.error('Admin restore user error', { err });
    return res.status(500).json({ message: 'Failed to restore user.' });
  }
});

router.put('/categories', async (req, res) => {
  try {
    const categories = req.body.categories;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ message: 'categories must be an array.' });
    }
    const updated = writeCategories(categories);
    await logAdminAction({
      adminId: req.user.id,
      action: 'categories.update',
      targetType: 'categories',
      details: { categoryCount: updated.length },
      req,
    });
    return res.json({ categories: updated });
  } catch (err) {
    appLogger.error('Admin write categories error', { err });
    return res.status(400).json({ message: err.message || 'Failed to update categories.' });
  }
});

module.exports = router;
