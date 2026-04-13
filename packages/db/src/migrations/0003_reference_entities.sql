PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS station_profiles (
  station_key TEXT PRIMARY KEY,
  station_thing_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  sixteen_character_name TEXT,
  national_location_code TEXT,
  station_operator TEXT,
  station_operator_thing_id TEXT,
  latitude REAL,
  longitude REAL,
  source_version TEXT,
  profile_hash TEXT,
  profile_updated_at TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  address_line_3 TEXT,
  address_line_4 TEXT,
  postcode TEXT,
  staffing_level TEXT,
  cctv_available INTEGER,
  cis_modes TEXT,
  customer_help_points_available INTEGER,
  ticket_office_available INTEGER,
  ticket_machine_available INTEGER,
  oyster_issued INTEGER,
  oyster_topup_ticket_machine INTEGER,
  oyster_accepted INTEGER,
  smartcard_issued INTEGER,
  smartcard_topup_ticket_office INTEGER,
  smartcard_topup_ticket_machine INTEGER,
  smartcard_validator INTEGER,
  seated_area_available INTEGER,
  waiting_room_available INTEGER,
  toilets_available INTEGER,
  wifi_available INTEGER,
  induction_loop INTEGER,
  accessible_ticket_machines INTEGER,
  ramp_for_train_access INTEGER,
  accessible_taxis_available INTEGER,
  national_key_toilets_available INTEGER,
  step_free_access_coverage TEXT,
  impaired_mobility_set_down_available INTEGER,
  cycle_storage_spaces INTEGER,
  car_park_spaces INTEGER,
  accessible_car_park_spaces INTEGER,
  rail_replacement_map_url TEXT,
  profile_status TEXT NOT NULL DEFAULT 'pending',
  profile_error_status INTEGER,
  profile_error_message TEXT,
  profile_checked_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (station_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (station_operator_thing_id) REFERENCES things (thing_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_station_profiles_active_key
ON station_profiles (is_active, station_key);

CREATE INDEX IF NOT EXISTS idx_station_profiles_active_name
ON station_profiles (is_active, station_name);

CREATE INDEX IF NOT EXISTS idx_station_profiles_nlc
ON station_profiles (national_location_code);

CREATE INDEX IF NOT EXISTS idx_station_profiles_profile_status
ON station_profiles (profile_status, station_key);

CREATE INDEX IF NOT EXISTS idx_station_profiles_postcode
ON station_profiles (postcode);

CREATE TABLE IF NOT EXISTS operators (
  toc_code TEXT PRIMARY KEY,
  operator_thing_id TEXT NOT NULL,
  toc_name TEXT NOT NULL,
  source_version TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (operator_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS reason_codes (
  reason_code TEXT PRIMARY KEY,
  reason_thing_id TEXT NOT NULL,
  late_reason TEXT,
  cancellation_reason TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (reason_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS loading_categories (
  category_code TEXT PRIMARY KEY,
  loading_category_thing_id TEXT NOT NULL,
  category_name TEXT,
  typical_description TEXT,
  expected_description TEXT,
  definition TEXT,
  colour TEXT,
  image TEXT,
  toc_code TEXT,
  toc_operator_thing_id TEXT,
  source_version TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (loading_category_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT,
  FOREIGN KEY (toc_operator_thing_id) REFERENCES things (thing_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS source_instances (
  source_instance_id TEXT PRIMARY KEY,
  source_instance_thing_id TEXT NOT NULL,
  source_instance_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_instance_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);
