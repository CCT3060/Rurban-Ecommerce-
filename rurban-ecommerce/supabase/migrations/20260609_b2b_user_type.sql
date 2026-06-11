-- B2B / B2C user type support
-- Users created via admin or warehouse portal are B2B.
-- Users who self-register via the public signup page are B2C.

-- 1. Add user_type column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'b2c'
  CHECK (user_type IN ('b2c', 'b2b'));

-- 2. Mark existing B2B users (those with user_product_prices entries)
UPDATE public.profiles
  SET user_type = 'b2b'
  WHERE id IN (SELECT DISTINCT user_id FROM public.user_product_prices);

-- 3. Update handle_new_user trigger to always set user_type = 'b2c' for self-signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    'b2c'
  );
  RETURN NEW;
END;
$$;

-- 4. Update prevent_profile_privilege_changes to also block user_type self-changes
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.id THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Role changes are not allowed for self updates';
    END IF;
    IF OLD.warehouse_id IS DISTINCT FROM NEW.warehouse_id THEN
      RAISE EXCEPTION 'Warehouse assignment changes are not allowed for self updates';
    END IF;
    IF OLD.user_type IS DISTINCT FROM NEW.user_type THEN
      RAISE EXCEPTION 'User type changes are not allowed for self updates';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Allow warehouse_admin to manage user_product_prices RLS (add warehouse scope)
-- Warehouse admins can only see prices for users in their warehouse
DROP POLICY IF EXISTS "Warehouse admins manage user_product_prices" ON public.user_product_prices;

CREATE POLICY "Warehouse admins manage user_product_prices"
  ON public.user_product_prices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'warehouse_admin'
        AND profiles.warehouse_id = (
          SELECT warehouse_id FROM public.profiles WHERE id = user_product_prices.user_id LIMIT 1
        )
    )
  );
