jest.setTimeout(30000);

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
// BACKEND_URL must be provided by the test environment to avoid hardcoded URLs
process.env.CORS_ORIGIN = '';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = process.env.LOGIN_RATE_LIMIT_WINDOW_MS || String(60 * 1000);
process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || '3';
process.env.LOGIN_BLOCK_DURATION_MS = process.env.LOGIN_BLOCK_DURATION_MS || String(2 * 60 * 1000);
