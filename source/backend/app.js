const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const statsRoutes = require('./routes/statsRoutes');
const gameRoutes = require('./routes/gameRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');
const createLogger = require('./middleware/logger');
const path = require('path');

const app = express();

// Security headers
app.use(helmet());
app.use(createLogger());

// CORS configuration from env
const corsOriginEnv = process.env.CORS_ORIGIN || '';
const allowedOrigins = corsOriginEnv
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  })
);

app.use(express.json());

// Static clips (fallback audio) served at /clips
app.use('/clips', (req, res, next) => {
  // Only serve from our controlled directory
  const dir = path.join(__dirname, 'assets', 'clips');
  express.static(dir, {
    fallthrough: true,
    maxAge: '1h',
    immutable: true,
  })(req, res, next);
});

// Routes
app.use('/auth', authRoutes);
app.use('/stats', statsRoutes);
app.use('/game', gameRoutes);
app.use('/spotify', spotifyRoutes);

module.exports = app;

