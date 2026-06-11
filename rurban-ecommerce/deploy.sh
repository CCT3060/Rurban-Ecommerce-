#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Rurban E-Commerce — EC2 Deployment Script
# Run this script on your EC2 instance to deploy/update the application.
# Usage:
#   First deploy:  bash deploy.sh --setup
#   Update only:   bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Exit on any error

APP_DIR="/var/www/rurban-ecommerce"
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"  # ← change this
BRANCH="main"

echo "=== Rurban Deploy Script ==="

# ── Pull latest code ──────────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  echo "[1/5] Pulling latest code..."
  cd "$APP_DIR"
  git pull origin "$BRANCH"
else
  echo "[1/5] Cloning repository..."
  sudo mkdir -p "$APP_DIR"
  sudo chown -R ubuntu:ubuntu /var/www
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── Install dependencies ──────────────────────────────────────────────────────
echo "[2/5] Installing dependencies..."
npm ci --production=false  # need devDeps for build

# ── Copy environment variables ────────────────────────────────────────────────
echo "[3/5] Checking .env.local..."
if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "ERROR: .env.local not found at $APP_DIR/.env.local"
  echo "Create it before running this script (see .env.example)"
  exit 1
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo "[4/5] Building Next.js..."
npm run build

# ── Restart app via PM2 ───────────────────────────────────────────────────────
echo "[5/5] Restarting PM2..."
if pm2 list | grep -q "rurban-ecommerce"; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo ""
echo "✓ Deploy complete! App running at http://localhost:3000"
echo "  Check logs: pm2 logs rurban-ecommerce"
