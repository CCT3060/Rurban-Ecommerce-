#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Update the Next.js app to use self-hosted Supabase.
# Run AFTER 03-migrate-db.sh completes.
# Usage: bash 04-update-app-env.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

KEYS_FILE="/home/ec2-user/supabase-keys.txt"
APP_DIR="/var/www/rurban-ecommerce"

if [[ ! -f "$KEYS_FILE" ]]; then
  echo "ERROR: ${KEYS_FILE} not found. Run 02-setup-supabase.sh first."
  exit 1
fi

echo "=== Reading new Supabase credentials ==="
NEW_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$KEYS_FILE" | cut -d'=' -f2-)
NEW_ANON_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$KEYS_FILE" | cut -d'=' -f2-)
NEW_SERVICE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" "$KEYS_FILE" | cut -d'=' -f2-)

echo "  New Supabase URL: ${NEW_URL}"

echo ""
echo "=== Updating .env.local ==="
ENV_FILE="${APP_DIR}/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: ${ENV_FILE} not found."
  exit 1
fi

# Back up existing env
cp "$ENV_FILE" "${ENV_FILE}.backup-$(date +%Y%m%d_%H%M%S)"

# Replace values
sed -i "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=${NEW_URL}|" "$ENV_FILE"
sed -i "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEW_ANON_KEY}|" "$ENV_FILE"
sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${NEW_SERVICE_KEY}|" "$ENV_FILE"

# Update NEXT_PUBLIC_APP_URL if needed
EC2_PUBLIC_IP=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")
sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=http://${EC2_PUBLIC_IP}|" "$ENV_FILE"
sed -i "s|NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=http://${EC2_PUBLIC_IP}|" "$ENV_FILE"

echo "✓ .env.local updated"

echo ""
echo "=== Rebuilding Next.js app ==="
cd "$APP_DIR"
npm run build

echo ""
echo "=== Restarting with PM2 ==="
pm2 reload ecosystem.config.js --update-env
pm2 save

echo ""
echo "============================================================"
echo "✓ App is now using self-hosted Supabase!"
echo ""
echo "  App URL:    http://${EC2_PUBLIC_IP}"
echo "  Supabase:   ${NEW_URL}"
echo "  Studio:     http://${EC2_PUBLIC_IP}:3001"
echo ""
echo "  Test by visiting your app and logging in."
echo "============================================================"
