#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Install and start self-hosted Supabase via Docker Compose.
# Run AFTER 01-setup-docker.sh and after logging back in.
# Usage: bash 02-setup-supabase.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

SUPABASE_DIR="/opt/supabase"

echo "=== [1/6] Cloning Supabase self-hosted repo ==="
sudo mkdir -p "$SUPABASE_DIR"
sudo chown -R ec2-user:ec2-user "$SUPABASE_DIR"
git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR/repo" 2>/dev/null || \
  (cd "$SUPABASE_DIR/repo" && git pull)
cd "$SUPABASE_DIR/repo/docker"

echo ""
echo "=== [2/6] Generating secrets ==="
JWT_SECRET=$(openssl rand -base64 40 | tr -d '\n=/' | head -c 40)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n=/+' | head -c 24)
DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -d '\n=/+' | head -c 16)

# Generate ANON and SERVICE_ROLE JWT tokens (HS256, expire year 2050)
ISSUED_AT=$(date +%s)
EXPIRE_AT=2527977600  # 2050-01-01

generate_jwt() {
  local ROLE=$1
  local HEADER='{"alg":"HS256","typ":"JWT"}'
  local PAYLOAD="{\"role\":\"${ROLE}\",\"iss\":\"supabase\",\"iat\":${ISSUED_AT},\"exp\":${EXPIRE_AT}}"

  local HEADER_B64
  HEADER_B64=$(echo -n "$HEADER" | openssl base64 -e | tr -d '=' | tr '+/' '-_' | tr -d '\n')
  local PAYLOAD_B64
  PAYLOAD_B64=$(echo -n "$PAYLOAD" | openssl base64 -e | tr -d '=' | tr '+/' '-_' | tr -d '\n')

  local SIG
  SIG=$(echo -n "${HEADER_B64}.${PAYLOAD_B64}" | \
    openssl dgst -sha256 -hmac "${JWT_SECRET}" -binary | \
    openssl base64 -e | tr -d '=' | tr '+/' '-_' | tr -d '\n')

  echo "${HEADER_B64}.${PAYLOAD_B64}.${SIG}"
}

ANON_KEY=$(generate_jwt "anon")
SERVICE_ROLE_KEY=$(generate_jwt "service_role")

echo "✓ Secrets generated"

echo ""
echo "=== [3/6] Writing .env file ==="
cp .env.example .env

# Get the public IP of this EC2
EC2_PUBLIC_IP=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")

sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
sed -i "s|ANON_KEY=.*|ANON_KEY=${ANON_KEY}|" .env
sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}|" .env
sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=http://${EC2_PUBLIC_IP}:8000|" .env
sed -i "s|SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=http://${EC2_PUBLIC_IP}:8000|" .env
sed -i "s|SITE_URL=.*|SITE_URL=http://${EC2_PUBLIC_IP}|" .env
sed -i "s|ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=http://${EC2_PUBLIC_IP}|" .env
sed -i "s|DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=admin|" .env
sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}|" .env

# Change Studio port from 3000 → 3001 (avoid conflict with Next.js on 3000)
sed -i "s|STUDIO_PORT=3000|STUDIO_PORT=3001|" .env
# Also patch the docker-compose.yml if STUDIO_PORT isn't in .env
sed -i 's/"3000:3000"/"3001:3000"/' docker-compose.yml 2>/dev/null || true

echo "✓ .env configured (EC2 IP: ${EC2_PUBLIC_IP})"

echo ""
echo "=== [4/6] Saving keys to /home/ec2-user/supabase-keys.txt ==="
cat > /home/ec2-user/supabase-keys.txt <<EOF
# ── Self-hosted Supabase credentials ──────────────────────────────────────────
# KEEP THIS FILE SAFE. Update rurban-ecommerce/.env.local with these values.

EC2_PUBLIC_IP=${EC2_PUBLIC_IP}
NEXT_PUBLIC_SUPABASE_URL=http://${EC2_PUBLIC_IP}:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# Supabase Studio: http://${EC2_PUBLIC_IP}:3001
# Studio login:  admin / ${DASHBOARD_PASSWORD}

# PostgreSQL direct connection (internal only):
# postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres

JWT_SECRET=${JWT_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF
chmod 600 /home/ec2-user/supabase-keys.txt
echo "✓ Keys saved to ~/supabase-keys.txt"

echo ""
echo "=== [5/6] Pulling Docker images (this takes ~5 minutes) ==="
docker compose pull

echo ""
echo "=== [6/6] Starting Supabase ==="
docker compose up -d

echo ""
echo "Waiting for Supabase to become healthy..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8000/rest/v1/" -H "apikey: ${ANON_KEY}" > /dev/null 2>&1; then
    echo "✓ Supabase is up!"
    break
  fi
  echo "  Waiting... (${i}/30)"
  sleep 10
done

echo ""
echo "============================================================"
echo "✓ Self-hosted Supabase is running!"
echo ""
echo "  API URL:      http://${EC2_PUBLIC_IP}:8000"
echo "  Studio URL:   http://${EC2_PUBLIC_IP}:3001  (admin / ${DASHBOARD_PASSWORD})"
echo ""
echo "  Next steps:"
echo "  1. Open port 8000 in your EC2 Security Group"
echo "  2. Run: bash 03-migrate-db.sh  (to copy data from Supabase cloud)"
echo "  3. Update /var/www/rurban-ecommerce/.env.local (see ~/supabase-keys.txt)"
echo "  4. Run: cd /var/www/rurban-ecommerce && npm run build && pm2 reload ecosystem.config.js"
echo "============================================================"
