PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS service_journeys (
  service_key TEXT PRIMARY KEY,
  service_thing_id TEXT NOT NULL,
  train_run_key TEXT,
  train_run_thing_id TEXT,
  rid TEXT,
  uid TEXT,
  train_id TEXT,
  rsid TEXT,
  operator_code TEXT,
  operator_thing_id TEXT,
  origin_name TEXT,
  destination_name TEXT,
  service_type TEXT,
  category TEXT,
  activities TEXT,
  service_length INTEGER,
  is_passenger_service INTEGER,
  is_charter INTEGER,
  is_reverse_formation INTEGER,
  detach_front INTEGER,
  scheduled_start_ts TEXT,
  expected_start_ts TEXT,
  status TEXT NOT NULL,
  delay_minutes INTEGER,
  cancellation_reason TEXT,
  last_event_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (service_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (train_run_thing_id) REFERENCES things (thing_id) ON DELETE SET NULL,
  FOREIGN KEY (operator_thing_id) REFERENCES things (thing_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_journeys_train_run
ON service_journeys (train_run_key);

CREATE TABLE IF NOT EXISTS service_call_points (
  service_key TEXT NOT NULL,
  service_thing_id TEXT NOT NULL,
  stop_index INTEGER NOT NULL,
  station_key TEXT NOT NULL,
  station_thing_id TEXT NOT NULL,
  station_name TEXT,
  tiploc TEXT,
  scheduled_arrival_ts TEXT,
  expected_arrival_ts TEXT,
  actual_arrival_ts TEXT,
  scheduled_departure_ts TEXT,
  expected_departure_ts TEXT,
  actual_departure_ts TEXT,
  arrival_type TEXT,
  arrival_source TEXT,
  arrival_source_instance TEXT,
  departure_type TEXT,
  departure_source TEXT,
  departure_source_instance TEXT,
  platform TEXT,
  platform_is_hidden INTEGER,
  path TEXT,
  line TEXT,
  activities TEXT,
  is_pass INTEGER,
  is_operational INTEGER,
  stop_cancel_reason TEXT,
  stop_delay_reason TEXT,
  stop_status TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (service_key, stop_index),
  FOREIGN KEY (service_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (station_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_service_call_points_station_key
ON service_call_points (station_key);

CREATE INDEX IF NOT EXISTS idx_service_call_points_service_station
ON service_call_points (service_key, station_key);

CREATE TABLE IF NOT EXISTS station_board_entries (
  station_key TEXT NOT NULL,
  station_thing_id TEXT NOT NULL,
  board_type TEXT NOT NULL,
  service_key TEXT NOT NULL,
  service_thing_id TEXT NOT NULL,
  scheduled_ts TEXT,
  expected_ts TEXT,
  platform TEXT,
  destination_name TEXT,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (station_key, board_type, service_key),
  FOREIGN KEY (station_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (service_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_station_board_entries_lookup
ON station_board_entries (station_key, board_type, scheduled_ts);

CREATE TABLE IF NOT EXISTS platform_predictions (
  service_key TEXT PRIMARY KEY,
  service_thing_id TEXT NOT NULL,
  station_key TEXT NOT NULL,
  station_thing_id TEXT NOT NULL,
  predicted_platform TEXT,
  predicted_confidence REAL,
  prediction_basis TEXT NOT NULL,
  first_predicted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (service_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (station_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS service_formations (
  service_key TEXT NOT NULL,
  service_thing_id TEXT NOT NULL,
  formation_index INTEGER NOT NULL,
  formation_thing_id TEXT NOT NULL,
  tiploc TEXT,
  loading_category_code TEXT,
  loading_category_thing_id TEXT,
  loading_category_name TEXT,
  loading_category_colour TEXT,
  loading_category_image TEXT,
  loading_percentage INTEGER,
  source TEXT,
  source_instance TEXT,
  source_instance_thing_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (service_key, formation_index),
  FOREIGN KEY (service_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (formation_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (loading_category_thing_id) REFERENCES things (thing_id) ON DELETE SET NULL,
  FOREIGN KEY (source_instance_thing_id) REFERENCES things (thing_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_formations_service
ON service_formations (service_key, formation_index);

CREATE TABLE IF NOT EXISTS service_coaches (
  service_key TEXT NOT NULL,
  service_thing_id TEXT NOT NULL,
  formation_index INTEGER NOT NULL,
  formation_thing_id TEXT NOT NULL,
  coach_index INTEGER NOT NULL,
  coach_thing_id TEXT NOT NULL,
  tiploc TEXT,
  coach_number TEXT,
  coach_class TEXT,
  toilet_status TEXT,
  toilet_value TEXT,
  loading INTEGER,
  loading_specified INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (service_key, formation_index, coach_index),
  FOREIGN KEY (service_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (formation_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (coach_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_service_coaches_service
ON service_coaches (service_key, formation_index, coach_index);

CREATE TABLE IF NOT EXISTS train_movements (
  train_run_key TEXT NOT NULL,
  train_run_thing_id TEXT NOT NULL,
  movement_index INTEGER NOT NULL,
  movement_thing_id TEXT NOT NULL,
  service_key TEXT,
  service_thing_id TEXT,
  train_id TEXT,
  train_uid TEXT,
  toc TEXT,
  operator_thing_id TEXT,
  train_service_code TEXT,
  stanox TEXT,
  reporting_stanox TEXT,
  platform TEXT,
  path TEXT,
  line TEXT,
  planned_event_type TEXT,
  event_type TEXT,
  planned_ts TEXT,
  gbtt_ts TEXT,
  actual_ts TEXT,
  timetable_variation_minutes INTEGER,
  variation_status TEXT,
  auto_expected INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (train_run_key, movement_index),
  FOREIGN KEY (train_run_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (movement_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (service_thing_id) REFERENCES things (thing_id) ON DELETE SET NULL,
  FOREIGN KEY (operator_thing_id) REFERENCES things (thing_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_train_movements_train_run
ON train_movements (train_run_key, actual_ts);
