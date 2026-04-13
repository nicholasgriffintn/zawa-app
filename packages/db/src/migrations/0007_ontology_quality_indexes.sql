PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_ontology_triples_current_predicate
ON ontology_triples (predicate_id, valid_to, object_thing_id);

CREATE INDEX IF NOT EXISTS idx_ontology_triples_current_datatype
ON ontology_triples (predicate_id, valid_to, object_datatype);

CREATE INDEX IF NOT EXISTS idx_thing_identifiers_primary_lookup
ON thing_identifiers (thing_id, identifier_scheme, is_primary);
