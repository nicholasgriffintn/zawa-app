PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS trg_ontology_constraints_kind_insert
BEFORE INSERT ON ontology_constraints
WHEN NEW.constraint_kind NOT IN (
  'required_primary_identifier',
  'required_label',
  'object_range_class',
  'datatype_range',
  'decimal_min',
  'decimal_max'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid ontology constraint kind');
END;

CREATE TRIGGER IF NOT EXISTS trg_ontology_constraints_kind_update
BEFORE UPDATE OF constraint_kind ON ontology_constraints
WHEN NEW.constraint_kind NOT IN (
  'required_primary_identifier',
  'required_label',
  'object_range_class',
  'datatype_range',
  'decimal_min',
  'decimal_max'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid ontology constraint kind');
END;

CREATE TRIGGER IF NOT EXISTS trg_ontology_constraints_severity_insert
BEFORE INSERT ON ontology_constraints
WHEN NEW.severity NOT IN ('error', 'warning')
BEGIN
  SELECT RAISE(ABORT, 'invalid ontology constraint severity');
END;

CREATE TRIGGER IF NOT EXISTS trg_ontology_constraints_severity_update
BEFORE UPDATE OF severity ON ontology_constraints
WHEN NEW.severity NOT IN ('error', 'warning')
BEGIN
  SELECT RAISE(ABORT, 'invalid ontology constraint severity');
END;

CREATE TABLE IF NOT EXISTS ontology_quality_runs (
  run_key TEXT PRIMARY KEY,
  checked_at TEXT NOT NULL,
  violation_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  CHECK (violation_count >= 0),
  CHECK (error_count >= 0),
  CHECK (warning_count >= 0)
);

CREATE TABLE IF NOT EXISTS ontology_quality_violations (
  run_key TEXT NOT NULL,
  violation_id TEXT NOT NULL,
  constraint_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  thing_id TEXT,
  property_id TEXT,
  violation_kind TEXT NOT NULL,
  message TEXT NOT NULL,
  observed_value TEXT,
  checked_at TEXT NOT NULL,
  PRIMARY KEY (run_key, violation_id),
  FOREIGN KEY (run_key) REFERENCES ontology_quality_runs (run_key) ON DELETE CASCADE,
  FOREIGN KEY (constraint_id) REFERENCES ontology_constraints (constraint_id) ON DELETE CASCADE,
  FOREIGN KEY (thing_id) REFERENCES things (thing_id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES ontology_properties (property_id) ON DELETE CASCADE,
  CHECK (severity IN ('error', 'warning'))
);

CREATE INDEX IF NOT EXISTS idx_ontology_quality_violations_severity
ON ontology_quality_violations (run_key, severity, checked_at);

CREATE INDEX IF NOT EXISTS idx_ontology_quality_violations_thing
ON ontology_quality_violations (run_key, thing_id, severity);

INSERT INTO ontology_constraints (
  constraint_id, class_id, property_id, constraint_kind, constraint_value, severity, updated_at
)
VALUES
  ('rail:constraint:station-primary-crs', 'rail:Station', NULL, 'required_primary_identifier', 'rail:crs', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:operator-primary-toc', 'rail:Operator', NULL, 'required_primary_identifier', 'rdm:toc', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:service-primary-key', 'rail:ServiceJourney', NULL, 'required_primary_identifier', 'rail:service-key', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:train-run-primary-key', 'rail:TrainRun', NULL, 'required_primary_identifier', 'rail:train-run-key', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:loading-category-primary-code', 'rail:LoadingCategory', NULL, 'required_primary_identifier', 'rdm:loading-category', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:reason-code-primary-code', 'rail:ReasonCode', NULL, 'required_primary_identifier', 'rdm:reason-code', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:source-instance-primary-code', 'rail:SourceInstance', NULL, 'required_primary_identifier', 'rdm:source-instance', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:station-label', 'rail:Station', NULL, 'required_label', 'preferred_label', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:operator-label', 'rail:Operator', NULL, 'required_label', 'preferred_label', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:service-label', 'rail:ServiceJourney', NULL, 'required_label', 'preferred_label', 'warning', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:operated-by-range', NULL, 'rail:operatedBy', 'object_range_class', 'rail:Operator', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:calls-at-range', NULL, 'rail:callsAt', 'object_range_class', 'rail:Station', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:affects-station-range', NULL, 'rail:affectsStation', 'object_range_class', 'rail:Station', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:affects-operator-range', NULL, 'rail:affectsOperator', 'object_range_class', 'rail:Operator', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:loading-category-range', NULL, 'rail:loadingCategory', 'object_range_class', 'rail:LoadingCategory', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:reported-source-instance-range', NULL, 'rail:reportedBySourceInstance', 'object_range_class', 'rail:SourceInstance', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:movement-of-range', NULL, 'rail:movementOf', 'object_range_class', 'rail:TrainRun', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:observed-service-range', NULL, 'rail:observedService', 'object_range_class', 'rail:ServiceJourney', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:reported-operator-range', NULL, 'rail:reportedByOperator', 'object_range_class', 'rail:Operator', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:message-for-station-range', NULL, 'rail:messageForStation', 'object_range_class', 'rail:Station', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:defined-by-operator-range', NULL, 'rail:definedByOperator', 'object_range_class', 'rail:Operator', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:realises-train-run-range', NULL, 'rail:realisesTrainRun', 'object_range_class', 'rail:TrainRun', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:latitude-datatype', NULL, 'rail:latitude', 'datatype_range', 'xsd:decimal', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:longitude-datatype', NULL, 'rail:longitude', 'datatype_range', 'xsd:decimal', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:latitude-min', NULL, 'rail:latitude', 'decimal_min', '-90', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:latitude-max', NULL, 'rail:latitude', 'decimal_max', '90', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:longitude-min', NULL, 'rail:longitude', 'decimal_min', '-180', 'error', '1970-01-01T00:00:00.000Z'),
  ('rail:constraint:longitude-max', NULL, 'rail:longitude', 'decimal_max', '180', 'error', '1970-01-01T00:00:00.000Z')
ON CONFLICT(constraint_id) DO UPDATE SET
  class_id = excluded.class_id,
  property_id = excluded.property_id,
  constraint_kind = excluded.constraint_kind,
  constraint_value = excluded.constraint_value,
  severity = excluded.severity,
  updated_at = excluded.updated_at;
