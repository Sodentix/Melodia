const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const statsRoutes = require('./routes/statsRoutes');
const gameRoutes = require('./routes/gameRoutes');
const libraryRoutes = require('./routes/libraryRoutes');
const createLogger = require('./middleware/logger');
const path = require('path');
const appLogger = require('./utils/logger');

const app = express();

// CORS configuration from env (needed before helmet for static files)
const corsOriginEnv = process.env.CORS_ORIGIN || '';
const allowedOrigins = corsOriginEnv
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

// Security headers with CSP configured for media
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(createLogger());

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true, // Allow all origins in dev if not configured
    credentials: true,
    exposedHeaders: ['Content-Range', 'Accept-Ranges'],
  })
);

app.use(express.json());

// Static clips (fallback audio) served at /clips
// Must handle CORS and range requests for audio streaming
const clipsDir = path.join(__dirname, 'assets', 'clips');

// CORS middleware for clips (runs before static file serving)
app.use('/clips', (req, res, next) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (allowedOrigins.length > 0) {
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    }
    return res.status(204).end();
  }
  
  // Set CORS headers for actual requests
  const origin = req.headers.origin;
  if (allowedOrigins.length > 0) {
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  }
  next();
});

// Serve static files with proper headers
app.use('/clips', express.static(clipsDir, {
  fallthrough: true,
  maxAge: '1h',
  immutable: true,
  setHeaders: (res, filePath) => {
    // Ensure proper content type for audio files
    if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.m4a')) {
      res.setHeader('Content-Type', 'audio/mp4');
    } else if (filePath.endsWith('.wav')) {
      res.setHeader('Content-Type', 'audio/wav');
    } else if (filePath.endsWith('.ogg')) {
      res.setHeader('Content-Type', 'audio/ogg');
    }
    // Enable range requests for audio streaming
    res.setHeader('Accept-Ranges', 'bytes');
  },
}));

// Routes
app.use('/auth', authRoutes);
app.use('/stats', statsRoutes);
app.use('/game', gameRoutes);
app.use('/library', libraryRoutes);

// Global error handler (ensure all unhandled route errors are logged)
// Must be after routes
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  appLogger.error('unhandled_route_error', {
    method: req.method,
    url: req.originalUrl,
    err,
  });
  const status = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error');
  res.status(status).json({ message });
});

// Process-level error logging
process.on('uncaughtException', (err) => {
  appLogger.error('uncaught_exception', { err });
});
process.on('unhandledRejection', (reason) => {
  appLogger.error('unhandled_rejection', { err: reason instanceof Error ? reason : new Error(String(reason)) });
});

module.exports = app;

