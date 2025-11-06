function createLogger() {
  const logRequestBody = String(process.env.LOG_REQUEST_BODY || '').toLowerCase() === 'true';
  const logResponseBody = String(process.env.LOG_RESPONSE_BODY || '').toLowerCase() === 'true';
  const logHeaders = String(process.env.LOG_HEADERS || '').toLowerCase() === 'true';

  return function requestResponseLogger(req, res, next) {
    const start = process.hrtime.bigint();
    const { method, originalUrl } = req;
    const ip = req.ip || req.connection?.remoteAddress || '';

    const reqLog = {
      ts: new Date().toISOString(),
      type: 'request',
      method,
      url: originalUrl,
      ip,
      query: req.query,
    };
    if (req.user) reqLog.userId = req.user.id;
    if (logHeaders) reqLog.headers = req.headers;
    if (logRequestBody && req.body) reqLog.body = req.body;
    try { console.log(JSON.stringify(reqLog)); } catch (_) { /* noop */ }

    const originalSend = res.send.bind(res);
    let responseBodyForLog;
    res.send = function patchedSend(body) {
      responseBodyForLog = body;
      return originalSend(body);
    };

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      const resLog = {
        ts: new Date().toISOString(),
        type: 'response',
        method,
        url: originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      };
      if (req.user) resLog.userId = req.user.id;
      if (logHeaders) resLog.resHeaders = res.getHeaders();
      if (logResponseBody) resLog.body = safeSerializeBody(responseBodyForLog);
      try { console.log(JSON.stringify(resLog)); } catch (_) { /* noop */ }
    });

    next();
  };
}

function safeSerializeBody(body) {
  if (body == null) return body;
  if (typeof body === 'string') return body.slice(0, 2000);
  if (Buffer.isBuffer(body)) return `Buffer(${Math.min(body.length, 2000)} of ${body.length})`;
  try {
    const json = JSON.stringify(body);
    return json.length > 2000 ? json.slice(0, 2000) + '…' : json;
  } catch (_) {
    return '[unserializable-body]';
  }
}

module.exports = createLogger;


