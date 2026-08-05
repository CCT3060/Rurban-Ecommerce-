#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Copy every Supabase Storage bucket + object from Cloud → self-hosted.
// Uses the Storage API on both sides (backend-agnostic: works whether the
// source/target store bytes on S3 or local disk).
//
// Env vars required:
//   SRC_URL, SRC_SERVICE_KEY   — Supabase Cloud project URL + service_role key
//   DST_URL, DST_SERVICE_KEY   — self-hosted URL (http://EC2:8000) + service key
//
// Cloud left untouched (read-only). Safe to re-run — uploads use upsert.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const { SRC_URL, SRC_SERVICE_KEY, DST_URL, DST_SERVICE_KEY } = process.env;

for (const [k, v] of Object.entries({ SRC_URL, SRC_SERVICE_KEY, DST_URL, DST_SERVICE_KEY })) {
  if (!v) {
    console.error(`ERROR: missing env var ${k}`);
    process.exit(1);
  }
}

const src = createClient(SRC_URL, SRC_SERVICE_KEY, { auth: { persistSession: false } });
const dst = createClient(DST_URL, DST_SERVICE_KEY, { auth: { persistSession: false } });

// Recursively list every object path within a bucket (Storage list is per-folder).
async function listAll(client, bucket, prefix = "") {
  const out = [];
  const pageSize = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A folder placeholder has no id/metadata; recurse into it.
      if (entry.id === null || entry.metadata == null) {
        out.push(...(await listAll(client, bucket, path)));
      } else {
        out.push(path);
      }
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

async function main() {
  const { data: buckets, error: bErr } = await src.storage.listBuckets();
  if (bErr) throw new Error(`listBuckets: ${bErr.message}`);
  if (!buckets?.length) {
    console.log("No buckets found on source. Nothing to migrate.");
    return;
  }

  let totalCopied = 0;
  let totalSkipped = 0;

  for (const bucket of buckets) {
    console.log(`\n=== Bucket: ${bucket.name} (public=${bucket.public}) ===`);

    // Ensure the bucket exists on the target with the same visibility/limits.
    const { error: createErr } = await dst.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.file_size_limit ?? undefined,
      allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      throw new Error(`createBucket ${bucket.name}: ${createErr.message}`);
    }

    const paths = await listAll(src, bucket.name);
    console.log(`  ${paths.length} object(s) to copy`);

    for (const path of paths) {
      const { data: file, error: dlErr } = await src.storage.from(bucket.name).download(path);
      if (dlErr) {
        console.warn(`  ! download failed ${path}: ${dlErr.message}`);
        totalSkipped++;
        continue;
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await dst.storage.from(bucket.name).upload(path, buffer, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      });
      if (upErr) {
        console.warn(`  ! upload failed ${path}: ${upErr.message}`);
        totalSkipped++;
        continue;
      }
      totalCopied++;
      if (totalCopied % 25 === 0) console.log(`  ...${totalCopied} copied`);
    }
  }

  console.log(`\n✓ Storage copy done. Copied: ${totalCopied}, Skipped: ${totalSkipped}`);
  if (totalSkipped > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error("Storage migration failed:", err.message);
  process.exit(1);
});
