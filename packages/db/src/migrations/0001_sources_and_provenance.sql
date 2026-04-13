PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rail_sources (
  source_key TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO rail_sources (source_key, source_name, provider, description, updated_at)
VALUES
  ('rdm', 'Rail Data Marketplace', 'Rail Data Marketplace', 'Rail reference, knowledgebase, LDB, realtime and movement feeds.', '1970-01-01T00:00:00.000Z'),
  ('internal', 'Internal projection pipeline', 'zawa', 'Derived state produced inside the zawa Workers.', '1970-01-01T00:00:00.000Z')
ON CONFLICT(source_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS source_sync_runs (
  source_key TEXT NOT NULL,
  sync_key TEXT NOT NULL,
  source_version TEXT,
  status TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  cursor TEXT,
  last_checked_at TEXT NOT NULL,
  last_changed_at TEXT,
  error_message TEXT,
  PRIMARY KEY (source_key, sync_key),
  FOREIGN KEY (source_key) REFERENCES rail_sources (source_key) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_source_sync_runs_checked
ON source_sync_runs (last_checked_at DESC);

CREATE TABLE IF NOT EXISTS projection_claims (
  event_id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_feeds (
  feed_name TEXT PRIMARY KEY,
  connection_started_at TEXT,
  last_message_at TEXT,
  last_event_id TEXT,
  reconnect_count INTEGER NOT NULL DEFAULT 0,
  health_state TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
