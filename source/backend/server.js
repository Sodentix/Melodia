require('dotenv').config();
const connectDB = require('./config/database');
const app = require('./app');

// Connect to MongoDB
connectDB();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Backend running on http://${HOST}:${PORT}`);
});

