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
  resultKind?: OntologySearchResultKind;
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
  const branches = searchBranches(query, options.resultKind);
  const branchLimit = Math.max(limit, 4);
  const branchResults = await Promise.all(
    branches.map((branch) => searchBranchResults(db, branch, branchLimit)),
  );
  const results = branchResults
    .flat()
    .sort(
      (left, right) =>
        compareStationPriority(left, right) ||
        right.score - left.score ||
        compareSearchText(left, right),
    );

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

function searchBranches(
  query: string,
  resultKind: OntologySearchResultKind | undefined,
): SearchBranch[] {
  const branches =
    resultKind === "station"
      ? stationSearchBranches(query)
      : [
          classBranch(query),
          propertyBranch(query),
          thingBranch(query),
          identifierBranch(query),
          labelBranch(query),
          classAssertionBranch(query),
          tripleBranch(query),
        ];

  if (!resultKind) return branches;

  return branches.map((branch) => resultKindBranch(branch, resultKind));
}

function stationSearchBranches(query: string): SearchBranch[] {
  return [
    thingBranch(query),
    identifierBranch(query),
    labelBranch(query),
    classAssertionBranch(query),
    tripleBranch(query),
  ];
}

function resultKindBranch(
  branch: SearchBranch,
  resultKind: OntologySearchResultKind,
): SearchBranch {
  return {
    sql: `
      SELECT *
      FROM (${branch.sql}) search_results
      WHERE search_results.result_kind = ?
    `,
    values: [...branch.values, resultKind],
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
        ${stationKeySql("things.thing_id", "things.thing_type")} AS station_key,
        ${serviceKeySql("things.thing_id", "things.thing_type")} AS service_key,
        CASE
          WHEN things.thing_type = 'rail:Station' AND things.thing_id = ? THEN 1040
          WHEN things.thing_type = 'rail:Station'
            AND INSTR(LOWER(COALESCE(things.preferred_label, '')), LOWER(?)) = 1 THEN 1000
          WHEN things.thing_type = 'rail:Station' THEN 900
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
    values: [query, query, query, query, query, query, query, query],
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
        ${stationKeySql("things.thing_id", "things.thing_type")} AS station_key,
        ${serviceKeySql("things.thing_id", "things.thing_type")} AS service_key,
        CASE
          WHEN things.thing_type = 'rail:Station'
            AND identifiers.identifier_scheme = 'rail:crs'
            AND UPPER(identifiers.identifier_value) = UPPER(?) THEN 1100
          WHEN things.thing_type = 'rail:Station'
            AND identifiers.identifier_scheme = 'rail:crs'
            AND INSTR(LOWER(identifiers.identifier_value), LOWER(?)) = 1 THEN 1060
          WHEN things.thing_type = 'rail:Station' THEN 900
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
    values: [query, query, query, query, query, query],
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
        ${stationKeySql("things.thing_id", "things.thing_type")} AS station_key,
        ${serviceKeySql("things.thing_id", "things.thing_type")} AS service_key,
        CASE
          WHEN things.thing_type = 'rail:Station' AND LOWER(labels.label) = LOWER(?) THEN 1080
          WHEN things.thing_type = 'rail:Station'
            AND INSTR(LOWER(labels.label), LOWER(?)) = 1 THEN 1020
          WHEN things.thing_type = 'rail:Station' THEN 900
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
    values: [query, query, query, query, query],
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
        ${stationKeySql("things.thing_id", "things.thing_type")} AS station_key,
        ${serviceKeySql("things.thing_id", "things.thing_type")} AS service_key,
        CASE
          WHEN things.thing_type = 'rail:Station' THEN 900
          ELSE 560
        END AS score,
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
        ${stationKeySql("subject_things.thing_id", "subject_things.thing_type")} AS station_key,
        ${serviceKeySql("subject_things.thing_id", "subject_things.thing_type")} AS service_key,
        CASE
          WHEN subject_things.thing_type = 'rail:Station' THEN 900
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

function stationKeySql(thingIdExpression: string, thingTypeExpression: string): string {
  return `
    CASE
      WHEN ${thingTypeExpression} = 'rail:Station' THEN (
        SELECT station_identifiers.identifier_value
        FROM thing_identifiers station_identifiers
        WHERE station_identifiers.thing_id = ${thingIdExpression}
          AND station_identifiers.identifier_scheme = 'rail:crs'
        ORDER BY station_identifiers.is_primary DESC, station_identifiers.identifier_value ASC
        LIMIT 1
      )
      ELSE NULL
    END
  `;
}

function serviceKeySql(thingIdExpression: string, thingTypeExpression: string): string {
  return `
    CASE
      WHEN ${thingTypeExpression} = 'rail:ServiceJourney' THEN (
        SELECT service_identifiers.identifier_value
        FROM thing_identifiers service_identifiers
        WHERE service_identifiers.thing_id = ${thingIdExpression}
          AND service_identifiers.identifier_scheme = 'rail:service-key'
        ORDER BY service_identifiers.is_primary DESC, service_identifiers.identifier_value ASC
        LIMIT 1
      )
      ELSE NULL
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

function compareStationPriority(left: OntologySearchResult, right: OntologySearchResult): number {
  if (left.result_kind === right.result_kind) return 0;
  if (left.result_kind === "station") return -1;
  if (right.result_kind === "station") return 1;
  return 0;
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
