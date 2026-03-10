# Melodia

A platform for guessing songs. Test your music knowledge, play against the clock, and climb the leaderboard.

## Prerequisites

- **Node.js** 20 or later
- **MongoDB** (local or remote instance)
- **npm** (comes with Node.js)

## Quick Start

### 1. Backend

```sh
cd backend
cp .env.example .env
# Edit .env and set MONGODB_URI, JWT_SECRET, and other variables
npm install
npm run dev
```

The backend runs at `http://localhost:5000` by default.

### 2. Frontend

```sh
cd frontend
cp .env.example .env
# Edit .env and set VITE_API_URL to your backend URL (e.g. http://localhost:5000)
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` by default.

## Environment Variables

### Backend

See `backend/.env.example` for all required variables. Key ones for production:

- `MONGODB_URI` – MongoDB connection string
- `JWT_SECRET` – Secret for JWT signing (min 16 characters)
- `CORS_ORIGIN` – Comma-separated allowed frontend origins
- `FRONTEND_URL` – Base URL for email links (verify-email, reset-password)
- `EMAIL_USER` / `EMAIL_PASSWORD` – SMTP credentials for transactional emails

### Frontend

See `frontend/.env.example`:

- `VITE_API_URL` – Backend API base URL (e.g. `https://api.melodia.app`)

## Production Build

### Frontend

```sh
cd frontend
npm run build
```

Output is in `frontend/dist`. Serve with any static file server (Nginx, Vercel, Netlify, etc.).

### Backend

```sh
cd backend
npm start
```

Uses `NODE_ENV=production` when deployed.

## Deployment Notes

- **Static frontend hosting**: Deploy `frontend/dist` to a CDN or static host. Configure the server for SPA routing (fallback to `index.html` for all routes).
- **API URL**: Set `VITE_API_URL` at build time to your production API URL.
- **CORS**: Add your frontend origin(s) to `CORS_ORIGIN` in the backend `.env`.
- **FRONTEND_URL**: Set to your production frontend URL so email links (verification, password reset) point to the correct domain.
- **Health check**: The backend exposes `GET /health` and `GET /health/db` for load balancers and uptime monitoring.
