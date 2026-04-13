import type { D1DatabaseLike } from "@zawa/db/d1";

export type OntologySearchResultKind =
  | "station"
  | "service"
  | "operator"
  | "incident"
  | "operator_disruption"
  | "station_disruption"
  | "station_message"
  | "service_formation"
  | "loading_category"
  | "reason_code"
  | "source_instance"
  | "train_run"
  | "train_movement"
  | "ontology_class"
  | "ontology_property"
  | "ontology_thing";

export interface OntologySearchResult {
  result_id: string;
  result_kind: OntologySearchResultKind;
  thing_id: string | null;
  thing_type: string | null;
  title: string;
  subtitle: string | null;
  match_label: string;
  match_value: string | null;
  predicate_id: string | null;
  predicate_label: string | null;
  station_key: string | null;
  service_key: string | null;
  score: number;
  updated_at: string | null;
}

export interface OntologySearchResponse {
  query: string;
  results: OntologySearchResult[];
}

export interface OntologySearchOptions {
  query?: string | null;
  limit?: number;
}

interface SearchBranch {
  sql: string;
  values: unknown[];
}

const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 20;

export async function searchOntology(
  db: D1DatabaseLike,
  options: OntologySearchOptions = {},
): Promise<OntologySearchResponse> {
  const query = options.query?.trim() ?? "";
  if (!query) return { query, results: [] };

  const limit = searchLimit(options.limit);
  const branches = searchBranches(query);
  const branchLimit = Math.max(limit, 4);
  const branchResults = await Promise.all(
    branches.map((branch) => searchBranchResults(db, branch, branchLimit)),
  );
  const results = branchResults
    .flat()
    .sort((left, right) => right.score - left.score || compareSearchText(left, right));

  return {
    query,
    results: dedupeSearchResults(results).slice(0, limit),
  };
}

async function searchBranchResults(
  db: D1DatabaseLike,
  branch: SearchBranch,
  limit: number,
): Promise<OntologySearchResult[]> {
  const rows = await db
    .prepare(
      `
      ${branch.sql}
      ORDER BY score DESC, title ASC, result_id ASC
      LIMIT ?
    `,
    )
    .bind(...branch.values, limit)
    .all<OntologySearchResult>();

  return rows.results;
}

function searchBranches(query: string): SearchBranch[] {
  return [
    stationBranch(query),
    serviceBranch(query),
    operatorBranch(query),
    networkIncidentBranch(query),
    operatorDisruptionBranch(query),
    stationDisruptionBranch(query),
    stationMessageBranch(query),
    serviceFormationBranch(query),
    loadingCategoryBranch(query),
    reasonCodeBranch(query),
    sourceInstanceBranch(query),
    trainRunBranch(query),
    trainMovementBranch(query),
    classBranch(query),
    propertyBranch(query),
    thingBranch(query),
    identifierBranch(query),
    labelBranch(query),
    classAssertionBranch(query),
    tripleBranch(query),
  ];
}

function stationBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'station:' || station_profiles.station_key AS result_id,
        'station' AS result_kind,
        station_profiles.station_thing_id AS thing_id,
        'rail:Station' AS thing_type,
        station_profiles.station_name AS title,
        station_profiles.station_key AS subtitle,
        'station' AS match_label,
        station_profiles.station_key || ' ' || station_profiles.station_name AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        station_profiles.station_key,
        NULL AS service_key,
        CASE
          WHEN UPPER(station_profiles.station_key) = UPPER(?) THEN 1000
          WHEN INSTR(LOWER(station_profiles.station_key), LOWER(?)) = 1 THEN 940
          WHEN INSTR(LOWER(station_profiles.station_name), LOWER(?)) = 1 THEN 900
          ELSE 780
        END AS score,
        station_profiles.updated_at
      FROM station_profiles
      WHERE station_profiles.is_active = 1
        AND (
          INSTR(LOWER(station_profiles.station_key), LOWER(?)) > 0
          OR INSTR(LOWER(station_profiles.station_name), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(station_profiles.postcode, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(station_profiles.station_operator, '')), LOWER(?)) > 0
        )
    `,
    values: [query, query, query, query, query, query, query],
  };
}

function serviceBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'service:' || service_journeys.service_key AS result_id,
        'service' AS result_kind,
        service_journeys.service_thing_id AS thing_id,
        'rail:ServiceJourney' AS thing_type,
        COALESCE(
          service_journeys.origin_name || ' to ' || service_journeys.destination_name,
          service_journeys.service_key
        ) AS title,
        service_journeys.service_key AS subtitle,
        'service' AS match_label,
        service_journeys.service_key || ' ' ||
          COALESCE(service_journeys.rid, '') || ' ' ||
          COALESCE(service_journeys.uid, '') || ' ' ||
          COALESCE(service_journeys.train_id, '') || ' ' ||
          COALESCE(service_journeys.origin_name, '') || ' ' ||
          COALESCE(service_journeys.destination_name, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        service_journeys.service_key,
        CASE
          WHEN service_journeys.service_key = ? THEN 960
          WHEN INSTR(LOWER(service_journeys.service_key), LOWER(?)) = 1 THEN 880
          ELSE 720
        END AS score,
        service_journeys.updated_at
      FROM service_journeys
      WHERE INSTR(LOWER(service_journeys.service_key), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_journeys.rid, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_journeys.uid, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_journeys.train_id, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_journeys.origin_name, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_journeys.destination_name, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_journeys.status, '')), LOWER(?)) > 0
    `,
    values: [query, query, query, query, query, query, query, query, query],
  };
}

function operatorBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'operator:' || operators.toc_code AS result_id,
        'operator' AS result_kind,
        operators.operator_thing_id AS thing_id,
        'rail:Operator' AS thing_type,
        operators.toc_name AS title,
        operators.toc_code AS subtitle,
        'operator' AS match_label,
        operators.toc_code || ' ' || operators.toc_name AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        CASE
          WHEN UPPER(operators.toc_code) = UPPER(?) THEN 930
          WHEN INSTR(LOWER(operators.toc_name), LOWER(?)) = 1 THEN 850
          ELSE 680
        END AS score,
        operators.updated_at
      FROM operators
      WHERE operators.is_active = 1
        AND (
          INSTR(LOWER(operators.toc_code), LOWER(?)) > 0
          OR INSTR(LOWER(operators.toc_name), LOWER(?)) > 0
        )
    `,
    values: [query, query, query, query],
  };
}

function networkIncidentBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'incident:' || network_incidents.incident_id AS result_id,
        'incident' AS result_kind,
        network_incidents.incident_thing_id AS thing_id,
        'rail:NetworkIncident' AS thing_type,
        COALESCE(network_incidents.summary, network_incidents.incident_id) AS title,
        'Network incident' AS subtitle,
        'incident' AS match_label,
        COALESCE(network_incidents.summary, '') || ' ' ||
          COALESCE(network_incidents.description_html, '') || ' ' ||
          COALESCE(network_incidents.routes_affected_html, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        650 AS score,
        network_incidents.updated_at
      FROM network_incidents
      WHERE network_incidents.is_active = 1
        AND (
          INSTR(LOWER(network_incidents.incident_id), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(network_incidents.summary, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(network_incidents.description_html, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(network_incidents.routes_affected_html, '')), LOWER(?)) > 0
        )
    `,
    values: [query, query, query, query],
  };
}

function operatorDisruptionBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'operator-disruption:' || operator_disruptions.toc_code || ':' || operator_disruptions.disruption_id AS result_id,
        'operator_disruption' AS result_kind,
        operator_disruptions.disruption_thing_id AS thing_id,
        'rail:OperatorDisruption' AS thing_type,
        COALESCE(operator_disruptions.detail, operator_disruptions.disruption_id) AS title,
        operator_disruptions.toc_code AS subtitle,
        'operator disruption' AS match_label,
        operator_disruptions.disruption_id || ' ' || COALESCE(operator_disruptions.detail, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        620 AS score,
        operator_disruptions.updated_at
      FROM operator_disruptions
      WHERE INSTR(LOWER(operator_disruptions.disruption_id), LOWER(?)) > 0
        OR INSTR(LOWER(operator_disruptions.toc_code), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(operator_disruptions.detail, '')), LOWER(?)) > 0
    `,
    values: [query, query, query],
  };
}

function stationDisruptionBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'station-disruption:' || station_disruptions.station_key || ':' || station_disruptions.disruption_id AS result_id,
        'station_disruption' AS result_kind,
        station_disruptions.disruption_thing_id AS thing_id,
        'rail:StationDisruption' AS thing_type,
        COALESCE(station_disruptions.description, station_disruptions.disruption_id) AS title,
        station_disruptions.station_key AS subtitle,
        'station disruption' AS match_label,
        station_disruptions.disruption_id || ' ' ||
          COALESCE(station_disruptions.category, '') || ' ' ||
          COALESCE(station_disruptions.severity, '') || ' ' ||
          COALESCE(station_disruptions.description, '') || ' ' ||
          COALESCE(station_disruptions.message_html, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        station_disruptions.station_key,
        NULL AS service_key,
        640 AS score,
        station_disruptions.updated_at
      FROM station_disruptions
      WHERE station_disruptions.is_active = 1
        AND (
          INSTR(LOWER(station_disruptions.station_key), LOWER(?)) > 0
          OR INSTR(LOWER(station_disruptions.disruption_id), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(station_disruptions.category, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(station_disruptions.severity, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(station_disruptions.description, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(station_disruptions.message_html, '')), LOWER(?)) > 0
        )
    `,
    values: [query, query, query, query, query, query],
  };
}

function stationMessageBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'station-message:' || station_messages.station_key || ':' || station_messages.message_hash AS result_id,
        'station_message' AS result_kind,
        station_messages.message_thing_id AS thing_id,
        'rail:StationMessage' AS thing_type,
        COALESCE(station_messages.category, station_messages.message_hash) AS title,
        station_messages.station_key AS subtitle,
        'station message' AS match_label,
        station_messages.message_hash || ' ' ||
          COALESCE(station_messages.category, '') || ' ' ||
          COALESCE(station_messages.severity, '') || ' ' ||
          station_messages.message_html AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        station_messages.station_key,
        NULL AS service_key,
        630 AS score,
        station_messages.updated_at
      FROM station_messages
      WHERE INSTR(LOWER(station_messages.station_key), LOWER(?)) > 0
        OR INSTR(LOWER(station_messages.message_hash), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(station_messages.category, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(station_messages.severity, '')), LOWER(?)) > 0
        OR INSTR(LOWER(station_messages.message_html), LOWER(?)) > 0
    `,
    values: [query, query, query, query, query],
  };
}

function serviceFormationBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'formation:' || service_formations.service_key || ':' || service_formations.formation_index AS result_id,
        'service_formation' AS result_kind,
        service_formations.formation_thing_id AS thing_id,
        'rail:ServiceFormation' AS thing_type,
        COALESCE(service_formations.loading_category_name, 'Service formation') AS title,
        service_formations.service_key AS subtitle,
        'formation' AS match_label,
        service_formations.service_key || ' ' ||
          COALESCE(service_formations.tiploc, '') || ' ' ||
          COALESCE(service_formations.loading_category_code, '') || ' ' ||
          COALESCE(service_formations.loading_category_name, '') || ' ' ||
          COALESCE(service_formations.source, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        service_formations.service_key,
        600 AS score,
        service_formations.updated_at
      FROM service_formations
      WHERE INSTR(LOWER(service_formations.service_key), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_formations.tiploc, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_formations.loading_category_code, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_formations.loading_category_name, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(service_formations.source, '')), LOWER(?)) > 0
    `,
    values: [query, query, query, query, query],
  };
}

function loadingCategoryBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'loading-category:' || loading_categories.category_code AS result_id,
        'loading_category' AS result_kind,
        loading_categories.loading_category_thing_id AS thing_id,
        'rail:LoadingCategory' AS thing_type,
        COALESCE(loading_categories.category_name, loading_categories.category_code) AS title,
        loading_categories.category_code AS subtitle,
        'loading category' AS match_label,
        loading_categories.category_code || ' ' ||
          COALESCE(loading_categories.category_name, '') || ' ' ||
          COALESCE(loading_categories.typical_description, '') || ' ' ||
          COALESCE(loading_categories.expected_description, '') || ' ' ||
          COALESCE(loading_categories.definition, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        610 AS score,
        loading_categories.updated_at
      FROM loading_categories
      WHERE loading_categories.is_active = 1
        AND (
          INSTR(LOWER(loading_categories.category_code), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(loading_categories.category_name, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(loading_categories.typical_description, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(loading_categories.expected_description, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(loading_categories.definition, '')), LOWER(?)) > 0
        )
    `,
    values: [query, query, query, query, query],
  };
}

function reasonCodeBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'reason-code:' || reason_codes.reason_code AS result_id,
        'reason_code' AS result_kind,
        reason_codes.reason_thing_id AS thing_id,
        'rail:ReasonCode' AS thing_type,
        COALESCE(reason_codes.late_reason, reason_codes.cancellation_reason, reason_codes.reason_code) AS title,
        reason_codes.reason_code AS subtitle,
        'reason code' AS match_label,
        reason_codes.reason_code || ' ' ||
          COALESCE(reason_codes.late_reason, '') || ' ' ||
          COALESCE(reason_codes.cancellation_reason, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        610 AS score,
        reason_codes.updated_at
      FROM reason_codes
      WHERE reason_codes.is_active = 1
        AND (
          INSTR(LOWER(reason_codes.reason_code), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(reason_codes.late_reason, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(reason_codes.cancellation_reason, '')), LOWER(?)) > 0
        )
    `,
    values: [query, query, query],
  };
}

function sourceInstanceBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'source-instance:' || source_instances.source_instance_id AS result_id,
        'source_instance' AS result_kind,
        source_instances.source_instance_thing_id AS thing_id,
        'rail:SourceInstance' AS thing_type,
        source_instances.source_instance_name AS title,
        source_instances.source_instance_id AS subtitle,
        'source instance' AS match_label,
        source_instances.source_instance_id || ' ' || source_instances.source_instance_name AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        590 AS score,
        source_instances.updated_at
      FROM source_instances
      WHERE source_instances.is_active = 1
        AND (
          INSTR(LOWER(source_instances.source_instance_id), LOWER(?)) > 0
          OR INSTR(LOWER(source_instances.source_instance_name), LOWER(?)) > 0
        )
    `,
    values: [query, query],
  };
}

function trainRunBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'train-run:' || train_movements.train_run_key AS result_id,
        'train_run' AS result_kind,
        train_movements.train_run_thing_id AS thing_id,
        'rail:TrainRun' AS thing_type,
        train_movements.train_run_key AS title,
        MAX(COALESCE(train_movements.service_key, train_movements.train_id, train_movements.train_uid)) AS subtitle,
        'train run' AS match_label,
        train_movements.train_run_key || ' ' ||
          COALESCE(train_movements.train_id, '') || ' ' ||
          COALESCE(train_movements.train_uid, '') || ' ' ||
          COALESCE(train_movements.toc, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        MAX(train_movements.service_key) AS service_key,
        580 AS score,
        MAX(train_movements.updated_at) AS updated_at
      FROM train_movements
      WHERE INSTR(LOWER(train_movements.train_run_key), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.train_id, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.train_uid, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.toc, '')), LOWER(?)) > 0
      GROUP BY train_movements.train_run_key, train_movements.train_run_thing_id
    `,
    values: [query, query, query, query],
  };
}

function trainMovementBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'train-movement:' || train_movements.train_run_key || ':' || train_movements.movement_index AS result_id,
        'train_movement' AS result_kind,
        train_movements.movement_thing_id AS thing_id,
        'rail:TrainMovement' AS thing_type,
        COALESCE(train_movements.event_type, train_movements.planned_event_type, 'Train movement') AS title,
        train_movements.train_run_key AS subtitle,
        'train movement' AS match_label,
        train_movements.train_run_key || ' ' ||
          COALESCE(train_movements.train_id, '') || ' ' ||
          COALESCE(train_movements.train_uid, '') || ' ' ||
          COALESCE(train_movements.toc, '') || ' ' ||
          COALESCE(train_movements.stanox, '') || ' ' ||
          COALESCE(train_movements.reporting_stanox, '') || ' ' ||
          COALESCE(train_movements.platform, '') || ' ' ||
          COALESCE(train_movements.event_type, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        train_movements.service_key,
        570 AS score,
        train_movements.updated_at
      FROM train_movements
      WHERE INSTR(LOWER(train_movements.train_run_key), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.train_id, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.train_uid, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.toc, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.stanox, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.reporting_stanox, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.platform, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.event_type, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(train_movements.planned_event_type, '')), LOWER(?)) > 0
    `,
    values: [query, query, query, query, query, query, query, query, query],
  };
}

function classBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        ontology_classes.class_id AS result_id,
        'ontology_class' AS result_kind,
        NULL AS thing_id,
        NULL AS thing_type,
        ontology_classes.label AS title,
        ontology_classes.class_id AS subtitle,
        'class' AS match_label,
        ontology_classes.class_id || ' ' || ontology_classes.label || ' ' ||
          COALESCE(ontology_classes.description, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        CASE
          WHEN ontology_classes.class_id = ? THEN 760
          WHEN INSTR(LOWER(ontology_classes.label), LOWER(?)) = 1 THEN 690
          ELSE 520
        END AS score,
        ontology_classes.updated_at
      FROM ontology_classes
      WHERE INSTR(LOWER(ontology_classes.class_id), LOWER(?)) > 0
        OR INSTR(LOWER(ontology_classes.label), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(ontology_classes.description, '')), LOWER(?)) > 0
    `,
    values: [query, query, query, query, query],
  };
}

function propertyBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        ontology_properties.property_id AS result_id,
        'ontology_property' AS result_kind,
        NULL AS thing_id,
        NULL AS thing_type,
        ontology_properties.label AS title,
        ontology_properties.property_id AS subtitle,
        'predicate' AS match_label,
        ontology_properties.property_id || ' ' || ontology_properties.label || ' ' ||
          COALESCE(ontology_properties.description, '') AS match_value,
        ontology_properties.property_id AS predicate_id,
        ontology_properties.label AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        CASE
          WHEN ontology_properties.property_id = ? THEN 820
          WHEN INSTR(LOWER(ontology_properties.label), LOWER(?)) = 1 THEN 760
          ELSE 560
        END AS score,
        ontology_properties.updated_at
      FROM ontology_properties
      WHERE INSTR(LOWER(ontology_properties.property_id), LOWER(?)) > 0
        OR INSTR(LOWER(ontology_properties.label), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(ontology_properties.description, '')), LOWER(?)) > 0
    `,
    values: [query, query, query, query, query],
  };
}

function thingBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'thing:' || things.thing_id AS result_id,
        ${thingKindSql("things.thing_type")} AS result_kind,
        things.thing_id,
        things.thing_type,
        COALESCE(things.preferred_label, things.thing_id) AS title,
        things.thing_type AS subtitle,
        'thing' AS match_label,
        things.thing_id || ' ' || things.thing_type || ' ' ||
          COALESCE(things.preferred_label, '') || ' ' ||
          COALESCE(things.disambiguation_hint, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        CASE
          WHEN things.thing_id = ? THEN 740
          WHEN INSTR(LOWER(COALESCE(things.preferred_label, '')), LOWER(?)) = 1 THEN 660
          ELSE 500
        END AS score,
        things.updated_at
      FROM things
      WHERE things.is_active = 1
        AND (
          INSTR(LOWER(things.thing_id), LOWER(?)) > 0
          OR INSTR(LOWER(things.thing_type), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(things.preferred_label, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(things.disambiguation_hint, '')), LOWER(?)) > 0
        )
    `,
    values: [query, query, query, query, query, query],
  };
}

function identifierBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'identifier:' || identifiers.identifier_scheme || ':' || identifiers.identifier_value AS result_id,
        ${thingKindSql("things.thing_type")} AS result_kind,
        things.thing_id,
        things.thing_type,
        COALESCE(things.preferred_label, things.thing_id) AS title,
        identifiers.identifier_scheme || ': ' || identifiers.identifier_value AS subtitle,
        identifiers.identifier_scheme AS match_label,
        identifiers.identifier_value AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        CASE
          WHEN identifiers.identifier_value = ? THEN 860
          WHEN INSTR(LOWER(identifiers.identifier_value), LOWER(?)) = 1 THEN 790
          ELSE 620
        END AS score,
        things.updated_at
      FROM thing_identifiers identifiers
      INNER JOIN things ON things.thing_id = identifiers.thing_id
      WHERE things.is_active = 1
        AND (
          INSTR(LOWER(identifiers.identifier_scheme), LOWER(?)) > 0
          OR INSTR(LOWER(identifiers.identifier_value), LOWER(?)) > 0
        )
    `,
    values: [query, query, query, query],
  };
}

function labelBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'label:' || labels.thing_id || ':' || labels.label_kind || ':' || labels.label AS result_id,
        ${thingKindSql("things.thing_type")} AS result_kind,
        things.thing_id,
        things.thing_type,
        COALESCE(things.preferred_label, labels.label, things.thing_id) AS title,
        labels.label_kind AS subtitle,
        labels.label_kind AS match_label,
        labels.label AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        CASE
          WHEN LOWER(labels.label) = LOWER(?) THEN 800
          WHEN INSTR(LOWER(labels.label), LOWER(?)) = 1 THEN 720
          ELSE 590
        END AS score,
        things.updated_at
      FROM thing_labels labels
      INNER JOIN things ON things.thing_id = labels.thing_id
      WHERE things.is_active = 1
        AND INSTR(LOWER(labels.label), LOWER(?)) > 0
    `,
    values: [query, query, query],
  };
}

function classAssertionBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'class-assertion:' || assertions.thing_id || ':' || assertions.class_id AS result_id,
        ${thingKindSql("things.thing_type")} AS result_kind,
        things.thing_id,
        things.thing_type,
        COALESCE(things.preferred_label, things.thing_id) AS title,
        COALESCE(classes.label, assertions.class_id) AS subtitle,
        'class' AS match_label,
        assertions.class_id || ' ' || COALESCE(classes.label, '') AS match_value,
        NULL AS predicate_id,
        NULL AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        560 AS score,
        things.updated_at
      FROM thing_class_assertions assertions
      INNER JOIN things ON things.thing_id = assertions.thing_id
      LEFT JOIN ontology_classes classes ON classes.class_id = assertions.class_id
      WHERE things.is_active = 1
        AND (
          INSTR(LOWER(assertions.class_id), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(classes.label, '')), LOWER(?)) > 0
        )
    `,
    values: [query, query],
  };
}

function tripleBranch(query: string): SearchBranch {
  return {
    sql: `
      SELECT
        'triple:' || triples.triple_id AS result_id,
        ${thingKindSql("subject_things.thing_type")} AS result_kind,
        subject_things.thing_id,
        subject_things.thing_type,
        COALESCE(subject_things.preferred_label, subject_things.thing_id) AS title,
        COALESCE(properties.label, triples.predicate_id) AS subtitle,
        COALESCE(properties.label, triples.predicate_id) AS match_label,
        COALESCE(object_things.preferred_label, triples.object_thing_id, triples.object_literal) AS match_value,
        triples.predicate_id,
        properties.label AS predicate_label,
        NULL AS station_key,
        NULL AS service_key,
        CASE
          WHEN triples.predicate_id = ? THEN 700
          WHEN LOWER(COALESCE(properties.label, '')) = LOWER(?) THEN 680
          ELSE 540
        END AS score,
        triples.updated_at
      FROM ontology_triples triples
      INNER JOIN things subject_things ON subject_things.thing_id = triples.subject_thing_id
      LEFT JOIN ontology_properties properties ON properties.property_id = triples.predicate_id
      LEFT JOIN things object_things ON object_things.thing_id = triples.object_thing_id
      WHERE triples.valid_to IS NULL
        AND subject_things.is_active = 1
        AND (
          INSTR(LOWER(triples.predicate_id), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(properties.label, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(object_things.preferred_label, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(triples.object_thing_id, '')), LOWER(?)) > 0
          OR INSTR(LOWER(COALESCE(triples.object_literal, '')), LOWER(?)) > 0
        )
    `,
    values: [query, query, query, query, query, query, query],
  };
}

function thingKindSql(thingTypeExpression: string): string {
  return `
    CASE ${thingTypeExpression}
      WHEN 'rail:Station' THEN 'station'
      WHEN 'rail:ServiceJourney' THEN 'service'
      WHEN 'rail:Operator' THEN 'operator'
      WHEN 'rail:NetworkIncident' THEN 'incident'
      WHEN 'rail:OperatorDisruption' THEN 'operator_disruption'
      WHEN 'rail:StationDisruption' THEN 'station_disruption'
      WHEN 'rail:StationMessage' THEN 'station_message'
      WHEN 'rail:ServiceFormation' THEN 'service_formation'
      WHEN 'rail:LoadingCategory' THEN 'loading_category'
      WHEN 'rail:ReasonCode' THEN 'reason_code'
      WHEN 'rail:SourceInstance' THEN 'source_instance'
      WHEN 'rail:TrainRun' THEN 'train_run'
      WHEN 'rail:TrainMovement' THEN 'train_movement'
      ELSE 'ontology_thing'
    END
  `;
}

function searchLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_SEARCH_LIMIT), 1), MAX_SEARCH_LIMIT);
}

function compareSearchText(left: OntologySearchResult, right: OntologySearchResult): number {
  return (
    left.title.localeCompare(right.title, "en-GB") ||
    left.result_id.localeCompare(right.result_id, "en-GB")
  );
}

function dedupeSearchResults(results: OntologySearchResult[]): OntologySearchResult[] {
  const seen = new Set<string>();
  const deduped: OntologySearchResult[] = [];

  for (const result of results) {
    const key = result.thing_id
      ? `thing:${result.thing_id}`
      : `${result.result_kind}:${result.result_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}
