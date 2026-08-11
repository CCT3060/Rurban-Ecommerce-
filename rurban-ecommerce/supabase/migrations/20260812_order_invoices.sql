-- Invoice workflow: track the Zoho Books invoice created against an order's
-- Sales Order, the stored invoice PDF, and the customer's signed-and-uploaded copy.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS zoho_invoice_id            text,
  ADD COLUMN IF NOT EXISTS zoho_invoice_number        text,
  ADD COLUMN IF NOT EXISTS zoho_invoice_status        text,
  ADD COLUMN IF NOT EXISTS invoice_pdf_path           text,        -- path in the 'invoices' bucket
  ADD COLUMN IF NOT EXISTS invoice_synced_at          timestamptz,
  ADD COLUMN IF NOT EXISTS signed_invoice_path        text,        -- path in the 'signed-invoices' bucket
  ADD COLUMN IF NOT EXISTS signed_invoice_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_invoice_status      text;        -- 'uploaded' | 'approved'

CREATE INDEX IF NOT EXISTS idx_orders_zoho_invoice_id
  ON orders (zoho_invoice_id)
  WHERE zoho_invoice_id IS NOT NULL;

-- Private storage buckets. Files are served only via short-lived signed URLs
-- minted by our API after an ownership/role check — never public.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('invoices', 'invoices', false),
  ('signed-invoices', 'signed-invoices', false)
ON CONFLICT (id) DO NOTHING;
