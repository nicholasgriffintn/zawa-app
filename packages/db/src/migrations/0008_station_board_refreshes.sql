PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS station_board_refreshes (
  station_key TEXT NOT NULL,
  board_type TEXT NOT NULL CHECK (board_type IN ('departures', 'arrivals')),
  last_requested_at TEXT,
  last_refreshed_at TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (station_key, board_type),
  FOREIGN KEY (station_key) REFERENCES station_profiles (station_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_station_board_entries_refresh
ON station_board_entries (station_key, board_type, updated_at);
