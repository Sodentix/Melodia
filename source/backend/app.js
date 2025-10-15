const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Security headers
app.use(helmet());

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

// Routes
app.use('/auth', authRoutes);

module.exports = app;

