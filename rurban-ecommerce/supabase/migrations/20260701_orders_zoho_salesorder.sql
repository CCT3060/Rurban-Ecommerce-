-- Track Zoho Books Sales Order ID on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS zoho_salesorder_id   text,
  ADD COLUMN IF NOT EXISTS zoho_salesorder_number text;

CREATE INDEX IF NOT EXISTS idx_orders_zoho_salesorder_id
  ON orders (zoho_salesorder_id)
  WHERE zoho_salesorder_id IS NOT NULL;
