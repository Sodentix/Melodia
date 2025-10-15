const loginSecurity = require('../services/loginSecurity');

const MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5);
const WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const BLOCK_DURATION_MS = Number(process.env.LOGIN_BLOCK_DURATION_MS || WINDOW_MS);

describe('loginSecurity service', () => {
  const identifier = 'user@example.com|127.0.0.1';
  const otherIdentifier = 'other@example.com|127.0.0.1';

  const advanceTime = (ms) => {
    const current = Date.now();
    jest.setSystemTime(current + ms);
  };

  const triggerBlock = (id = identifier) => {
    let blocked = false;
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      blocked = loginSecurity.recordFailedAttempt(id);
    }
    return blocked;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z'));
    loginSecurity.__testing.resetAll();
  });

  afterEach(() => {
    loginSecurity.__testing.resetAll();
    jest.useRealTimers();
  });

  test('isBlocked returns false for new identifiers', () => {
    expect(loginSecurity.isBlocked(identifier)).toBe(false);
  });

  test('recordFailedAttempt returns falsy on initial failure', () => {
    const result = loginSecurity.recordFailedAttempt(identifier);
    expect(result).toBeFalsy();
  });

  test('recordFailedAttempt returns truthy once max attempts reached', () => {
    expect(triggerBlock()).toBeTruthy();
  });

  test('isBlocked remains true immediately after block', () => {
    triggerBlock();
    expect(loginSecurity.isBlocked(identifier)).toBe(true);
  });

  test('getBlockExpiresAt returns a future timestamp when blocked', () => {
    triggerBlock();
    const expiresAt = loginSecurity.getBlockExpiresAt(identifier);
    expect(typeof expiresAt).toBe('number');
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  test('resetAttempts clears block state instantly', () => {
    triggerBlock();
    loginSecurity.resetAttempts(identifier);
    expect(loginSecurity.isBlocked(identifier)).toBe(false);
  });

  test('getBlockExpiresAt returns null after resetAttempts', () => {
    triggerBlock();
    loginSecurity.resetAttempts(identifier);
    expect(loginSecurity.getBlockExpiresAt(identifier)).toBeNull();
  });

  test('recordFailedAttempt while blocked stays truthy and keeps block', () => {
    triggerBlock();
    const stillBlocked = loginSecurity.recordFailedAttempt(identifier);
    expect(stillBlocked).toBeTruthy();
    expect(loginSecurity.isBlocked(identifier)).toBe(true);
  });

  test('block persists while block duration has not elapsed', () => {
    triggerBlock();
    advanceTime(BLOCK_DURATION_MS - 1000);
    expect(loginSecurity.isBlocked(identifier)).toBe(true);
  });

  test('block clears automatically after duration elapses', () => {
    triggerBlock();
    advanceTime(BLOCK_DURATION_MS + 1000);
    expect(loginSecurity.isBlocked(identifier)).toBe(false);
  });

  test('getBlockExpiresAt returns null after block duration elapses', () => {
    triggerBlock();
    advanceTime(BLOCK_DURATION_MS + 1000);
    expect(loginSecurity.getBlockExpiresAt(identifier)).toBeNull();
  });

  test('recordFailedAttempt after block expiry starts a fresh window', () => {
    triggerBlock();
    advanceTime(BLOCK_DURATION_MS + 1000);
    const result = loginSecurity.recordFailedAttempt(identifier);
    expect(result).toBeFalsy();
    expect(loginSecurity.isBlocked(identifier)).toBe(false);
  });

  test('separate identifiers maintain independent counters', () => {
    triggerBlock();
    expect(loginSecurity.isBlocked(otherIdentifier)).toBe(false);
  });

  test('recordFailedAttempt on other identifier unaffected by primary block', () => {
    triggerBlock();
    const result = loginSecurity.recordFailedAttempt(otherIdentifier);
    expect(result).toBeFalsy();
    expect(loginSecurity.isBlocked(otherIdentifier)).toBe(false);
  });

  test('resetAttempts on one identifier does not affect another', () => {
    triggerBlock();
    triggerBlock(otherIdentifier);
    loginSecurity.resetAttempts(identifier);
    expect(loginSecurity.isBlocked(identifier)).toBe(false);
    expect(loginSecurity.isBlocked(otherIdentifier)).toBe(true);
  });

  test('resetAttempts for unknown identifier is safe', () => {
    expect(() => loginSecurity.resetAttempts('unknown')).not.toThrow();
    expect(loginSecurity.isBlocked('unknown')).toBe(false);
  });

  test('getBlockExpiresAt returns null for unknown identifier', () => {
    expect(loginSecurity.getBlockExpiresAt('missing')).toBeNull();
  });

  test('recordFailedAttempt resets window when time window elapses', () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
      loginSecurity.recordFailedAttempt(identifier);
    }
    advanceTime(WINDOW_MS + 1000);
    const result = loginSecurity.recordFailedAttempt(identifier);
    expect(result).toBeFalsy();
  });

  test('isBlocked clears stale entries after window expiry', () => {
    loginSecurity.recordFailedAttempt(identifier);
    advanceTime(WINDOW_MS + 1000);
    expect(loginSecurity.isBlocked(identifier)).toBe(false);
  });

  test('recordFailedAttempt spread across windows stays below block threshold', () => {
    loginSecurity.recordFailedAttempt(identifier);
    advanceTime(WINDOW_MS + 1000);
    const result = loginSecurity.recordFailedAttempt(identifier);
    expect(result).toBeFalsy();
    expect(loginSecurity.isBlocked(identifier)).toBe(false);
  });

  test('blocking twice requires the full number of attempts after expiry', () => {
    triggerBlock();
    advanceTime(BLOCK_DURATION_MS + 1000);
    for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
      const result = loginSecurity.recordFailedAttempt(identifier);
      expect(result).toBeFalsy();
    }
    const finalAttempt = loginSecurity.recordFailedAttempt(identifier);
    expect(finalAttempt).toBeTruthy();
  });

  test('block expiry timestamp moves forward over time', () => {
    triggerBlock();
    const firstExpiry = loginSecurity.getBlockExpiresAt(identifier);
    advanceTime(1000);
    const secondExpiry = loginSecurity.getBlockExpiresAt(identifier);
    expect(secondExpiry).toBeGreaterThan(Date.now());
    expect(secondExpiry).toBeLessThanOrEqual(firstExpiry);
  });

  test('recordFailedAttempt handles empty identifier strings', () => {
    expect(loginSecurity.recordFailedAttempt('')).toBeFalsy();
  });

  test('isBlocked handles empty identifier strings without blocking', () => {
    expect(loginSecurity.isBlocked('')).toBe(false);
  });

  test('recordFailedAttempt handles identifiers with whitespace', () => {
    const id = ' user@example.com ';
    expect(loginSecurity.recordFailedAttempt(id)).toBeFalsy();
    expect(loginSecurity.isBlocked(id)).toBe(false);
  });

  test('resetAttempts handles identifiers with whitespace gracefully', () => {
    const id = ' user@example.com ';
    loginSecurity.resetAttempts(id);
    expect(loginSecurity.isBlocked(id)).toBe(false);
  });

  test('block persists when repeatedly checking isBlocked before expiry', () => {
    triggerBlock();
    expect(loginSecurity.isBlocked(identifier)).toBe(true);
    expect(loginSecurity.isBlocked(identifier)).toBe(true);
  });

  test('recordFailedAttempt remains falsy for identifiers with different casing', () => {
    const mixedCase = 'User@example.com|127.0.0.1';
    expect(loginSecurity.recordFailedAttempt(mixedCase)).toBeFalsy();
    expect(loginSecurity.isBlocked(mixedCase)).toBe(false);
  });

  test('block expiry is within configured duration bounds', () => {
    triggerBlock();
    const expiresAt = loginSecurity.getBlockExpiresAt(identifier);
    const delta = expiresAt - Date.now();
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(BLOCK_DURATION_MS);
  });

  test('new block after expiry yields a later expiry timestamp', () => {
    triggerBlock();
    const firstExpiry = loginSecurity.getBlockExpiresAt(identifier);
    advanceTime(BLOCK_DURATION_MS + 1000);
    triggerBlock();
    const secondExpiry = loginSecurity.getBlockExpiresAt(identifier);
    expect(secondExpiry).toBeGreaterThan(firstExpiry);
  });

  test('recordFailedAttempt on secondary identifier after primary reset works normally', () => {
    triggerBlock();
    loginSecurity.resetAttempts(identifier);
    const result = loginSecurity.recordFailedAttempt(otherIdentifier);
    expect(result).toBeFalsy();
  });

  test('isBlocked stays false for identifiers that never exceeded attempts', () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
      loginSecurity.recordFailedAttempt(otherIdentifier);
    }
    expect(loginSecurity.isBlocked(otherIdentifier)).toBe(false);
  });

  test('resetAttempts clears partially used attempt windows', () => {
    loginSecurity.recordFailedAttempt(identifier);
    loginSecurity.resetAttempts(identifier);
    expect(loginSecurity.recordFailedAttempt(identifier)).toBeFalsy();
  });

  test('getBlockExpiresAt cleans up expired block entries when called repeatedly', () => {
    triggerBlock();
    advanceTime(BLOCK_DURATION_MS + 1000);
    expect(loginSecurity.getBlockExpiresAt(identifier)).toBeNull();
    expect(loginSecurity.getBlockExpiresAt(identifier)).toBeNull();
  });

  describe('bulk identifier baseline checks', () => {
    const bulkIdentifiers = Array.from({ length: 30 }, (_, index) => ({
      identifier: `bulk-${index}@example.com|192.0.2.${index}`,
    }));

    test.each(bulkIdentifiers)(
      'initial attempt for $identifier is not blocked',
      ({ identifier: id }) => {
        expect(loginSecurity.isBlocked(id)).toBe(false);
        const attemptResult = loginSecurity.recordFailedAttempt(id);
        expect(attemptResult).toBeFalsy();
        expect(loginSecurity.isBlocked(id)).toBe(false);
      }
    );
  });
});
