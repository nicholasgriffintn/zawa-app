PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS operator_statuses (
  toc_code TEXT PRIMARY KEY,
  operator_thing_id TEXT NOT NULL,
  toc_name TEXT,
  status TEXT NOT NULL,
  status_description TEXT,
  status_image TEXT,
  twitter_account TEXT,
  additional_info TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (operator_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_operator_statuses_status
ON operator_statuses (status);

CREATE TABLE IF NOT EXISTS operator_disruptions (
  toc_code TEXT NOT NULL,
  operator_thing_id TEXT NOT NULL,
  disruption_id TEXT NOT NULL,
  disruption_thing_id TEXT NOT NULL,
  detail TEXT,
  url TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (toc_code, disruption_id),
  FOREIGN KEY (operator_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (disruption_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS network_incidents (
  incident_id TEXT PRIMARY KEY,
  incident_thing_id TEXT NOT NULL,
  version TEXT,
  planned INTEGER,
  priority INTEGER,
  summary TEXT,
  description_html TEXT,
  start_at TEXT,
  end_at TEXT,
  routes_affected_html TEXT,
  info_link_url TEXT,
  info_link_label TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (incident_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_network_incidents_active_priority
ON network_incidents (is_active, priority, updated_at);

CREATE TABLE IF NOT EXISTS network_incident_operators (
  incident_id TEXT NOT NULL,
  incident_thing_id TEXT NOT NULL,
  operator_code TEXT NOT NULL,
  operator_thing_id TEXT NOT NULL,
  operator_name TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (incident_id, operator_code),
  FOREIGN KEY (incident_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (operator_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS station_disruptions (
  station_key TEXT NOT NULL,
  station_thing_id TEXT NOT NULL,
  disruption_id TEXT NOT NULL,
  disruption_thing_id TEXT NOT NULL,
  generated_at TEXT,
  category TEXT,
  severity TEXT,
  description TEXT,
  message_html TEXT,
  is_suppressed INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (station_key, disruption_id),
  FOREIGN KEY (station_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (disruption_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_station_disruptions_active_station
ON station_disruptions (station_key, is_active, severity);

CREATE TABLE IF NOT EXISTS station_messages (
  station_key TEXT NOT NULL,
  station_thing_id TEXT NOT NULL,
  message_hash TEXT NOT NULL,
  message_thing_id TEXT NOT NULL,
  category TEXT,
  severity TEXT,
  message_html TEXT NOT NULL,
  generated_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (station_key, message_hash),
  FOREIGN KEY (station_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (message_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_station_messages_station
ON station_messages (station_key, updated_at);
