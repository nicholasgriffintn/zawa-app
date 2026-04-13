PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS things (
  thing_id TEXT PRIMARY KEY,
  thing_type TEXT NOT NULL,
  preferred_label TEXT,
  disambiguation_hint TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_things_type_active
ON things (thing_type, is_active, preferred_label);

CREATE TABLE IF NOT EXISTS ontology_classes (
  class_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  parent_class_id TEXT,
  source_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_class_id) REFERENCES ontology_classes (class_id) ON DELETE SET NULL,
  FOREIGN KEY (source_key) REFERENCES rail_sources (source_key) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ontology_classes_parent
ON ontology_classes (parent_class_id);

CREATE TABLE IF NOT EXISTS ontology_properties (
  property_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  property_kind TEXT NOT NULL,
  domain_class_id TEXT,
  range_class_id TEXT,
  range_datatype TEXT,
  parent_property_id TEXT,
  source_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_class_id) REFERENCES ontology_classes (class_id) ON DELETE SET NULL,
  FOREIGN KEY (range_class_id) REFERENCES ontology_classes (class_id) ON DELETE SET NULL,
  FOREIGN KEY (parent_property_id) REFERENCES ontology_properties (property_id) ON DELETE SET NULL,
  FOREIGN KEY (source_key) REFERENCES rail_sources (source_key) ON DELETE RESTRICT,
  CHECK (property_kind IN ('object', 'datatype'))
);

CREATE INDEX IF NOT EXISTS idx_ontology_properties_domain
ON ontology_properties (domain_class_id, property_kind);

CREATE TABLE IF NOT EXISTS ontology_constraints (
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
      'required_label',
      'object_range_class',
      'datatype_range',
      'decimal_min',
      'decimal_max'
    )
  ),
  CHECK (severity IN ('error', 'warning'))
);

CREATE TABLE IF NOT EXISTS thing_class_assertions (
  thing_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  confidence REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (thing_id, class_id, source_key),
  FOREIGN KEY (thing_id) REFERENCES things (thing_id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES ontology_classes (class_id) ON DELETE RESTRICT,
  FOREIGN KEY (source_key) REFERENCES rail_sources (source_key) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS thing_identifiers (
  identifier_scheme TEXT NOT NULL,
  identifier_value TEXT NOT NULL,
  thing_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (identifier_scheme, identifier_value),
  FOREIGN KEY (thing_id) REFERENCES things (thing_id) ON DELETE CASCADE,
  FOREIGN KEY (source_key) REFERENCES rail_sources (source_key) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_thing_identifiers_thing
ON thing_identifiers (thing_id, identifier_scheme);

CREATE TABLE IF NOT EXISTS thing_labels (
  thing_id TEXT NOT NULL,
  label_kind TEXT NOT NULL,
  locale TEXT NOT NULL,
  label TEXT NOT NULL,
  source_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (thing_id, label_kind, locale, label),
  FOREIGN KEY (thing_id) REFERENCES things (thing_id) ON DELETE CASCADE,
  FOREIGN KEY (source_key) REFERENCES rail_sources (source_key) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ontology_triples (
  triple_id TEXT PRIMARY KEY,
  subject_thing_id TEXT NOT NULL,
  predicate_id TEXT NOT NULL,
  object_thing_id TEXT,
  object_literal TEXT,
  object_datatype TEXT,
  source_key TEXT NOT NULL,
  confidence REAL,
  valid_from TEXT,
  valid_to TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (subject_thing_id) REFERENCES things (thing_id) ON DELETE CASCADE,
  FOREIGN KEY (predicate_id) REFERENCES ontology_properties (property_id) ON DELETE RESTRICT,
  FOREIGN KEY (object_thing_id) REFERENCES things (thing_id) ON DELETE CASCADE,
  FOREIGN KEY (source_key) REFERENCES rail_sources (source_key) ON DELETE RESTRICT,
  CHECK (
    (object_thing_id IS NOT NULL AND object_literal IS NULL AND object_datatype IS NULL)
    OR (object_thing_id IS NULL AND object_literal IS NOT NULL AND object_datatype IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ontology_triples_subject
ON ontology_triples (subject_thing_id, predicate_id);

CREATE INDEX IF NOT EXISTS idx_ontology_triples_object
ON ontology_triples (object_thing_id, predicate_id);

INSERT INTO ontology_classes (class_id, label, description, parent_class_id, source_key, updated_at)
VALUES
  ('rail:Thing', 'Thing', 'Base class for any rail-domain entity.', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:Place', 'Place', 'Physical or logical place in the rail network.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:Station', 'Station', 'Passenger station identified primarily by CRS.', 'rail:Place', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:Organisation', 'Organisation', 'Organisation involved in rail operations.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:Operator', 'Operator', 'Train operating company or station operator.', 'rail:Organisation', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:ServiceJourney', 'Service journey', 'A dated passenger or operational rail service.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:TrainRun', 'Train run', 'A physical train run observed through realtime or movement data.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:OperationalEvent', 'Operational event', 'An event that changes or describes operational state.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:NetworkIncident', 'Network incident', 'Incident affecting services or operators.', 'rail:OperationalEvent', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:StationDisruption', 'Station disruption', 'Disruption affecting a station.', 'rail:OperationalEvent', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:OperatorDisruption', 'Operator disruption', 'Disruption affecting an operator.', 'rail:OperationalEvent', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:StationMessage', 'Station message', 'Message associated with a station.', 'rail:OperationalEvent', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:ServiceFormation', 'Service formation', 'Formation for a service journey.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:Coach', 'Coach', 'A coach within a service formation.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:LoadingCategory', 'Loading category', 'Reference loading category.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:ReasonCode', 'Reason code', 'Reference delay or cancellation reason code.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:SourceInstance', 'Source instance', 'Source-system instance identifier.', 'rail:Thing', 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:TrainMovement', 'Train movement', 'Observed movement of a train run.', 'rail:OperationalEvent', 'internal', '1970-01-01T00:00:00.000Z')
ON CONFLICT(class_id) DO NOTHING;

INSERT INTO ontology_properties (
  property_id, label, description, property_kind, domain_class_id, range_class_id,
  range_datatype, parent_property_id, source_key, updated_at
)
VALUES
  ('rail:operatedBy', 'operated by', 'Links a service or station to an operator.', 'object', 'rail:Thing', 'rail:Operator', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:callsAt', 'calls at', 'Links a service journey to a station call point.', 'object', 'rail:ServiceJourney', 'rail:Station', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:affectsStation', 'affects station', 'Links operational context to an affected station.', 'object', 'rail:OperationalEvent', 'rail:Station', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:affectsOperator', 'affects operator', 'Links operational context to an affected operator.', 'object', 'rail:OperationalEvent', 'rail:Operator', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:formationOf', 'formation of', 'Links a formation to a service journey.', 'object', 'rail:ServiceFormation', 'rail:ServiceJourney', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:coachInFormation', 'coach in formation', 'Links a coach to its formation.', 'object', 'rail:Coach', 'rail:ServiceFormation', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:loadingCategory', 'loading category', 'Links a formation to a loading category.', 'object', 'rail:ServiceFormation', 'rail:LoadingCategory', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:reportedBySourceInstance', 'reported by source instance', 'Links observed data to the reporting source instance.', 'object', 'rail:Thing', 'rail:SourceInstance', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:movementOf', 'movement of', 'Links a movement event to a train run.', 'object', 'rail:TrainMovement', 'rail:TrainRun', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:observedService', 'observed service', 'Links a movement event to a service journey.', 'object', 'rail:TrainMovement', 'rail:ServiceJourney', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:reportedByOperator', 'reported by operator', 'Links an observation to the reporting operator.', 'object', 'rail:OperationalEvent', 'rail:Operator', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:messageForStation', 'message for station', 'Links a station message to a station.', 'object', 'rail:StationMessage', 'rail:Station', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:definedByOperator', 'defined by operator', 'Links a reference concept to the operator that defines it.', 'object', 'rail:Thing', 'rail:Operator', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:realisesTrainRun', 'realises train run', 'Links a service journey to its observed train run.', 'object', 'rail:ServiceJourney', 'rail:TrainRun', NULL, NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:status', 'status', 'Current status text.', 'datatype', 'rail:Thing', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:category', 'category', 'Category value from the source.', 'datatype', 'rail:Thing', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:severity', 'severity', 'Severity value from the source.', 'datatype', 'rail:OperationalEvent', NULL, 'xsd:string', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:latitude', 'latitude', 'Latitude coordinate.', 'datatype', 'rail:Place', NULL, 'xsd:decimal', NULL, 'internal', '1970-01-01T00:00:00.000Z'),
  ('rail:longitude', 'longitude', 'Longitude coordinate.', 'datatype', 'rail:Place', NULL, 'xsd:decimal', NULL, 'internal', '1970-01-01T00:00:00.000Z')
ON CONFLICT(property_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS source_events (
  event_id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL,
  message_id TEXT,
  topic TEXT,
  event_type TEXT,
  thing_id TEXT,
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (source_key) REFERENCES rail_sources (source_key) ON DELETE RESTRICT,
  FOREIGN KEY (thing_id) REFERENCES things (thing_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_source_events_source_received
ON source_events (source_key, received_at);

CREATE INDEX IF NOT EXISTS idx_source_events_thing_received
ON source_events (thing_id, received_at);
