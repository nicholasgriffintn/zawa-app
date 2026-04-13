# Database Structure

The database is organised around a rail-native ontology plus typed read projections. The ontology gives every meaningful domain object a stable identity and explicit relationships. The projections keep passenger-facing API reads cheap and predictable.

## Migration Groups

| Migration                            | Responsibility                                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_sources_and_provenance.sql`    | Source registry, sync lifecycle, projection idempotency, ingest health.                                                                                                                |
| `0002_knowledge_graph.sql`           | Ontology vocabulary, canonical things, identifiers, labels, class assertions, triples, and source events.                                                                              |
| `0003_reference_entities.sql`        | Slowly changing reference entities such as stations, operators, reason codes, loading categories, and source instances.                                                                |
| `0004_operational_context.sql`       | Current network context: operator statuses, incidents, station disruptions, and station messages.                                                                                      |
| `0005_service_projections.sql`       | Fast service, stop, board, formation, coach, movement, and prediction projections.                                                                                                     |
| `0006_ontology_quality.sql`          | Seeded ontology constraints, current quality violations, and the latest quality validation run summary.                                                                                |
| `0007_ontology_quality_indexes.sql`  | Lookup indexes for scheduled ontology quality validation.                                                                                                                              |
| `0008_station_board_refreshes.sql`   | Board refresh state used to select stale station boards without repeatedly queuing empty boards.                                                                                       |
| `0009_ontology_semantic_quality.sql` | Expands ontology quality kinds, removes per-formation coach things, backfills generated-entity identifiers, canonicalises current literal triples, and seeds semantic property checks. |

## Ontology Layer

The ontology layer has one semantic path. `things` stores identity, `thing_class_assertions` stores class membership, and `ontology_triples` stores object and literal facts.

The vocabulary tables define the domain model:

- `ontology_classes` stores classes such as `rail:Station`, `rail:Operator`, `rail:ServiceJourney`, `rail:NetworkIncident`, `rail:ServiceFormation`, and `rail:TrainMovement`.
- `ontology_properties` stores object and datatype properties such as `rail:callsAt`, `rail:operatedBy`, `rail:affectsStation`, `rail:formationOf`, `rail:status`, and `rail:latitude`.
- `ontology_constraints` stores machine-readable class/property constraints for the ontology quality validator.

`things` is the canonical identity table. A thing is any domain object we may want to link, search, enrich, or reason about later: station, operator, service journey, train run, incident, disruption, formation, loading category, source instance, or movement. Per-formation coach rows are typed projection data, not ontology things, unless a feed supplies a stable real-world vehicle identifier.

Supporting tables describe each thing:

- `thing_identifiers` maps external identifiers such as CRS, TOC, RID, UID, NLC, and RDM IDs onto canonical `thing_id` values.
- `thing_labels` stores display labels separately from source identifiers.
- `thing_class_assertions` states which ontology class a thing belongs to.
- `ontology_triples` stores RDF-style subject/predicate/object assertions for both linked things and literal values.
- `source_events` stores replayable source payloads and optionally links them to the most relevant thing.

This is an RDF-compatible relational ontology. We keep it relational because Cloudflare D1 is the store, but the structure is deliberately ontology-first: classes, properties, constraints, instance class assertions, object-property triples, datatype-property triples, source ownership, and validity windows.

## Ontology Quality

`0006_ontology_quality.sql` seeds concrete constraints and stores the current validation result. Constraints are active database data, not documentation-only vocabulary.

The seeded constraints currently cover:

- Required primary identifiers for stations, operators, service journeys, train runs, loading categories, reason codes, and source instances.
- Required identifiers for generated formations and disruption things.
- Required preferred labels for stations, operators, and service journeys.
- Object-property range checks for links such as `rail:callsAt`, `rail:operatedBy`, `rail:affectsStation`, `rail:loadingCategory`, and train-run/service relationships.
- Datatype and bounds checks for latitude and longitude triples.
- Single-current-value checks for mutable literal properties such as service status, incident priority, event type, and variation status.
- Required semantic property definitions for operational predicates that are populated by the pipeline.
- Station profile label consistency and source-event presence checks.

`ontology_quality_runs` stores each validation run and its aggregate counts. `ontology_quality_violations` stores the violations linked to that run by `run_key`; `(run_key, violation_id)` is the primary key so the same logical violation cannot be duplicated inside one run. The API reports the latest run by default.

`apps/rdm-sync` runs ontology quality validation on a dedicated hourly cron. It does not run inside the five-minute ingestion path or projector queue batches, because validation scans graph tables and writes a report. Quality failures are recorded and logged by the quality job; they do not block ingestion.

## Projection Layer

Projection tables are intentionally typed. They are not the source of identity; they are read models over the graph.

- `station_profiles` stores station reference/profile fields and links each row to `station_thing_id`.
- `operators`, `reason_codes`, `loading_categories`, and `source_instances` store reference entities with canonical thing links.
- `operator_statuses`, `operator_disruptions`, `network_incidents`, `network_incident_operators`, `station_disruptions`, and `station_messages` store current operational context.
- `service_journeys`, `service_call_points`, `station_board_entries`, `service_formations`, `service_coaches`, `train_movements`, and `platform_predictions` store the fast service and board read models.
- `station_board_refreshes` stores board refresh request/completion timestamps so scheduled refreshes can select stale station-board views even when the latest board snapshot contains no services.

Projection rows carry the relevant thing IDs so future features can cross-link without re-parsing raw source payloads. For example, a board entry links a station thing to a service journey thing, and call points link the same service journey to each station it calls at.

Projection cleanup must also close ontology state. When incidents, disruptions, or station-board-only services disappear from the current projection, the owning query helper marks the thing inactive and closes current triples with `valid_to`. Historical projection rows may still exist, but inactive things and closed triples no longer count as current ontology state.

## Pipeline Responsibilities

`apps/rdm-sync` owns scheduled reference and operational ingestion. It writes source sync state to `source_sync_runs`, populates reference projections, and creates the corresponding things, identifiers, labels, class assertions, and triples.

`apps/rdm-ingest` owns Kafka stream ingestion for Darwin realtime and NWR Train Movements. It normalises source payloads into `RailEvent`s and publishes them to `rail-events`.

`apps/projector` owns queued event projection. It claims events in `projection_claims`, records raw streaming source events where replay or audit matters, writes current service/board/stop/formation/movement projections, and creates ontology triples as part of those writes.

`apps/edge` owns public APIs and WebSockets. It reads from projections for product responses and does not create ontology projection rows while building public response envelopes.

## Ontology SDK and API Surface

`@zawa/ontology` is the read SDK for ontology data. It exposes a catalogue view for classes, properties, constraints, and counts, plus graph expansion for one or more thing IDs.

The edge service uses that SDK across the public domain surface:

- `/api/ontologies` returns the live ontology catalogue.
- `/api/ontologies/things` returns active things with pagination plus `q`, `thingType`, and `classId` filters.
- `/api/ontologies/triples` returns current triples with pagination plus `q`, `predicateId`, `subjectThingId`, and `objectThingId` filters.
- `/api/ontologies/quality` returns the current quality summary and paginated constraint violations, with `q`, `severity`, and `kind` filters.
- `/api/ontologies/things/:thingId` returns a graph envelope for a specific thing, including inbound links.
- Passenger API responses for dashboard, station search, station boards, and services include an `ontology` envelope with `rootThingIds`, `things`, and `triples`.
- WebSocket snapshots include the same ontology envelope. WebSocket patch and remove messages include `rootThingIds` so realtime deltas still point back to canonical things without streaming the full graph on every small update.

Graph envelopes only report `rootThingIds` for things that exist in the ontology store. If a projection response can infer a would-be thing ID but the projector has not written it yet, the graph omits that root rather than mutating ontology state from the read path.

The `/ontologies` page renders the same catalogue from the edge API. `/ontologies/quality` renders current constraint violations. Dashboard, station board, and service views also render graph summaries from their API or WebSocket state. These are human-facing views over the database ontology, not separate static copies of the model.

## Invariants

- Every projection row for a meaningful entity must have a non-null thing ID.
- External identifiers must be stored in `thing_identifiers`, not only in projection columns.
- Every thing written by the pipeline must have at least one `thing_class_assertions` row.
- Every relation predicate used by the pipeline must have an `ontology_properties` definition.
- Mutable literal facts should have only one current triple per subject and predicate; old values must be closed with `valid_to`.
- Every `ontology_constraints` row must use a supported `constraint_kind` and `severity`; database checks and triggers reject unsupported values.
- Cross-entity meaning belongs in `ontology_triples`; do not infer important joins from labels.
- Raw payload JSON is only for replay and audit. Product code should read typed projections or ontology tables.
- Source lifecycle state belongs in `source_sync_runs`; realtime delivery health belongs in `ingest_feeds`.

## Extension Points

Add a new source by inserting it into `rail_sources`, storing its cursor/status in `source_sync_runs`, and mapping its identifiers onto existing things where possible.

Add a new domain concept by creating deterministic thing IDs and identifier schemes in the query helper layer, then seed ontology classes, properties, and constraints through migrations before adding projection columns.

Add a new product API by reading typed projections first, then joining to ontology tables only when the feature needs cross-domain relationships or sparse attributes.
