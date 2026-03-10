const AuditLog = require('../models/AuditLog');

/**
 * Log an admin action for audit trail.
 * @param {Object} opts
 * @param {string} opts.adminId - Admin user ID
 * @param {string} opts.action - Action type (user.role_change, user.delete, categories.update)
 * @param {string} opts.targetType - Target type (user, categories)
 * @param {string} [opts.targetId] - Target ID if applicable
 * @param {Object} [opts.details] - Additional details (e.g. { previousRole, newRole })
 * @param {import('express').Request} [opts.req] - Express request for ip/userAgent
 */
async function logAdminAction({ adminId, action, targetType, targetId, details, req }) {
  try {
    const doc = {
      adminId,
      action,
      targetType,
      targetId: targetId || undefined,
      details: details || undefined,
      ip: req?.ip || req?.connection?.remoteAddress || undefined,
      userAgent: req?.get?.('user-agent') || undefined,
    };
    await AuditLog.create(doc);
  } catch (err) {
    const appLogger = require('../utils/logger');
    appLogger.error('Audit log write failed', { err, action, targetType });
  }
}

/**
 * Delete audit logs older than retention period.
 * @param {number} [retentionDays] - Days to keep. Default from AUDIT_LOG_RETENTION_DAYS or 90.
 * @returns {Promise<{ deletedCount: number }>}
 */
async function cleanupOldLogs(retentionDays) {
  const days = retentionDays ?? Math.max(1, parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 10) || 90);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
  const appLogger = require('../utils/logger');
  appLogger.info('Audit log cleanup', { deletedCount: result.deletedCount, cutoff: cutoff.toISOString() });
  return { deletedCount: result.deletedCount };
}

module.exports = { logAdminAction, cleanupOldLogs };
