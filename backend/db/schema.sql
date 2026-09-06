-- Smart Market Watchlist schema
-- Postgres is the source of truth for anything relational.
-- Redis is only used for the hot-path (latest price cache + pub/sub), never as source of truth.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlists (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);

-- Seed data only. baseline_volatility is not user-editable via any API route.
CREATE TABLE IF NOT EXISTS instruments (
  id                 SERIAL PRIMARY KEY,
  symbol             TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  baseline_volatility NUMERIC NOT NULL CHECK (baseline_volatility > 0)
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id            SERIAL PRIMARY KEY,
  watchlist_id  INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, instrument_id)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);

-- Per-user, per-instrument "what did they last actually see" snapshot.
-- Updated ONLY by POST /api/watchlists/:id/view, never by ticks/polls.
CREATE TABLE IF NOT EXISTS user_last_seen_snapshots (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument_id    INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  last_seen_price  NUMERIC NOT NULL,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, instrument_id)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON user_last_seen_snapshots(user_id);
