-- Add tax / HSN fields to order_items so they are captured at order time
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS hsn_or_sac            text,
  ADD COLUMN IF NOT EXISTS intra_state_tax_rate   numeric(10,2),
  ADD COLUMN IF NOT EXISTS inter_state_tax_rate   numeric(10,2),
  ADD COLUMN IF NOT EXISTS zoho_unit              text;
