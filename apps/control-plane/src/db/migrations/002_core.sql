CREATE TABLE IF NOT EXISTS app_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  title text,
  context jsonb,
  queue_paused_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_updated_created_idx
  ON sessions (updated_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  status text NOT NULL,
  prompt text NOT NULL,
  source text,
  context jsonb,
  author_user_id uuid REFERENCES auth_users(id) ON DELETE SET NULL,
  author_name text,
  created_at timestamptz NOT NULL,
  UNIQUE (session_id, sequence)
);

CREATE INDEX IF NOT EXISTS messages_session_sequence_idx ON messages(session_id, sequence);
CREATE INDEX IF NOT EXISTS messages_pending_created_sequence_idx
  ON messages (created_at ASC, sequence ASC, session_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS messages_session_pending_idx
  ON messages (session_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  run_id uuid,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  sequence bigint NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  UNIQUE (session_id, sequence)
);

CREATE INDEX IF NOT EXISTS events_session_sequence_idx ON events(session_id, sequence);

CREATE TABLE IF NOT EXISTS session_sequence_counters (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  next_sequence bigint NOT NULL,
  PRIMARY KEY (session_id, kind)
);

CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  status text NOT NULL,
  runner_type text NOT NULL,
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  attempt integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  failed_at timestamptz,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS runs_one_active_per_session_idx
  ON runs(session_id)
  WHERE status IN ('starting', 'running', 'cancelling');
CREATE INDEX IF NOT EXISTS runs_message_idx ON runs(message_id);
CREATE INDEX IF NOT EXISTS runs_lease_idx ON runs(status, lease_expires_at);
