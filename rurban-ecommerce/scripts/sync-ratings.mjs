/**
 * One-time script: recalculate avg_rating and review_count for all products
 * based on their approved reviews.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-ratings.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: reviews, error } = await supabase
  .from("reviews")
  .select("product_id, rating")
  .eq("status", "approved");

if (error) {
  console.error("Failed to fetch reviews:", error.message);
  process.exit(1);
}

// Group by product
const map = new Map();
for (const r of reviews ?? []) {
  if (!map.has(r.product_id)) map.set(r.product_id, []);
  map.get(r.product_id).push(r.rating);
}

let updated = 0;
for (const [productId, ratings] of map) {
  const count = ratings.length;
  const avg = ratings.reduce((s, v) => s + v, 0) / count;
  const { error: upErr } = await supabase
    .from("products")
    .update({ avg_rating: Math.round(avg * 100) / 100, review_count: count })
    .eq("id", productId);

  if (upErr) {
    console.error(`Failed to update product ${productId}:`, upErr.message);
  } else {
    console.log(`✓ Product ${productId} → avg=${avg.toFixed(2)} count=${count}`);
    updated++;
  }
}

// Also zero-out products with no approved reviews but non-zero cached values
const { data: allProducts } = await supabase
  .from("products")
  .select("id, avg_rating, review_count")
  .or("avg_rating.gt.0,review_count.gt.0");

for (const p of allProducts ?? []) {
  if (!map.has(p.id)) {
    await supabase
      .from("products")
      .update({ avg_rating: 0, review_count: 0 })
      .eq("id", p.id);
    console.log(`✓ Product ${p.id} → reset to 0 (no approved reviews)`);
    updated++;
  }
}

console.log(`\nDone. Updated ${updated} product(s).`);
