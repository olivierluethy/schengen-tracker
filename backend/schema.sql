-- Schengen Tracker — SQLite schema.
-- Column types are deliberately conservative so the MySQL port is a 1:1 mapping.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);

CREATE TABLE IF NOT EXISTS stays (
  id         TEXT PRIMARY KEY,          -- client-generated UUID
  owner_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  country    TEXT,
  start_date TEXT NOT NULL,             -- YYYY-MM-DD
  end_date   TEXT NOT NULL,             -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,             -- drives last-write-wins
  deleted    INTEGER NOT NULL DEFAULT 0,
  seq        INTEGER NOT NULL,          -- monotonic server cursor, clock-skew proof
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_stays_owner_seq ON stays(owner_id, seq);

CREATE TABLE IF NOT EXISTS partnerships (
  id            TEXT PRIMARY KEY,
  from_user_id  TEXT NOT NULL,
  to_email      TEXT NOT NULL,
  to_user_id    TEXT,                   -- NULL until accepted
  status        TEXT NOT NULL,          -- pending | accepted | declined | revoked
  sharing_level TEXT NOT NULL,          -- graph_only | full
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY (from_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_partnerships_from ON partnerships(from_user_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_to ON partnerships(to_user_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_email ON partnerships(to_email);
