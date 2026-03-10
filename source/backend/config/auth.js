/**
 * Centralized auth config. In production, JWT_SECRET must be set (no weak fallback).
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
      throw new Error(
        'JWT_SECRET must be set in production and at least 16 characters. ' +
        'Set JWT_SECRET in your .env or environment.'
      );
    }
    return secret;
  }
  return secret && secret.trim() ? secret : 'dev-secret-change-me';
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '7d';
}

module.exports = {
  getJwtSecret,
  getJwtExpiresIn,
};
