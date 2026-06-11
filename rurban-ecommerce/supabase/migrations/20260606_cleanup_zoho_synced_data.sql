-- ============================================================
-- CLEANUP: Delete all Zoho-synced products and orphan categories
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Delete product images belonging to Zoho-synced products
DELETE FROM public.product_images
WHERE product_id IN (
  SELECT id FROM public.products WHERE zoho_item_id IS NOT NULL
);

-- 2. Delete product variants belonging to Zoho-synced products
DELETE FROM public.product_variants
WHERE product_id IN (
  SELECT id FROM public.products WHERE zoho_item_id IS NOT NULL
);

-- 3. Delete user_product_prices referencing Zoho-synced products
DELETE FROM public.user_product_prices
WHERE product_id IN (
  SELECT id FROM public.products WHERE zoho_item_id IS NOT NULL
);

-- 4. Delete the Zoho-synced products themselves
DELETE FROM public.products
WHERE zoho_item_id IS NOT NULL;

-- 5. Delete categories that were auto-created by the sync
--    (they have no parent, no manually-added sub-categories, and zero products)
DELETE FROM public.categories
WHERE id NOT IN (
  SELECT DISTINCT category_id FROM public.products WHERE category_id IS NOT NULL
)
AND parent_id IS NULL
AND id NOT IN (
  SELECT DISTINCT parent_id FROM public.categories WHERE parent_id IS NOT NULL
);
