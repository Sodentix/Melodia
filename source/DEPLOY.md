# Melodia – Docker + Cloudflare Tunnel Deployment

## Prerequisites

- Docker & Docker Compose
- Cloudflare account

## 1. Environment

```bash
cp .env.docker.example backend/.env
# Edit backend/.env with your values
```

**Optional** – for MongoDB container credentials, create `.env` in the project root (same folder as `docker-compose.yml`):

```bash
MONGO_USER=melodia
MONGO_PASSWORD=your-secure-password
```

Defaults are `melodia` / `melodia_secret` if not set.

**Important for Cloudflare Tunnel:**

- Set `CORS_ORIGIN`, `FRONTEND_URL`, and `BACKEND_URL` to your tunnel URL (e.g. `https://melodia.yourdomain.com`)
- Use a strong `JWT_SECRET` (≥16 characters)
- `MONGODB_URI` is set automatically when using the included MongoDB container

## 2. Build & Run

```bash
cd source
docker compose up -d --build
```

- Frontend (nginx): `http://localhost:3001`
- Backend: internal only (proxied via nginx)
- MongoDB: internal only (port 27017 exposed for debugging if needed)

## 3. Cloudflare Tunnel

1. Install `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

2. Create a tunnel:

   ```bash
   cloudflared tunnel create melodia
   ```

3. Configure the tunnel (e.g. `~/.cloudflared/config.yml`):

   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /path/to/<TUNNEL_ID>.json

   ingress:
     - hostname: melodia.yourdomain.com
       service: http://localhost:3001
     - service: http_status:404
   ```

4. Route DNS:

   ```bash
   cloudflared tunnel route dns melodia melodia.yourdomain.com
   ```

5. Run the tunnel:

   ```bash
   cloudflared tunnel run melodia
   ```

## 4. Verify

- Open `https://melodia.yourdomain.com`
- Check `/health` (proxied to backend)
- Test login/register

## Volumes

- `backend-clips`: audio clips
- `backend-avatars`: user avatars
- `mongodb-data`: MongoDB database

Back these up if you need to migrate.
