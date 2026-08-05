#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 5: Cut the Next.js app over to self-hosted Supabase.
# Run LAST — only after 03 (DB) and 04 (storage) succeeded AND you have
# verified the new stack (row counts look right, a test login works, images
# load from the EC2 host).
# Usage: bash 05-update-app-env.sh          (prompts for confirmation)
#        bash 05-update-app-env.sh --yes    (skip the prompt)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ASSUME_YES="no"
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --yes|-y) ASSUME_YES="yes" ;;
    *) echo "Unknown param: $1"; exit 1 ;;
  esac
  shift
done

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

# ── Confirmation gate — this is the point of no (easy) return ──────────────────
if [[ "$ASSUME_YES" != "yes" ]]; then
  echo ""
  echo "This will repoint the LIVE app at the self-hosted Supabase and rebuild it."
  echo "Confirm you have already:"
  echo "  • run 03-migrate-db.sh and 04-migrate-storage.sh successfully"
  echo "  • verified a test login and that images load from ${NEW_URL}"
  read -r -p "Proceed with cutover? [y/N] " REPLY
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "Aborted. App still points at Supabase Cloud."
    exit 0
  fi
fi

echo ""
echo "=== Updating .env.local ==="
ENV_FILE="${APP_DIR}/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: ${ENV_FILE} not found."
  exit 1
fi

# Back up existing env so cutover is reversible.
cp "$ENV_FILE" "${ENV_FILE}.backup-$(date +%Y%m%d_%H%M%S)"

sed -i "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=${NEW_URL}|" "$ENV_FILE"
sed -i "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEW_ANON_KEY}|" "$ENV_FILE"
sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${NEW_SERVICE_KEY}|" "$ENV_FILE"

TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)
EC2_PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")
sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=http://${EC2_PUBLIC_IP}|" "$ENV_FILE"
sed -i "s|NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=http://${EC2_PUBLIC_IP}|" "$ENV_FILE"
echo "✓ .env.local updated (backup kept alongside)"

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
echo "  Rollback: restore the .env.local.backup-* file and re-run 'npm run build'."
echo "  Keep the Supabase Cloud project alive for a few days as a fallback."
echo "============================================================"
