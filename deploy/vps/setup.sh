#!/usr/bin/env bash
set -euo pipefail

# Run once on a new Ubuntu VPS:
#   bash deploy/vps/setup.sh /opt/velocart-backend
APP_DIR="${1:-/opt/velocart-backend}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

sudo usermod -aG docker "$USER"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"

if [[ -f "$APP_DIR/deploy/nginx/vps-ip.conf" ]]; then
  sudo cp "$APP_DIR/deploy/nginx/vps-ip.conf" /etc/nginx/sites-available/velocart
  sudo ln -sfn /etc/nginx/sites-available/velocart /etc/nginx/sites-enabled/velocart
  sudo nginx -t
  sudo systemctl enable --now nginx
  sudo systemctl reload nginx
fi

if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 80/tcp
fi

echo "Docker and Nginx are ready. Create $APP_DIR/.env from .env.vps.example, then run docker compose up -d --build."
