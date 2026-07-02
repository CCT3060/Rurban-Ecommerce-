-- Single-use invite token tracking.
-- Stores a SHA-256 hash of each consumed token so the same link cannot be reused.
-- Accessed exclusively via the service role (admin client).

CREATE TABLE IF NOT EXISTS invite_tokens_used (
  token_hash TEXT PRIMARY KEY,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS; deny all access by default — only the service role bypasses RLS.
ALTER TABLE invite_tokens_used ENABLE ROW LEVEL SECURITY;

-- Automatically purge tokens older than 30 days (well beyond the 7-day validity window).
-- Run via pg_cron or a maintenance job; this index makes the sweep fast.
CREATE INDEX IF NOT EXISTS idx_invite_tokens_used_at ON invite_tokens_used (used_at);
