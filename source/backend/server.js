require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');

// Connect to MongoDB
connectDB();

const app = express();

// Security headers
app.use(helmet());

// CORS configuration from env
const corsOriginEnv = process.env.CORS_ORIGIN || '';
const allowedOrigins = corsOriginEnv
	.split(',')
	.map((o) => o.trim())
	.filter((o) => o.length > 0);

app.use(
	cors({
		origin: allowedOrigins.length > 0 ? allowedOrigins : false,
		credentials: true,
	})
);
app.use(express.json());


const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
	console.log(`Backend running on http://${HOST}:${PORT}`);
});


