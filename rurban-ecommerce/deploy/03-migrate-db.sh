#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Migrate the DATABASE from Supabase Cloud → self-hosted Supabase on EC2.
#
# All Postgres tooling runs INSIDE the supabase-db container (pg_dump/psql 17.6):
#   • cloud side  — the container reaches the IPv4 session pooler in the project's
#                   region (this EC2 box is IPv4-only; the direct host is IPv6-only)
#   • local side  — the container talks to its own Postgres over the unix socket
# This avoids host Postgres packaging and guarantees a matching dump/restore version.
#
# Migrates: public schema (DDL) + public data + auth.users/auth.identities,
# then re-creates the on_auth_user_created signup trigger. Storage is step 04.
#
# Safety: backs up the self-hosted DB first; Cloud is only read from; the app is
# NOT repointed here (cutover is step 05).
#
# Usage: bash 03-migrate-db.sh --db-password "YOUR_SUPABASE_CLOUD_DB_PASSWORD"
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CLOUD_DB_PASSWORD=""
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --db-password) CLOUD_DB_PASSWORD="${2:-}"; shift ;;
    *) echo "Unknown param: $1"; exit 1 ;;
  esac
  shift
done
if [[ -z "$CLOUD_DB_PASSWORD" ]]; then
  echo "ERROR: --db-password is required (Supabase Dashboard → Project Settings → Database)."
  exit 1
fi

SUPABASE_PROJECT_REF="fwxxjdvmchtonmiejjnu"
# IPv4 session-mode pooler for the project's region (ap-northeast-1 / Tokyo).
CLOUD_DB_HOST="aws-1-ap-northeast-1.pooler.supabase.com"
CLOUD_DB_PORT="5432"
CLOUD_DB_USER="postgres.${SUPABASE_PROJECT_REF}"
DB_CONTAINER="supabase-db"

DUMP_DIR="$HOME/rurban-deploy/dumps"
BACKUP_DIR="$HOME/rurban-deploy/backups"
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$DUMP_DIR" "$BACKUP_DIR"
DUMP_SCHEMA="$DUMP_DIR/cloud_public_schema.sql"
DUMP_PUBLIC_DATA="$DUMP_DIR/cloud_public_data.sql"
DUMP_AUTH_DATA="$DUMP_DIR/cloud_auth_data.sql"

DK="docker"; if ! docker info >/dev/null 2>&1; then DK="sudo docker"; fi
if ! $DK ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "ERROR: container ${DB_CONTAINER} is not running. Run 02b-setup-supabase-minimal.sh first."
  exit 1
fi

# Cloud pg_dump runs in the container (writes to its stdout → redirected to a host file).
cloud_dump() { $DK exec -e PGPASSWORD="$CLOUD_DB_PASSWORD" "$DB_CONTAINER" pg_dump -h "$CLOUD_DB_HOST" -p "$CLOUD_DB_PORT" -U "$CLOUD_DB_USER" -d postgres "$@"; }
# Local psql/pg_dump run in the container against its own DB (socket, trust auth).
lpsql() { $DK exec -i "$DB_CONTAINER" psql -U postgres -d postgres "$@"; }
lpg_dump() { $DK exec "$DB_CONTAINER" pg_dump -U postgres -d postgres "$@"; }

echo "=== Supabase Cloud → Self-hosted DB Migration ==="
echo "  Cloud:  ${CLOUD_DB_HOST}:${CLOUD_DB_PORT} (user ${CLOUD_DB_USER})"
echo "  Local:  docker exec ${DB_CONTAINER}"
echo ""

# ── [1/6] Verify cloud connectivity ───────────────────────────────────────────
echo "=== [1/6] Verifying cloud connectivity ==="
CLOUD_VER=$($DK exec -e PGPASSWORD="$CLOUD_DB_PASSWORD" "$DB_CONTAINER" psql -h "$CLOUD_DB_HOST" -p "$CLOUD_DB_PORT" -U "$CLOUD_DB_USER" -d postgres -tAc "show server_version;" 2>&1 | tr -d '[:space:]')
if ! [[ "$CLOUD_VER" =~ ^[0-9] ]]; then
  echo "ERROR: could not connect to the cloud DB via the pooler:"; echo "  $CLOUD_VER"; exit 1
fi
echo "✓ Connected. Cloud PostgreSQL ${CLOUD_VER}"

# ── [2/6] Back up the current self-hosted DB ──────────────────────────────────
echo ""
echo "=== [2/6] Backing up current self-hosted DB ==="
lpg_dump > "${BACKUP_DIR}/pre-migrate-${STAMP}.sql"
echo "✓ Backup: ${BACKUP_DIR}/pre-migrate-${STAMP}.sql"

# ── [3/6] Dump from cloud ─────────────────────────────────────────────────────
echo ""
echo "=== [3/6] Dumping from cloud (schema + data + auth) ==="
echo "  • public schema (DDL)..."
cloud_dump --schema=public --no-owner --no-acl --schema-only --lock-wait-timeout=30s > "$DUMP_SCHEMA"
echo "  • public data..."
cloud_dump --schema=public --no-owner --no-acl --data-only --disable-triggers --lock-wait-timeout=30s > "$DUMP_PUBLIC_DATA"
echo "  • auth.users + auth.identities..."
cloud_dump --no-owner --no-acl --data-only --disable-triggers --table=auth.users --table=auth.identities --lock-wait-timeout=30s > "$DUMP_AUTH_DATA"
echo "  dump sizes:"; du -h "$DUMP_SCHEMA" "$DUMP_PUBLIC_DATA" "$DUMP_AUTH_DATA" | sed 's/^/    /'

# ── [4/6] Restore into self-hosted (schema → auth → public) ───────────────────
echo ""
echo "=== [4/6] Restoring into self-hosted Supabase ==="
echo "  • public schema (DDL)..."
lpsql -v ON_ERROR_STOP=0 --quiet < "$DUMP_SCHEMA" 2>&1 | grep -viE '^(SET|--|$)|already exists' | tail -20 || true
echo "  • auth data (before profiles, for FK integrity)..."
lpsql -v ON_ERROR_STOP=0 --quiet < "$DUMP_AUTH_DATA" 2>&1 | grep -viE '^(SET|--|$)' | tail -20 || true
echo "  • public data..."
lpsql -v ON_ERROR_STOP=0 --quiet < "$DUMP_PUBLIC_DATA" 2>&1 | grep -viE '^(SET|--|$)' | tail -20 || true

# ── [5/6] Re-create the signup trigger on auth.users ──────────────────────────
echo ""
echo "=== [5/6] Re-creating on_auth_user_created signup trigger ==="
lpsql -v ON_ERROR_STOP=1 --quiet <<'SQL'
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
SQL
echo "✓ Trigger re-created"

# ── [6/6] Verify ──────────────────────────────────────────────────────────────
echo ""
echo "=== [6/6] Verifying migration ==="
echo -n "  auth.users count: "; lpsql -tAc "select count(*) from auth.users;"
echo "  Top public tables by row count:"
lpsql -c "SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC LIMIT 20;"

echo ""
echo "============================================================"
echo "✓ Database migration complete (Cloud untouched)."
echo "  Dumps kept in ${DUMP_DIR} (delete after verifying)."
echo "  Next: bash 04-migrate-storage.sh --cloud-url https://${SUPABASE_PROJECT_REF}.supabase.co --cloud-service-key \"<KEY>\""
echo "============================================================"
