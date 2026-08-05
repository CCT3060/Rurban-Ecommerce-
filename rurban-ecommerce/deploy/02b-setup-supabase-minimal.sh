#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 2 (minimal): Self-hosted Supabase trimmed to fit a 2 GB box.
# Brings up ONLY: db, kong, auth (gotrue), rest (postgrest), storage, imgproxy.
# Disabled: studio, meta, realtime, functions, analytics(logflare), vector, supavisor.
#
# Run AFTER Docker is installed. Usage: bash 02b-setup-supabase-minimal.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SUPABASE_DIR="/opt/supabase"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEEP_SERVICES="db kong auth rest storage imgproxy"

# Use sudo for docker unless the current shell is already in the docker group.
DK="docker"; if ! docker info >/dev/null 2>&1; then DK="sudo docker"; fi

echo "=== [1/7] Cloning Supabase self-hosted repo ==="
sudo mkdir -p "$SUPABASE_DIR"
sudo chown -R "$USER":"$USER" "$SUPABASE_DIR"
if [ ! -d "$SUPABASE_DIR/repo/.git" ]; then
  git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR/repo"
else
  (cd "$SUPABASE_DIR/repo" && git pull --ff-only || true)
fi
cd "$SUPABASE_DIR/repo/docker"

echo ""
echo "=== [2/7] Generating secrets ==="
JWT_SECRET=$(openssl rand -base64 40 | tr -d '\n=/' | head -c 40)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n=/+' | head -c 24)
DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -d '\n=/+' | head -c 16)

ISSUED_AT=$(date +%s)
EXPIRE_AT=2527977600  # 2050-01-01

generate_jwt() {
  local ROLE=$1
  local HEADER='{"alg":"HS256","typ":"JWT"}'
  local PAYLOAD="{\"role\":\"${ROLE}\",\"iss\":\"supabase\",\"iat\":${ISSUED_AT},\"exp\":${EXPIRE_AT}}"
  local HEADER_B64; HEADER_B64=$(printf '%s' "$HEADER" | openssl base64 -e | tr -d '=' | tr '+/' '-_' | tr -d '\n')
  local PAYLOAD_B64; PAYLOAD_B64=$(printf '%s' "$PAYLOAD" | openssl base64 -e | tr -d '=' | tr '+/' '-_' | tr -d '\n')
  local SIG; SIG=$(printf '%s' "${HEADER_B64}.${PAYLOAD_B64}" | openssl dgst -sha256 -hmac "${JWT_SECRET}" -binary | openssl base64 -e | tr -d '=' | tr '+/' '-_' | tr -d '\n')
  echo "${HEADER_B64}.${PAYLOAD_B64}.${SIG}"
}
ANON_KEY=$(generate_jwt "anon")
SERVICE_ROLE_KEY=$(generate_jwt "service_role")
echo "✓ Secrets generated"

echo ""
echo "=== [3/7] Writing .env ==="
cp .env.example .env
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)
EC2_PUBLIC_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")

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
# Existing users are already confirmed; without real SMTP, auto-confirm new signups
# so the login/signup flow keeps working on the self-hosted stack.
sed -i "s|ENABLE_EMAIL_AUTOCONFIRM=.*|ENABLE_EMAIL_AUTOCONFIRM=true|" .env
echo "✓ .env configured (public IP: ${EC2_PUBLIC_IP})"

echo ""
echo "=== [4/7] Pruning docker-compose.yml to minimal service set ==="
cp docker-compose.yml docker-compose.yml.full.bak
sudo dnf install -y python3-pyyaml >/dev/null 2>&1 || true
python3 "$SCRIPT_DIR/prune_compose.py" docker-compose.yml $KEEP_SERVICES

echo ""
echo "=== [5/7] Saving credentials to ~/supabase-keys.txt ==="
cat > "$HOME/supabase-keys.txt" <<EOF
# ── Self-hosted Supabase credentials (minimal stack) ──────────────────────────
EC2_PUBLIC_IP=${EC2_PUBLIC_IP}
NEXT_PUBLIC_SUPABASE_URL=http://${EC2_PUBLIC_IP}:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# PostgreSQL (internal): postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres
JWT_SECRET=${JWT_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF
chmod 600 "$HOME/supabase-keys.txt"
echo "✓ Saved to ~/supabase-keys.txt"

echo ""
echo "=== [6/7] Pulling images (kept services only) ==="
$DK compose pull

echo ""
echo "=== [7/7] Starting minimal Supabase ==="
$DK compose up -d
echo "Waiting for the REST API to answer via Kong (up to 5 min)..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8000/rest/v1/" -H "apikey: ${ANON_KEY}" >/dev/null 2>&1; then
    echo "✓ Supabase REST is up!"; break
  fi
  echo "  waiting... (${i}/30)"; sleep 10
done

echo ""
echo "============================================================"
echo "✓ Minimal self-hosted Supabase running at http://${EC2_PUBLIC_IP}:8000"
echo "  Containers:"
$DK compose ps --format "  {{.Name}}\t{{.State}}" 2>/dev/null || $DK compose ps
echo ""
echo "  Next: bash 03-migrate-db.sh --db-password \"<CLOUD_DB_PASSWORD>\""
echo "============================================================"
