const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Production: require security-critical env vars (fail fast)
if (process.env.NODE_ENV === 'production') {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.trim().length < 16) {
    console.error('Fatal: JWT_SECRET must be set in production and at least 16 characters.');
    process.exit(1);
  }
  const corsOrigin = (process.env.CORS_ORIGIN || '').trim();
  if (!corsOrigin) {
    console.error('Fatal: CORS_ORIGIN must be set in production (e.g. https://your-frontend.example.com).');
    process.exit(1);
  }
}

const connectDB = require('./config/database');
const app = require('./app');
const { startSongGenerationService } = require('./services/generateSongFiles');

// Connect to MongoDB
connectDB();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Start the song generation service (fetches from Deezer)
startSongGenerationService();

app.listen(PORT, HOST, () => {
  console.log(`Backend running on http://${HOST}:${PORT}`);
});

