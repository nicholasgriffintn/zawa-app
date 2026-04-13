PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_things_active_id
ON things (is_active, thing_id);

CREATE INDEX IF NOT EXISTS idx_ontology_triples_current_subject
ON ontology_triples (valid_to, subject_thing_id, predicate_id);

CREATE INDEX IF NOT EXISTS idx_ontology_triples_current_object
ON ontology_triples (valid_to, object_thing_id, predicate_id);

CREATE INDEX IF NOT EXISTS idx_ontology_quality_violations_run_filter
ON ontology_quality_violations (run_key, severity, violation_kind);

UPDATE things
SET is_active = 0,
    updated_at = '2026-06-14T00:00:00.000Z'
WHERE is_active = 1
  AND thing_type = 'rail:NetworkIncident'
  AND NOT EXISTS (
    SELECT 1
    FROM network_incidents
    WHERE network_incidents.incident_thing_id = things.thing_id
      AND network_incidents.is_active = 1
  );

UPDATE things
SET is_active = 0,
    updated_at = '2026-06-14T00:00:00.000Z'
WHERE is_active = 1
  AND thing_type = 'rail:OperatorDisruption'
  AND NOT EXISTS (
    SELECT 1
    FROM operator_disruptions
    WHERE operator_disruptions.disruption_thing_id = things.thing_id
  );

UPDATE things
SET is_active = 0,
    updated_at = '2026-06-14T00:00:00.000Z'
WHERE is_active = 1
  AND thing_type = 'rail:StationDisruption'
  AND NOT EXISTS (
    SELECT 1
    FROM station_disruptions
    WHERE station_disruptions.disruption_thing_id = things.thing_id
      AND station_disruptions.is_active = 1
  );

UPDATE things
SET is_active = 0,
    updated_at = '2026-06-14T00:00:00.000Z'
WHERE is_active = 1
  AND thing_type = 'rail:ServiceJourney'
  AND NOT EXISTS (
    SELECT 1
    FROM station_board_entries
    WHERE station_board_entries.service_thing_id = things.thing_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM service_call_points
    WHERE service_call_points.service_thing_id = things.thing_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM service_formations
    WHERE service_formations.service_thing_id = things.thing_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM train_movements
    WHERE train_movements.service_thing_id = things.thing_id
  );

UPDATE ontology_triples
SET valid_to = '2026-06-14T00:00:00.000Z',
    updated_at = '2026-06-14T00:00:00.000Z'
WHERE valid_to IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM things
      WHERE things.thing_id = ontology_triples.subject_thing_id
        AND things.is_active = 0
    )
    OR EXISTS (
      SELECT 1
      FROM things
      WHERE things.thing_id = ontology_triples.object_thing_id
        AND things.is_active = 0
    )
  );
