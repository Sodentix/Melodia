# Backend Scripts

## Audit Log Cleanup

The `cleanup-audit-logs.js` script removes audit log entries older than the retention period (default 90 days, configurable via `AUDIT_LOG_RETENTION_DAYS`).

### Usage

```bash
node scripts/cleanup-audit-logs.js
```

Or from the project root:

```bash
cd backend && node scripts/cleanup-audit-logs.js
```

### Suggested Cron

Run daily at 3:00 AM:

```
0 3 * * * cd /path/to/backend && node scripts/cleanup-audit-logs.js
```

### Environment

- `AUDIT_LOG_RETENTION_DAYS` – Number of days to retain audit logs (default: 90)
- Uses the same MongoDB connection as the main app (from `MONGODB_URI` or `.env`)
