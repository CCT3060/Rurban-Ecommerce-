-- Add extended Zoho Books fields to products table
-- These are populated during sync to store all item details from Zoho

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_or_sac        text,
  ADD COLUMN IF NOT EXISTS product_type      text,
  ADD COLUMN IF NOT EXISTS zoho_category_name text,
  ADD COLUMN IF NOT EXISTS intra_state_tax_name text,
  ADD COLUMN IF NOT EXISTS intra_state_tax_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS intra_state_tax_type text,
  ADD COLUMN IF NOT EXISTS inter_state_tax_name text,
  ADD COLUMN IF NOT EXISTS inter_state_tax_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS zoho_unit          text,
  ADD COLUMN IF NOT EXISTS zoho_item_type     text;
