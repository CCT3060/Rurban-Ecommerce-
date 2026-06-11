-- Add validity date range to user_product_prices
-- start_date: price becomes active from this date (null = always active from creation)
-- end_date:   price expires after this date (null = no expiry)

ALTER TABLE user_product_prices
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

-- Index for date-based filtering
CREATE INDEX IF NOT EXISTS idx_user_product_prices_dates
  ON user_product_prices(start_date, end_date);
