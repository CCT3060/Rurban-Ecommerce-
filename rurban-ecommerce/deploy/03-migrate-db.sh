#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Migrate data from Supabase Cloud → self-hosted Supabase on EC2.
# Run AFTER 02-setup-supabase.sh has completed successfully.
#
# Usage:
#   bash 03-migrate-db.sh \
#     --db-password "YOUR_SUPABASE_CLOUD_DB_PASSWORD"
#
# Find your cloud DB password in:
#   Supabase Dashboard → Project Settings → Database → Database password
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── Parse arguments ───────────────────────────────────────────────────────────
CLOUD_DB_PASSWORD=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --db-password) CLOUD_DB_PASSWORD="$2"; shift ;;
    *) echo "Unknown param: $1"; exit 1 ;;
  esac
  shift
done

if [[ -z "$CLOUD_DB_PASSWORD" ]]; then
  echo ""
  echo "ERROR: --db-password is required."
  echo "Find it in: Supabase Dashboard → Project Settings → Database → Database password"
  echo ""
  echo "Usage: bash 03-migrate-db.sh --db-password \"your_password_here\""
  exit 1
fi

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_PROJECT_REF="fwxxjdvmchtonmiejjnu"
CLOUD_DB_HOST="db.${SUPABASE_PROJECT_REF}.supabase.co"
CLOUD_DB_URL="postgresql://postgres:${CLOUD_DB_PASSWORD}@${CLOUD_DB_HOST}:5432/postgres"

# Read local Postgres password from Supabase self-hosted .env
LOCAL_ENV_FILE="/opt/supabase/repo/docker/.env"
if [[ ! -f "$LOCAL_ENV_FILE" ]]; then
  echo "ERROR: $LOCAL_ENV_FILE not found. Run 02-setup-supabase.sh first."
  exit 1
fi
LOCAL_POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$LOCAL_ENV_FILE" | cut -d'=' -f2-)
LOCAL_DB_URL="postgresql://postgres:${LOCAL_POSTGRES_PASSWORD}@127.0.0.1:5432/postgres"

DUMP_FILE="/tmp/supabase_cloud_dump.sql"
DUMP_FILE_DATA="/tmp/supabase_cloud_data.sql"

echo "=== Supabase Cloud → Self-hosted Migration ==="
echo "  Cloud host: ${CLOUD_DB_HOST}"
echo "  Local host: 127.0.0.1:5432"
echo ""

echo "=== [1/4] Checking pg_dump availability ==="
if ! command -v pg_dump &> /dev/null; then
  echo "Installing postgresql client..."
  sudo dnf install -y postgresql15
fi
echo "✓ pg_dump: $(pg_dump --version)"

echo ""
echo "=== [2/4] Dumping schema from Supabase cloud ==="
echo "  (this may take a few minutes...)"
PGPASSWORD="${CLOUD_DB_PASSWORD}" pg_dump \
  --host="${CLOUD_DB_HOST}" \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema=public \
  --schema=auth \
  --no-owner \
  --no-acl \
  --schema-only \
  --file="${DUMP_FILE}" \
  --lock-wait-timeout=30s
echo "✓ Schema dumped to ${DUMP_FILE}"

echo ""
echo "=== [3/4] Dumping data from Supabase cloud ==="
PGPASSWORD="${CLOUD_DB_PASSWORD}" pg_dump \
  --host="${CLOUD_DB_HOST}" \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema=public \
  --no-owner \
  --no-acl \
  --data-only \
  --disable-triggers \
  --file="${DUMP_FILE_DATA}" \
  --lock-wait-timeout=30s
echo "✓ Data dumped to ${DUMP_FILE_DATA}"

echo ""
echo "=== [4/4] Restoring to self-hosted Supabase ==="
echo "  Restoring schema..."
PGPASSWORD="${LOCAL_POSTGRES_PASSWORD}" psql \
  --host=127.0.0.1 \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --file="${DUMP_FILE}" \
  --quiet 2>&1 | grep -v "^SET\|^--\|already exists" || true

echo "  Restoring data..."
PGPASSWORD="${LOCAL_POSTGRES_PASSWORD}" psql \
  --host=127.0.0.1 \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --file="${DUMP_FILE_DATA}" \
  --quiet 2>&1 | grep -v "^SET\|^--" || true

echo "✓ Migration complete!"

echo ""
echo "=== Verifying row counts ==="
PGPASSWORD="${LOCAL_POSTGRES_PASSWORD}" psql \
  --host=127.0.0.1 \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --command="SELECT schemaname, tablename, n_live_tup AS rows FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC LIMIT 15;"

echo ""
echo "=== Cleaning up temp files ==="
rm -f "${DUMP_FILE}" "${DUMP_FILE_DATA}"

echo ""
echo "============================================================"
echo "✓ Database migration complete!"
echo ""
echo "  Next steps:"
echo "  1. Update /var/www/rurban-ecommerce/.env.local"
echo "     with the values from ~/supabase-keys.txt"
echo "  2. Rebuild and restart the app:"
echo "     cd /var/www/rurban-ecommerce"
echo "     npm run build"
echo "     pm2 reload ecosystem.config.js --update-env"
echo "============================================================"
