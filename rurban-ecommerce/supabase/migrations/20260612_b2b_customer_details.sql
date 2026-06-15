-- B2B Customer Details Table
-- Stores extended Zoho-style contact/address info for B2B users.

CREATE TABLE IF NOT EXISTS public.b2b_customer_details (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Identity
  display_name        text,
  customer_number     text,
  company_name        text,
  contact_name        text,

  -- Billing Address
  billing_attention   text,
  billing_address     text,
  billing_street2     text,
  billing_city        text,
  billing_state       text,
  billing_country     text DEFAULT 'India',
  billing_county      text,
  billing_phone       text,

  -- Shipping Address
  shipping_attention  text,
  shipping_address    text,
  shipping_street2    text,
  shipping_city       text,
  shipping_state      text,
  shipping_country    text DEFAULT 'India',
  shipping_code       text,
  shipping_phone      text,

  -- Tax / Payment
  payment_terms       text DEFAULT 'Advance Payment',
  gst_treatment       text DEFAULT 'Business - Registered',
  gstin               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT b2b_customer_details_user_id_key UNIQUE (user_id)
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_b2b_customer_details_user_id ON public.b2b_customer_details(user_id);

-- RLS: admins and warehouse_admins can manage; users can read own row
ALTER TABLE public.b2b_customer_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage b2b_customer_details"
  ON public.b2b_customer_details FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'warehouse_admin')
    )
  );

CREATE POLICY "Users read own b2b_customer_details"
  ON public.b2b_customer_details FOR SELECT
  USING (user_id = auth.uid());
