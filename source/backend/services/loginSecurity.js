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
    attemptsStore.set(identifier, {
      attempts: 0,
      expiresAt: 0,
      blockedUntil: 0,
      manuallyBlocked: false,
      manualBlockedAt: null,
      manualBlockedBy: null,
      manualBlockReason: null,
    });
  }
  return attemptsStore.get(identifier);
}

function getBlockState(identifier) {
  const now = Date.now();
  const entry = attemptsStore.get(identifier);

  if (!entry) {
    return {
      isBlocked: false,
      blockedUntil: null,
      manuallyBlocked: false,
      manualBlockedAt: null,
      manualBlockedBy: null,
      manualBlockReason: null,
    };
  }

  if (entry.manuallyBlocked) {
    return {
      isBlocked: true,
      blockedUntil: null,
      manuallyBlocked: true,
      manualBlockedAt: entry.manualBlockedAt,
      manualBlockedBy: entry.manualBlockedBy,
      manualBlockReason: entry.manualBlockReason,
    };
  }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      isBlocked: true,
      blockedUntil: entry.blockedUntil,
      manuallyBlocked: false,
      manualBlockedAt: null,
      manualBlockedBy: null,
      manualBlockReason: null,
    };
  }

  if ((entry.blockedUntil && entry.blockedUntil <= now) || (entry.expiresAt && entry.expiresAt <= now)) {
    attemptsStore.delete(identifier);
  }

  return {
    isBlocked: false,
    blockedUntil: null,
    manuallyBlocked: false,
    manualBlockedAt: null,
    manualBlockedBy: null,
    manualBlockReason: null,
  };
}

function isBlocked(identifier) {
  return getBlockState(identifier).isBlocked;
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
  const state = getBlockState(identifier);
  if (state.manuallyBlocked) {
    return null;
  }
  return state.blockedUntil;
}

function setManualBlock(identifier, { blocked, blockedBy = null, reason = null } = {}) {
  const entry = getEntry(identifier);

  if (blocked) {
    entry.manuallyBlocked = true;
    entry.manualBlockedAt = Date.now();
    entry.manualBlockedBy = blockedBy;
    entry.manualBlockReason = reason || null;
    entry.blockedUntil = Number.MAX_SAFE_INTEGER;
    entry.attempts = 0;
    entry.expiresAt = 0;
  } else {
    entry.manuallyBlocked = false;
    entry.manualBlockedAt = null;
    entry.manualBlockedBy = null;
    entry.manualBlockReason = null;
    entry.blockedUntil = 0;
    entry.attempts = 0;
    entry.expiresAt = 0;
  }

  attemptsStore.set(identifier, entry);
  return getBlockState(identifier);
}

module.exports = {
  isBlocked,
  recordFailedAttempt,
  resetAttempts,
  getBlockExpiresAt,
  getBlockState,
  setManualBlock,
  __testing: {
    resetAll: () => attemptsStore.clear(),
  },
};

