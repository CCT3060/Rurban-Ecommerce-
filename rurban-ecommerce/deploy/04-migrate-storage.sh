#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Migrate Storage (images) from Supabase Cloud → self-hosted, then
#         rewrite the image URLs stored in the database to the new host.
# Run AFTER 03-migrate-db.sh.
#
# Usage:
#   bash 04-migrate-storage.sh \
#     --cloud-url        https://fwxxjdvmchtonmiejjnu.supabase.co \
#     --cloud-service-key "CLOUD_SERVICE_ROLE_KEY"
#
# Find the cloud service_role key in:
#   Supabase Dashboard → Project Settings → API → service_role (secret)
#
# The self-hosted URL + service key are read automatically from
# ~/supabase-keys.txt (written by 02-setup-supabase.sh).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CLOUD_URL=""
CLOUD_SERVICE_KEY=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --cloud-url) CLOUD_URL="${2:-}"; shift ;;
    --cloud-service-key) CLOUD_SERVICE_KEY="${2:-}"; shift ;;
    *) echo "Unknown param: $1"; exit 1 ;;
  esac
  shift
done

if [[ -z "$CLOUD_URL" || -z "$CLOUD_SERVICE_KEY" ]]; then
  echo "ERROR: --cloud-url and --cloud-service-key are required."
  echo "Usage: bash 04-migrate-storage.sh --cloud-url https://<ref>.supabase.co --cloud-service-key \"<key>\""
  exit 1
fi

KEYS_FILE="/home/ec2-user/supabase-keys.txt"
APP_DIR="/var/www/rurban-ecommerce"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$KEYS_FILE" ]]; then
  echo "ERROR: ${KEYS_FILE} not found. Run 02-setup-supabase.sh first."
  exit 1
fi

# Public URL (what browsers use) — this is what we write into the DB.
DST_PUBLIC_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$KEYS_FILE" | cut -d'=' -f2-)
DST_SERVICE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" "$KEYS_FILE" | cut -d'=' -f2-)
# The uploader runs ON the box; reach Kong on loopback (the public EIP:8000 is
# not hairpin-routable from the instance and may not be open in the SG yet).
DST_LOCAL_URL="http://127.0.0.1:8000"

DB_CONTAINER="supabase-db"
DK="docker"; if ! docker info >/dev/null 2>&1; then DK="sudo docker"; fi
lpsql() { $DK exec -i "$DB_CONTAINER" psql -U postgres -d postgres "$@"; }

# Derive bare hosts (strip scheme) for the DB URL rewrite step.
CLOUD_HOST=$(echo "$CLOUD_URL"        | sed -E 's#^https?://##; s#/.*$##')
DST_HOST=$(echo "$DST_PUBLIC_URL"     | sed -E 's#^https?://##; s#/.*$##')

echo "=== Storage migration: ${CLOUD_HOST} → ${DST_HOST} ==="

# ── [1/2] Copy all bucket objects (uses @supabase/supabase-js from the app) ────
echo ""
echo "=== [1/2] Copying storage objects ==="
# ESM resolves bare imports from the script file's own directory, so run a copy
# of the runner from inside APP_DIR where @supabase/supabase-js is installed.
RUNNER="${APP_DIR}/.rurban-migrate-storage.mjs"
cp "${SCRIPT_DIR}/04-migrate-storage.mjs" "$RUNNER"
trap 'rm -f "$RUNNER"' EXIT
( cd "$APP_DIR" && \
  SRC_URL="$CLOUD_URL"      SRC_SERVICE_KEY="$CLOUD_SERVICE_KEY" \
  DST_URL="$DST_LOCAL_URL"  DST_SERVICE_KEY="$DST_SERVICE_KEY" \
  node ".rurban-migrate-storage.mjs" )

# ── [2/2] Rewrite image URLs in the database ──────────────────────────────────
# Every text/varchar column in public that contains the old Supabase host is
# updated to point at the self-hosted host. Backend-agnostic and idempotent.
echo ""
echo "=== [2/2] Rewriting stored image URLs in the database ==="
lpsql -v ON_ERROR_STOP=1 -v old_host="$CLOUD_HOST" -v new_host="$DST_HOST" <<'SQL'
-- psql variables interpolate here (outside the dollar-quoted block) and are
-- stashed as session settings the DO block can read via current_setting().
select set_config('app.old_host', :'old_host', false);
select set_config('app.new_host', :'new_host', false);

do $$
declare
  r record;
  old_host text := current_setting('app.old_host');
  new_host text := current_setting('app.new_host');
  updated  bigint;
  total    bigint := 0;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text','character varying')
  loop
    -- Normalize to http:// on the new host (self-hosted serves plain HTTP on :8000).
    -- Handles https://old, http://old, and scheme-less old references.
    execute format(
      'update public.%I set %I = replace(replace(replace(%I, %L, %L), %L, %L), %L, %L) where %I like %L',
      r.table_name, r.column_name, r.column_name,
      'https://' || old_host, 'http://' || new_host,
      'http://'  || old_host, 'http://' || new_host,
      old_host,               'http://' || new_host,
      r.column_name, '%' || old_host || '%'
    );
    get diagnostics updated = row_count;
    if updated > 0 then
      raise notice '  % .% : % row(s) rewritten', r.table_name, r.column_name, updated;
      total := total + updated;
    end if;
  end loop;
  raise notice '✓ Total URL values rewritten: %', total;
end $$;
SQL

echo ""
echo "============================================================"
echo "✓ Storage migrated and DB image URLs rewritten to ${DST_HOST}."
echo ""
echo "  Verify a few product images load from the self-hosted host,"
echo "  then run: bash 05-update-app-env.sh"
echo "============================================================"
