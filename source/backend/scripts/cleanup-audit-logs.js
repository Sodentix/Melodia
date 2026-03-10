/**
 * Cleanup old audit logs. Run via cron (e.g. daily).
 * Usage: node scripts/cleanup-audit-logs.js
 * Set AUDIT_LOG_RETENTION_DAYS in .env (default: 90).
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { cleanupOldLogs } = require('../services/auditLogService');

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/melodia');
  try {
    const { deletedCount } = await cleanupOldLogs();
    console.log(`Audit log cleanup: deleted ${deletedCount} old entries.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
