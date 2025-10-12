const DEFAULT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5);
const DEFAULT_BLOCK_DURATION_MS = Number(process.env.LOGIN_BLOCK_DURATION_MS || DEFAULT_WINDOW_MS);

// Internal store for login attempts keyed by identifier (e.g., email or IP)
const attemptsStore = new Map();

function getConfig() {
  return {
    windowMs: DEFAULT_WINDOW_MS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    blockDurationMs: DEFAULT_BLOCK_DURATION_MS,
  };
}

function getEntry(identifier) {
  if (!attemptsStore.has(identifier)) {
    attemptsStore.set(identifier, { attempts: 0, expiresAt: 0, blockedUntil: 0 });
  }
  return attemptsStore.get(identifier);
}

function isBlocked(identifier) {
  const now = Date.now();
  const entry = attemptsStore.get(identifier);
  if (!entry) return false;

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return true;
  }

  if (entry.blockedUntil && entry.blockedUntil <= now) {
    attemptsStore.delete(identifier);
    return false;
  }

  if (entry.expiresAt && entry.expiresAt <= now) {
    attemptsStore.delete(identifier);
  }

  return false;
}

function recordFailedAttempt(identifier) {
  const now = Date.now();
  const { windowMs, maxAttempts, blockDurationMs } = getConfig();
  const entry = getEntry(identifier);

  if (entry.expiresAt <= now) {
    entry.attempts = 0;
  }

  entry.attempts += 1;
  entry.expiresAt = now + windowMs;

  if (entry.attempts >= maxAttempts) {
    entry.blockedUntil = now + blockDurationMs;
    entry.attempts = 0;
  }

  attemptsStore.set(identifier, entry);
  return entry.blockedUntil && entry.blockedUntil > now;
}

function resetAttempts(identifier) {
  attemptsStore.delete(identifier);
}

function getBlockExpiresAt(identifier) {
  const entry = attemptsStore.get(identifier);
  if (!entry || !entry.blockedUntil) return null;
  if (entry.blockedUntil <= Date.now()) {
    attemptsStore.delete(identifier);
    return null;
  }
  return entry.blockedUntil;
}

module.exports = {
  isBlocked,
  recordFailedAttempt,
  resetAttempts,
  getBlockExpiresAt,
  __testing: {
    resetAll: () => attemptsStore.clear(),
  },
};

