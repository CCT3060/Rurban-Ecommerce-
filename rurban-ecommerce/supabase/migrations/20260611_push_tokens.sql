-- Add push notification token storage to profiles
-- Stores the Expo push token per user so the server can send targeted push notifications.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token text;

-- Index for fast lookups when notifying warehouse admins
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON public.profiles(push_token)
  WHERE push_token IS NOT NULL;
