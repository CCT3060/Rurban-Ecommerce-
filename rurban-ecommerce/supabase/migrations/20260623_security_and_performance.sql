-- ============================================================
-- Security & Performance Migration — 2026-06-23
-- ============================================================

-- ── 1. Increment coupon usage count atomically ──────────────
CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE id = coupon_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_used_count(uuid) TO service_role;

-- ── 2. Missing indexes for performance ──────────────────────

-- B2B customer details — joined on every customer fetch
CREATE INDEX IF NOT EXISTS idx_b2b_customer_details_user_id
  ON public.b2b_customer_details(user_id);

-- User-product custom prices — queried on every B2B checkout
CREATE INDEX IF NOT EXISTS idx_user_product_prices_user_product
  ON public.user_product_prices(user_id, product_id);

-- Order items — used in warehouse order queries & review prompts
CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items(product_id);

-- Reviews — checked on every order delivery review prompt
CREATE INDEX IF NOT EXISTS idx_reviews_user_product
  ON public.reviews(user_id, product_id);

-- Push token — looked up when sending order notifications
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
  ON public.profiles(push_token)
  WHERE push_token IS NOT NULL;

-- Orders by payment_status (used in financial reporting)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders(payment_status);

-- ── 3. Coupon status index ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coupons_status_code
  ON public.coupons(status, code);
