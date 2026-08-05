#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Manual production deploy — same steps the GitHub Actions workflow runs inline.
# Run on the EC2 box:  bash /var/www/rurban/rurban-ecommerce/deploy/deploy-prod.sh
#
# Syncs the checkout to origin/main exactly (discarding any server-local edits),
# reinstalls deps only if the lockfile changed, rebuilds, and reloads PM2.
# .env.local is git-ignored, so it is preserved across deploys.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR=/var/www/rurban
APP_DIR="$REPO_DIR/rurban-ecommerce"

cd "$REPO_DIR"
echo "Fetching latest main..."
git fetch --prune origin main
BEFORE=$(git rev-parse HEAD)
git reset --hard origin/main
AFTER=$(git rev-parse HEAD)
echo "Deploying ${BEFORE:0:7} -> ${AFTER:0:7}"

cd "$APP_DIR"
if [ ! -d node_modules ] || ! git diff --quiet "$BEFORE" "$AFTER" -- package-lock.json; then
  echo "Dependencies changed — running npm ci..."
  npm ci --no-audit --no-fund
else
  echo "No dependency change — skipping install."
fi

echo "Building..."
npm run build

echo "Reloading PM2..."
pm2 reload ecosystem.config.js --update-env
pm2 save
echo "✓ Deploy complete."
