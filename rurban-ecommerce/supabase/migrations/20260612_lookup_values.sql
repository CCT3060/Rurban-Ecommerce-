-- Lookup Values Master Table
-- Stores admin-managed lists like states, payment terms, GST treatments, etc.

CREATE TABLE IF NOT EXISTS public.lookup_values (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL,          -- e.g. 'indian_state', 'payment_term', 'gst_treatment'
  value      text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lookup_values_type_value_key UNIQUE (type, value)
);

CREATE INDEX IF NOT EXISTS idx_lookup_values_type ON public.lookup_values(type, sort_order);

-- RLS: admins can manage; everyone can read active values
ALTER TABLE public.lookup_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage lookup_values"
  ON public.lookup_values FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'warehouse_admin')
    )
  );

CREATE POLICY "Anyone can read active lookup_values"
  ON public.lookup_values FOR SELECT
  USING (is_active = true);

-- ── Seed: Indian States ──────────────────────────────────────────────────────
INSERT INTO public.lookup_values (type, value, sort_order) VALUES
  ('indian_state', 'Andhra Pradesh', 1),
  ('indian_state', 'Arunachal Pradesh', 2),
  ('indian_state', 'Assam', 3),
  ('indian_state', 'Bihar', 4),
  ('indian_state', 'Chhattisgarh', 5),
  ('indian_state', 'Goa', 6),
  ('indian_state', 'Gujarat', 7),
  ('indian_state', 'Haryana', 8),
  ('indian_state', 'Himachal Pradesh', 9),
  ('indian_state', 'Jharkhand', 10),
  ('indian_state', 'Karnataka', 11),
  ('indian_state', 'Kerala', 12),
  ('indian_state', 'Madhya Pradesh', 13),
  ('indian_state', 'Maharashtra', 14),
  ('indian_state', 'Manipur', 15),
  ('indian_state', 'Meghalaya', 16),
  ('indian_state', 'Mizoram', 17),
  ('indian_state', 'Nagaland', 18),
  ('indian_state', 'Odisha', 19),
  ('indian_state', 'Punjab', 20),
  ('indian_state', 'Rajasthan', 21),
  ('indian_state', 'Sikkim', 22),
  ('indian_state', 'Tamil Nadu', 23),
  ('indian_state', 'Telangana', 24),
  ('indian_state', 'Tripura', 25),
  ('indian_state', 'Uttar Pradesh', 26),
  ('indian_state', 'Uttarakhand', 27),
  ('indian_state', 'West Bengal', 28),
  ('indian_state', 'Andaman and Nicobar Islands', 29),
  ('indian_state', 'Chandigarh', 30),
  ('indian_state', 'Dadra and Nagar Haveli and Daman and Diu', 31),
  ('indian_state', 'Delhi', 32),
  ('indian_state', 'Jammu and Kashmir', 33),
  ('indian_state', 'Ladakh', 34),
  ('indian_state', 'Lakshadweep', 35),
  ('indian_state', 'Puducherry', 36)
ON CONFLICT (type, value) DO NOTHING;

-- ── Seed: Payment Terms ──────────────────────────────────────────────────────
INSERT INTO public.lookup_values (type, value, sort_order) VALUES
  ('payment_term', 'Advance Payment', 1),
  ('payment_term', 'Net 7', 2),
  ('payment_term', 'Net 15', 3),
  ('payment_term', 'Net 30', 4),
  ('payment_term', 'Net 45', 5),
  ('payment_term', 'Net 60', 6),
  ('payment_term', 'Due on Receipt', 7)
ON CONFLICT (type, value) DO NOTHING;

-- ── Seed: GST Treatments ─────────────────────────────────────────────────────
INSERT INTO public.lookup_values (type, value, sort_order) VALUES
  ('gst_treatment', 'Business - Registered', 1),
  ('gst_treatment', 'Business - Unregistered', 2),
  ('gst_treatment', 'Consumer', 3),
  ('gst_treatment', 'Overseas', 4),
  ('gst_treatment', 'Special Economic Zone', 5),
  ('gst_treatment', 'Deemed Export', 6)
ON CONFLICT (type, value) DO NOTHING;
