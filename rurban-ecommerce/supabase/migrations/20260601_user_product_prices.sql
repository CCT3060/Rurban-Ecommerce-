-- User-wise product pricing
-- Allows admins to set custom prices per user per product.
-- Custom price overrides sale_price/price when active.

CREATE TABLE IF NOT EXISTS user_product_prices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_price numeric(10,2) NOT NULL CHECK (custom_price >= 0),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_product_prices_unique UNIQUE (user_id, product_id)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_product_prices_user_id  ON user_product_prices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_prices_product_id ON user_product_prices(product_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_product_prices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_product_prices_updated_at
  BEFORE UPDATE ON user_product_prices
  FOR EACH ROW EXECUTE FUNCTION update_user_product_prices_updated_at();

-- RLS
ALTER TABLE user_product_prices ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins manage user_product_prices"
  ON user_product_prices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Users: read only their own records
CREATE POLICY "Users read own user_product_prices"
  ON user_product_prices FOR SELECT
  USING (user_id = auth.uid());
