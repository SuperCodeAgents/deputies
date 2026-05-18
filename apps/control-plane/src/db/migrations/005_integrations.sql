CREATE TABLE IF NOT EXISTS webhook_sources (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  bearer_token text NOT NULL,
  prompt_prefix text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS external_threads (
  id uuid PRIMARY KEY,
  source text NOT NULL,
  external_id text NOT NULL,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id uuid PRIMARY KEY,
  source text NOT NULL,
  dedupe_key text NOT NULL,
  status text NOT NULL,
  received_at timestamptz NOT NULL,
  processed_at timestamptz,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source, dedupe_key)
);

CREATE TABLE IF NOT EXISTS callback_deliveries (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS callback_deliveries_session_created_idx ON callback_deliveries (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS callback_deliveries_status_created_idx ON callback_deliveries (status, created_at);
CREATE INDEX IF NOT EXISTS callback_deliveries_due_idx
  ON callback_deliveries (next_attempt_at, created_at)
  WHERE status = 'pending';
