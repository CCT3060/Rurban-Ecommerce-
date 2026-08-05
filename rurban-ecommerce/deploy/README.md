# Migrating Rurban off Supabase Cloud → self-hosted Supabase on AWS EC2

These scripts move the **database and storage** from the hosted Supabase
project (`fwxxjdvmchtonmiejjnu.supabase.co`) onto a self-hosted Supabase stack
running in Docker on the same EC2 instance that serves the Next.js app — so
everything lives on AWS.

**Supabase Cloud is only ever read from.** Nothing here modifies or deletes the
cloud project. Keep it alive as a fallback until the new stack is proven.

## Run order

Run on the EC2 box, from this `deploy/` directory, as `ec2-user`.

| # | Script | What it does | Notes |
|---|--------|--------------|-------|
| 1 | `01-setup-docker.sh` | Installs Docker + Compose | Log out/in afterwards (`newgrp docker`) |
| 2 | `02-setup-supabase.sh` | Brings up self-hosted Supabase, writes `~/supabase-keys.txt` | Open port **8000** in the EC2 security group |
| 3 | `03-migrate-db.sh --db-password "<CLOUD_DB_PASSWORD>"` | Copies public schema + data **and `auth.users`/`auth.identities`**, re-creates the signup trigger, backs up the local DB first | Cloud DB password: Dashboard → Project Settings → Database |
| 4 | `04-migrate-storage.sh --cloud-url https://<ref>.supabase.co --cloud-service-key "<KEY>"` | Copies all Storage bucket files, then rewrites image URLs in the DB to the new host | Service key: Dashboard → Project Settings → API → `service_role` |
| 5 | `05-update-app-env.sh` | **Cutover:** repoints `.env.local`, rebuilds, restarts PM2 | Prompts for confirmation; backs up `.env.local` |

Between step 4 and step 5, **verify**: log in with a real account, open the
admin dashboard, and confirm product images load from `http://<EC2_IP>:8000`.
Only then run step 5.

## Why the extra steps vs. a plain `pg_dump`

- **`auth.users` must be migrated**, or nobody can log in and `profiles`
  foreign keys fail. Admin/warehouse roles live in `auth.users` app metadata.
- **Storage files are not in Postgres.** Product/category images sit in Supabase
  Storage buckets; they're copied via the Storage API in step 4.
- **Image URLs are absolute** (`https://<ref>.supabase.co/storage/...`) in the
  DB, so step 4 also rewrites them to the self-hosted host.

## Rollback

- **App cutover:** restore the `.env.local.backup-*` file that step 5 created and
  re-run `npm run build && pm2 reload ecosystem.config.js --update-env`.
- **Local DB:** step 3 writes a pre-migration dump to
  `/opt/supabase/backups/pre-migrate-<timestamp>.sql`.
- Because the cloud project is untouched, the fastest rollback is simply pointing
  `.env.local` back at the cloud URL/keys.

## Known caveats

- **JWT secret changes.** All existing login sessions invalidate; users log in
  again. Passwords still work (bcrypt hashes travel with `auth.users`).
- **`auth` schema column drift.** If the cloud GoTrue version is newer than the
  self-hosted one, the `auth.users` data restore can warn on unknown columns.
  The verify step (test login) catches this while the cloud stays live.
- **Serving over plain HTTP on an IP.** Auth cookies/tokens are unencrypted in
  transit. Strongly consider putting nginx + a domain + Let's Encrypt in front
  before or soon after cutover.
- **The mobile app** (`rurban-app`) talks to the Next.js API, not Supabase
  directly, so it needs no change — but its `API_BASE` must keep pointing at the
  EC2 host.
