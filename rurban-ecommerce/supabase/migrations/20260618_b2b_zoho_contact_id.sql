-- Add zoho_contact_id column to b2b_customer_details
-- Stores the Zoho Books customer_id (preferred) or contact_id after a successful sync.

ALTER TABLE public.b2b_customer_details
  ADD COLUMN IF NOT EXISTS zoho_contact_id text;
