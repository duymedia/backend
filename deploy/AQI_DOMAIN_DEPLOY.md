# Deploy `aqi.io.vn`

This deployment uses only `https://aqi.io.vn` (and optional `www`). The Expo web
frontend runs on port `127.0.0.1:8080`; Nginx sends `/api/*` and the payment
webhook to the Node API on port `127.0.0.1:3000`.

## 1. Cloudflare DNS

Create or keep these records, all pointing to the VPS IP `103.229.52.143`:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | `103.229.52.143` | Proxied |
| A | `www` | `103.229.52.143` | Proxied |

## 2. VPS environment files

On the VPS, create `backend/.env` from `.env.vps.example` and set:

```dotenv
NODE_ENV=production
APP_URL=https://aqi.io.vn
FRONTEND_URL=https://aqi.io.vn
EXTRA_CORS_ORIGINS=https://aqi.io.vn,https://www.aqi.io.vn
```

Keep the generated `JWT_SECRET` and MySQL credentials private.

Create `frontend/.env` (this file is intentionally ignored by Git):

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://aqi.io.vn
```

Build and start both services:

```bash
cd /path/to/backend && docker compose up -d --build
cd /path/to/frontend && docker compose up -d --build
```

## 3. Nginx and HTTPS

Install the combined virtual host, replacing `/path/to` with the actual clone location:

```bash
sudo cp /path/to/frontend/deploy/nginx/aqi.io.vn.conf /etc/nginx/sites-available/aqi-web
sudo ln -sfn /etc/nginx/sites-available/aqi-web /etc/nginx/sites-enabled/aqi-web
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Issue certificates after DNS has propagated:

```bash
sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d aqi.io.vn -d www.aqi.io.vn
```

In Cloudflare, set **SSL/TLS encryption mode** to **Full (strict)** only after the
certificate command succeeds. Turn on **Always Use HTTPS**.

## 4. Verify

```bash
curl -I https://aqi.io.vn
curl -I https://www.aqi.io.vn
curl -I https://aqi.io.vn/api/health/db
```

The API health endpoint also verifies its database connection.
