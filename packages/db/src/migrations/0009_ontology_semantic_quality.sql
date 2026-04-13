PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS trg_ontology_constraints_kind_insert;
DROP TRIGGER IF EXISTS trg_ontology_constraints_kind_update;

CREATE TABLE IF NOT EXISTS ontology_constraints_next (
  constraint_id TEXT PRIMARY KEY,
  class_id TEXT,
  property_id TEXT,
  constraint_kind TEXT NOT NULL,
  constraint_value TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES ontology_classes (class_id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES ontology_properties (property_id) ON DELETE CASCADE,
  CHECK (
    constraint_kind IN (
      'required_primary_identifier',
      'required_any_identifier',
      'required_label',
      'object_range_class',
      'datatype_range',
      'decimal_min',
      'decimal_max',
      'current_datatype_single_value',
      'required_property_definition',
      'station_profile_label_consistency',
      'source_event_presence'
    )
  ),
  CHECK (severity IN ('error', 'warning'))
);

INSERT INTO ontology_constraints_next (
  constraint_id, class_id, property_id, constraint_kind, constraint_value, severity, updated_at
)
SELECT constraint_id, class_id, property_id, constraint_kind, constraint_value, severity, updated_at
FROM ontology_constraints;

DROP TABLE ontology_constraints;

ALTER TABLE ontology_constraints_next RENAME TO ontology_constraints;

CREATE TABLE IF NOT EXISTS service_coaches_next (
  service_key TEXT NOT NULL,
  service_thing_id TEXT NOT NULL,
  formation_index INTEGER NOT NULL,
  formation_thing_id TEXT NOT NULL,
  coach_index INTEGER NOT NULL,
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
  FOREIGN KEY (formation_thing_id) REFERENCES things (thing_id) ON DELETE RESTRICT
);

INSERT INTO service_coaches_next (
  service_key,
  service_thing_id,
  formation_index,
  formation_thing_id,
  coach_index,
  tiploc,
  coach_number,
  coach_class,
  toilet_status,
  toilet_value,
  loading,
  loading_specified,
  updated_at
)
SELECT
  service_key,
  service_thing_id,
  formation_index,
  formation_thing_id,
  coach_index,
  tiploc,
  coach_number,
  coach_class,
  toilet_status,
  toilet_value,
  loading,
  loading_specified,
  updated_at
FROM service_coaches;

DROP TABLE service_coaches;

ALTER TABLE service_coaches_next RENAME TO service_coaches;

CREATE INDEX IF NOT EXISTS idx_service_coaches_service
ON service_coaches (service_key, formation_index, coach_index);

PRAGMA foreign_keys = ON;

CREATE TRIGGER trg_ontology_constraints_kind_insert
BEFORE INSERT ON ontology_constraints
WHEN NEW.constraint_kind NOT IN (
  'required_primary_identifier',
  'required_any_identifier',
  'required_label',
  'object_range_class',
  'datatype_range',
  'decimal_min',
  'decimal_max',
  'current_datatype_single_value',
  'required_property_definition',
  'station_profile_label_consistency',
  'source_event_presence'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid ontology constraint kind');
END;

CREATE TRIGGER trg_ontology_constraints_kind_update
BEFORE UPDATE OF constraint_kind ON ontology_constraints
WHEN NEW.constraint_kind NOT IN (
  'required_primary_identifier',
  'required_any_identifier',
  'required_label',
  'object_range_class',
  'datatype_range',
  'decimal_min',
  'decimal_max',
  'current_datatype_single_value',
  'required_property_definition',
  'station_profile_label_consistency',
  'source_event_presence'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid ontology constraint kind');
END;

INSERT INTO ontology_properties (
  property_id, label, description, property_kind, domain_class_id, range_class_id,
  range_datatype, parent_property_id, source_key, updated_at
)
VALUES
  ('rail:postcode', 'postcode', 'Station postcode.', 'datatype', 'rail:Station', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:stepFreeAccessCoverage', 'step-free access coverage', 'Station step-free access coverage category.', 'datatype', 'rail:Station', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:networkStatus', 'network status', 'Current operator network status.', 'datatype', 'rail:Operator', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:planned', 'planned', 'Whether an incident is planned.', 'datatype', 'rail:NetworkIncident', NULL, 'xsd:boolean', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:priority', 'priority', 'Source priority for an incident.', 'datatype', 'rail:NetworkIncident', NULL, 'xsd:decimal', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:serviceType', 'service type', 'Passenger-facing service type.', 'datatype', 'rail:ServiceJourney', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:eventType', 'event type', 'Train movement event type.', 'datatype', 'rail:TrainMovement', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:variationStatus', 'variation status', 'Train movement variation status.', 'datatype', 'rail:TrainMovement', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z')
ON CONFLICT(property_id) DO UPDATE SET
  label = excluded.label,
  description = excluded.description,
  property_kind = excluded.property_kind,
  domain_class_id = excluded.domain_class_id,
  range_class_id = excluded.range_class_id,
  range_datatype = excluded.range_datatype,
  source_key = excluded.source_key,
  updated_at = excluded.updated_at;

UPDATE ontology_properties
SET
  description = CASE property_id
    WHEN 'rail:status' THEN 'Current status text.'
    WHEN 'rail:category' THEN 'Category value from the source.'
    WHEN 'rail:severity' THEN 'Severity value from the source.'
    WHEN 'rail:latitude' THEN 'Latitude coordinate.'
    WHEN 'rail:longitude' THEN 'Longitude coordinate.'
    ELSE description
  END,
  domain_class_id = CASE property_id
    WHEN 'rail:severity' THEN 'rail:OperationalEvent'
    WHEN 'rail:latitude' THEN 'rail:Place'
    WHEN 'rail:longitude' THEN 'rail:Place'
    ELSE domain_class_id
  END,
  range_datatype = CASE property_id
    WHEN 'rail:status' THEN 'xsd:string'
    WHEN 'rail:category' THEN 'xsd:string'
    WHEN 'rail:severity' THEN 'xsd:string'
    WHEN 'rail:latitude' THEN 'xsd:decimal'
    WHEN 'rail:longitude' THEN 'xsd:decimal'
    ELSE range_datatype
  END,
  updated_at = '1970-01-01T00:00:00.000Z'
WHERE property_id IN (
  'rail:status',
  'rail:category',
  'rail:severity',
  'rail:latitude',
  'rail:longitude'
);

INSERT INTO thing_identifiers (
  identifier_scheme, identifier_value, thing_id, source_key, is_primary, updated_at
)
SELECT 'rail:formation-key', thing_id, thing_id, 'internal', 1, updated_at
FROM things
WHERE thing_type = 'rail:ServiceFormation'
ON CONFLICT(identifier_scheme, identifier_value) DO UPDATE SET
  thing_id = excluded.thing_id,
  source_key = excluded.source_key,
  is_primary = excluded.is_primary,
  updated_at = excluded.updated_at;

INSERT INTO thing_identifiers (
  identifier_scheme, identifier_value, thing_id, source_key, is_primary, updated_at
)
SELECT 'rdm:operator-disruption', SUBSTR(thing_id, LENGTH('rail:disruption:') + 1), thing_id, 'rdm', 1, updated_at
FROM things
WHERE thing_type = 'rail:OperatorDisruption'
ON CONFLICT(identifier_scheme, identifier_value) DO UPDATE SET
  thing_id = excluded.thing_id,
  source_key = excluded.source_key,
  is_primary = excluded.is_primary,
  updated_at = excluded.updated_at;

INSERT INTO thing_identifiers (
  identifier_scheme, identifier_value, thing_id, source_key, is_primary, updated_at
)
SELECT 'rdm:station-disruption', SUBSTR(thing_id, LENGTH('rail:disruption:') + 1), thing_id, 'rdm', 1, updated_at
FROM things
WHERE thing_type = 'rail:StationDisruption'
ON CONFLICT(identifier_scheme, identifier_value) DO UPDATE SET
  thing_id = excluded.thing_id,
  source_key = excluded.source_key,
  is_primary = excluded.is_primary,
  updated_at = excluded.updated_at;

INSERT INTO ontology_triples (
  triple_id, subject_thing_id, predicate_id, object_thing_id, object_literal,
  object_datatype, source_key, confidence, valid_from, valid_to, updated_at
)
SELECT
  subject_thing_id || '|' || predicate_id,
  subject_thing_id,
  predicate_id,
  NULL,
  object_literal,
  object_datatype,
  source_key,
  confidence,
  valid_from,
  NULL,
  updated_at
FROM (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY subject_thing_id, predicate_id
      ORDER BY updated_at DESC, triple_id DESC
    ) AS row_number
  FROM ontology_triples
  WHERE object_literal IS NOT NULL
    AND valid_to IS NULL
)
WHERE row_number = 1
ON CONFLICT(triple_id) DO UPDATE SET
  object_literal = excluded.object_literal,
  object_datatype = excluded.object_datatype,
  source_key = excluded.source_key,
  confidence = excluded.confidence,
  valid_from = excluded.valid_from,
  valid_to = NULL,
  updated_at = excluded.updated_at;

UPDATE ontology_triples
SET valid_to = updated_at
WHERE object_literal IS NOT NULL
  AND valid_to IS NULL
  AND triple_id IS NOT subject_thing_id || '|' || predicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_triples_current_datatype_unique
ON ontology_triples (subject_thing_id, predicate_id)
WHERE object_literal IS NOT NULL AND valid_to IS NULL;

DELETE FROM ontology_triples
WHERE subject_thing_id IN (SELECT thing_id FROM things WHERE thing_type = 'rail:Coach')
  OR object_thing_id IN (SELECT thing_id FROM things WHERE thing_type = 'rail:Coach')
  OR predicate_id IN ('rail:coachInFormation', 'rail:coachClass', 'rail:loading');

DELETE FROM things
WHERE thing_type = 'rail:Coach';

DELETE FROM ontology_properties
WHERE property_id IN ('rail:coachInFormation', 'rail:coachClass', 'rail:loading');

DELETE FROM ontology_classes
WHERE class_id = 'rail:Coach';

INSERT INTO ontology_constraints (
  constraint_id, class_id, property_id, constraint_kind, constraint_value, severity, updated_at
)
VALUES
  ('rail:constraint:formation-identifier', 'rail:ServiceFormation', NULL, 'required_any_identifier', '*', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:operator-disruption-identifier', 'rail:OperatorDisruption', NULL, 'required_any_identifier', '*', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:station-disruption-identifier', 'rail:StationDisruption', NULL, 'required_any_identifier', '*', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:station-profile-labels', 'rail:Station', NULL, 'station_profile_label_consistency', 'station_profiles.station_name', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:source-events-present', NULL, NULL, 'source_event_presence', 'operational-data', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:status-single-current', NULL, 'rail:status', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:network-status-single-current', NULL, 'rail:networkStatus', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:planned-single-current', NULL, 'rail:planned', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:priority-single-current', NULL, 'rail:priority', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:category-single-current', NULL, 'rail:category', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:severity-single-current', NULL, 'rail:severity', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:service-type-single-current', NULL, 'rail:serviceType', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:event-type-single-current', NULL, 'rail:eventType', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:variation-status-single-current', NULL, 'rail:variationStatus', 'current_datatype_single_value', '1', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:postcode-definition', NULL, 'rail:postcode', 'required_property_definition', 'datatype|rail:Station|-|xsd:string', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:step-free-definition', NULL, 'rail:stepFreeAccessCoverage', 'required_property_definition', 'datatype|rail:Station|-|xsd:string', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:network-status-definition', NULL, 'rail:networkStatus', 'required_property_definition', 'datatype|rail:Operator|-|xsd:string', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:planned-definition', NULL, 'rail:planned', 'required_property_definition', 'datatype|rail:NetworkIncident|-|xsd:boolean', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:priority-definition', NULL, 'rail:priority', 'required_property_definition', 'datatype|rail:NetworkIncident|-|xsd:decimal', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:service-type-definition', NULL, 'rail:serviceType', 'required_property_definition', 'datatype|rail:ServiceJourney|-|xsd:string', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:event-type-definition', NULL, 'rail:eventType', 'required_property_definition', 'datatype|rail:TrainMovement|-|xsd:string', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:variation-status-definition', NULL, 'rail:variationStatus', 'required_property_definition', 'datatype|rail:TrainMovement|-|xsd:string', 'warning', '1970-01-01T00:00:00.000Z')
ON CONFLICT(constraint_id) DO UPDATE SET
  class_id = excluded.class_id,
  property_id = excluded.property_id,
  constraint_kind = excluded.constraint_kind,
  constraint_value = excluded.constraint_value,
  severity = excluded.severity,
  updated_at = excluded.updated_at;
