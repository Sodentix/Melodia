const LEVELS = ['debug', 'info', 'warn', 'error'];

function getLevelIndex(level) {
  const idx = LEVELS.indexOf(String(level || '').toLowerCase());
  return idx === -1 ? 1 : idx; // default to info
}

const configuredLevel = getLevelIndex(process.env.LOG_LEVEL);

function serializeError(err) {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function log(level, message, meta) {
  const levelIdx = getLevelIndex(level);
  if (levelIdx < configuredLevel) return;
  const payload = {
    ts: new Date().toISOString(),
    level: LEVELS[levelIdx],
    msg: message,
  };
  if (meta && typeof meta === 'object') {
    if (meta.err) payload.err = serializeError(meta.err);
    Object.assign(payload, meta.err ? { ...meta, err: payload.err } : meta);
  }
  try {
    // Map level to console method
    if (levelIdx >= 3) console.error(JSON.stringify(payload));
    else if (levelIdx === 2) console.warn(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
  } catch (_) { /* noop */ }
}

module.exports = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};


