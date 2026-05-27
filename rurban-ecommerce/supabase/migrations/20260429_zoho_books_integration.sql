-- ============================================================
-- Migration: Add Zoho Books integration columns to products
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add zoho_item_id column (Zoho's internal item identifier)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS zoho_item_id text UNIQUE;

-- 2. Add timestamp of last successful sync from Zoho
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS zoho_synced_at timestamptz;

-- Index for fast lookup by Zoho item ID during upsert
CREATE INDEX IF NOT EXISTS idx_products_zoho_item_id
  ON public.products(zoho_item_id)
  WHERE zoho_item_id IS NOT NULL;

-- ============================================================
-- The settings table already exists (used by the admin panel).
-- The sync service stores its last result there automatically
-- using the key 'zoho_last_sync_result'.
-- No schema change needed for settings.
-- ============================================================
