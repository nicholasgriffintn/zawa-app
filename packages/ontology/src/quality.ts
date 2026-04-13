import type { D1DatabaseLike } from "@zawa/db/d1";
import { normalisePageOptions, type PageOptions } from "./paging";

type OntologyConstraintKind =
  | "required_primary_identifier"
  | "required_any_identifier"
  | "required_label"
  | "object_range_class"
  | "datatype_range"
  | "decimal_min"
  | "decimal_max"
  | "current_datatype_single_value"
  | "required_property_definition"
  | "station_profile_label_consistency"
  | "source_event_presence";

type OntologyQualitySeverity = "error" | "warning";

interface OntologyConstraintRow {
  constraint_id: string;
  class_id: string | null;
  property_id: string | null;
  constraint_kind: OntologyConstraintKind;
  constraint_value: string;
  severity: OntologyQualitySeverity;
  updated_at: string;
}

export interface OntologyQualitySummary {
  run_key: string | null;
  checked_at: string | null;
  violation_count: number;
  error_count: number;
  warning_count: number;
}

export interface OntologyQualityViolation {
  run_key: string;
  violation_id: string;
  constraint_id: string;
  severity: OntologyQualitySeverity;
  thing_id: string | null;
  property_id: string | null;
  violation_kind: string;
  message: string;
  observed_value: string | null;
  checked_at: string;
}

export interface OntologyQualityReport {
  summary: OntologyQualitySummary;
  violations: OntologyQualityViolation[];
}

export interface OntologyQualityViolationPage {
  items: OntologyQualityViolation[];
  total: number;
  limit: number;
  offset: number;
  summary: OntologyQualitySummary;
}

export interface OntologyQualityReportOptions extends PageOptions {
  query?: string;
  severity?: OntologyQualitySeverity;
  kind?: string;
}

export async function getOntologyQualityReport(
  db: D1DatabaseLike,
  options: OntologyQualityReportOptions = {},
): Promise<OntologyQualityViolationPage> {
  const page = normalisePageOptions(options);
  const summary = await getOntologyQualitySummary(db);
  if (!summary.run_key) return { ...page, summary, total: 0, items: [] };
  const filter = qualityReportFilter(summary.run_key, options);

  const [totalRow, violations] = await Promise.all([
    db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM ontology_quality_violations
        WHERE ${filter.whereSql}
      `,
      )
      .bind(...filter.values)
      .first<{ count: number }>(),
    db
      .prepare(
        `
        SELECT
          run_key,
          violation_id,
          constraint_id,
          severity,
          thing_id,
          property_id,
          violation_kind,
          message,
          observed_value,
          checked_at
        FROM ontology_quality_violations
        WHERE ${filter.whereSql}
        ORDER BY
          CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
          constraint_id,
          thing_id,
          violation_id
        LIMIT ? OFFSET ?
      `,
      )
      .bind(...filter.values, page.limit, page.offset)
      .all<OntologyQualityViolation>(),
  ]);

  return {
    ...page,
    summary,
    total: totalRow?.count ?? 0,
    items: violations.results,
  };
}

function qualityReportFilter(
  runKey: string,
  options: OntologyQualityReportOptions,
): { whereSql: string; values: unknown[] } {
  const conditions = ["run_key = ?"];
  const values: unknown[] = [runKey];
  const query = options.query?.trim();
  const kind = options.kind?.trim();

  if (options.severity) {
    conditions.push("severity = ?");
    values.push(options.severity);
  }

  if (kind) {
    conditions.push("violation_kind = ?");
    values.push(kind);
  }

  if (query) {
    conditions.push(`
      (
        INSTR(LOWER(violation_id), LOWER(?)) > 0
        OR INSTR(LOWER(constraint_id), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(thing_id, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(property_id, '')), LOWER(?)) > 0
        OR INSTR(LOWER(violation_kind), LOWER(?)) > 0
        OR INSTR(LOWER(message), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(observed_value, '')), LOWER(?)) > 0
      )
    `);
    values.push(query, query, query, query, query, query, query);
  }

  return { whereSql: conditions.join(" AND "), values };
}

export async function validateOntologyQuality(
  db: D1DatabaseLike,
  checkedAt = new Date().toISOString(),
): Promise<OntologyQualityReport> {
  const runKey = qualityRunKey(checkedAt);
  const constraints = await db
    .prepare(
      `
      SELECT *
      FROM ontology_constraints
      ORDER BY constraint_id
    `,
    )
    .all<OntologyConstraintRow>();
  const violations: OntologyQualityViolation[] = [];

  for (const constraint of constraints.results) {
    violations.push(...(await validateConstraint(db, constraint, runKey, checkedAt)));
  }

  await persistOntologyQualityReport(db, runKey, violations, checkedAt);

  return {
    summary: qualitySummaryFromViolations(violations, runKey, checkedAt),
    violations,
  };
}

export async function getOntologyQualitySummary(
  db: D1DatabaseLike,
): Promise<OntologyQualitySummary> {
  const run = await db
    .prepare(
      `
      SELECT run_key, checked_at, violation_count, error_count, warning_count
      FROM ontology_quality_runs
      ORDER BY checked_at DESC, run_key DESC
      LIMIT 1
    `,
    )
    .first<OntologyQualitySummary>();

  if (run) return run;

  return {
    run_key: null,
    checked_at: null,
    violation_count: 0,
    error_count: 0,
    warning_count: 0,
  };
}

async function validateConstraint(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  switch (constraint.constraint_kind) {
    case "required_primary_identifier":
      return validateRequiredPrimaryIdentifier(db, constraint, runKey, checkedAt);
    case "required_any_identifier":
      return validateRequiredAnyIdentifier(db, constraint, runKey, checkedAt);
    case "required_label":
      return validateRequiredLabel(db, constraint, runKey, checkedAt);
    case "object_range_class":
      return validateObjectRangeClass(db, constraint, runKey, checkedAt);
    case "datatype_range":
      return validateDatatypeRange(db, constraint, runKey, checkedAt);
    case "decimal_min":
      return validateDecimalBoundary(db, constraint, runKey, checkedAt, "min");
    case "decimal_max":
      return validateDecimalBoundary(db, constraint, runKey, checkedAt, "max");
    case "current_datatype_single_value":
      return validateCurrentDatatypeSingleValue(db, constraint, runKey, checkedAt);
    case "required_property_definition":
      return validateRequiredPropertyDefinition(db, constraint, runKey, checkedAt);
    case "station_profile_label_consistency":
      return validateStationProfileLabelConsistency(db, constraint, runKey, checkedAt);
    case "source_event_presence":
      return validateSourceEventPresence(db, constraint, runKey, checkedAt);
    default:
      return [
        qualityViolation({
          constraint,
          runKey,
          checkedAt,
          thingId: null,
          suffix: "unsupported",
          kind: "unsupported_constraint_kind",
          observedValue: constraint.constraint_kind,
          message: `${constraint.constraint_id} uses unsupported constraint kind ${constraint.constraint_kind}`,
        }),
      ];
  }
}

async function validateRequiredAnyIdentifier(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  if (!constraint.class_id) return [];
  const rows = await db
    .prepare(
      `
      SELECT thing_id, preferred_label
      FROM things
      WHERE thing_type = ?
        AND is_active = 1
        AND NOT EXISTS (
          SELECT 1
          FROM thing_identifiers identifiers
          WHERE identifiers.thing_id = things.thing_id
        )
      ORDER BY thing_id
    `,
    )
    .bind(constraint.class_id)
    .all<{ thing_id: string; preferred_label: string | null }>();

  return rows.results.map((row) =>
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: row.thing_id,
      kind: "missing_identifier",
      observedValue: row.preferred_label,
      message: `${row.thing_id} is missing an identifier`,
    }),
  );
}

async function persistOntologyQualityReport(
  db: D1DatabaseLike,
  runKey: string,
  violations: OntologyQualityViolation[],
  checkedAt: string,
): Promise<void> {
  const summary = qualitySummaryFromViolations(violations, runKey, checkedAt);
  await db
    .prepare(
      `
      INSERT INTO ontology_quality_runs (
        run_key, checked_at, violation_count, error_count, warning_count
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(run_key) DO UPDATE SET
        checked_at = excluded.checked_at,
        violation_count = excluded.violation_count,
        error_count = excluded.error_count,
        warning_count = excluded.warning_count
    `,
    )
    .bind(
      summary.run_key,
      summary.checked_at,
      summary.violation_count,
      summary.error_count,
      summary.warning_count,
    )
    .run();

  const existingRows = await db
    .prepare(
      `
      SELECT
        run_key,
        violation_id,
        constraint_id,
        severity,
        thing_id,
        property_id,
        violation_kind,
        message,
        observed_value,
        checked_at
      FROM ontology_quality_violations
      WHERE run_key = ?
    `,
    )
    .bind(runKey)
    .all<OntologyQualityViolation>();
  const existingById = new Map(existingRows.results.map((row) => [row.violation_id, row]));
  const currentIds = new Set(violations.map((violation) => violation.violation_id));

  for (const violation of violations) {
    const existing = existingById.get(violation.violation_id);
    if (!existing) {
      await insertOntologyQualityViolation(db, violation);
      continue;
    }

    if (!sameViolation(existing, violation)) {
      await updateOntologyQualityViolation(db, violation);
    }
  }

  for (const existing of existingRows.results) {
    if (currentIds.has(existing.violation_id)) continue;
    await db
      .prepare("DELETE FROM ontology_quality_violations WHERE run_key = ? AND violation_id = ?")
      .bind(runKey, existing.violation_id)
      .run();
  }
}

async function insertOntologyQualityViolation(
  db: D1DatabaseLike,
  violation: OntologyQualityViolation,
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO ontology_quality_violations (
        run_key,
        violation_id,
        constraint_id,
        severity,
        thing_id,
        property_id,
        violation_kind,
        message,
        observed_value,
        checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      violation.run_key,
      violation.violation_id,
      violation.constraint_id,
      violation.severity,
      violation.thing_id,
      violation.property_id,
      violation.violation_kind,
      violation.message,
      violation.observed_value,
      violation.checked_at,
    )
    .run();
}

async function updateOntologyQualityViolation(
  db: D1DatabaseLike,
  violation: OntologyQualityViolation,
): Promise<void> {
  await db
    .prepare(
      `
      UPDATE ontology_quality_violations
      SET
        constraint_id = ?,
        severity = ?,
        thing_id = ?,
        property_id = ?,
        violation_kind = ?,
        message = ?,
        observed_value = ?,
        checked_at = ?
      WHERE run_key = ? AND violation_id = ?
    `,
    )
    .bind(
      violation.constraint_id,
      violation.severity,
      violation.thing_id,
      violation.property_id,
      violation.violation_kind,
      violation.message,
      violation.observed_value,
      violation.checked_at,
      violation.run_key,
      violation.violation_id,
    )
    .run();
}

function sameViolation(current: OntologyQualityViolation, next: OntologyQualityViolation): boolean {
  return (
    current.constraint_id === next.constraint_id &&
    current.severity === next.severity &&
    current.thing_id === next.thing_id &&
    current.property_id === next.property_id &&
    current.violation_kind === next.violation_kind &&
    current.message === next.message &&
    current.observed_value === next.observed_value
  );
}

async function validateRequiredPrimaryIdentifier(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  if (!constraint.class_id) return [];
  const rows = await db
    .prepare(
      `
      SELECT thing_id, preferred_label
      FROM things
      WHERE thing_type = ?
        AND is_active = 1
        AND NOT EXISTS (
          SELECT 1
          FROM thing_identifiers identifiers
          WHERE identifiers.thing_id = things.thing_id
            AND identifiers.identifier_scheme = ?
            AND identifiers.is_primary = 1
        )
      ORDER BY thing_id
    `,
    )
    .bind(constraint.class_id, constraint.constraint_value)
    .all<{ thing_id: string; preferred_label: string | null }>();

  return rows.results.map((row) =>
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: row.thing_id,
      kind: "missing_primary_identifier",
      observedValue: row.preferred_label,
      message: `${row.thing_id} is missing primary identifier ${constraint.constraint_value}`,
    }),
  );
}

async function validateRequiredLabel(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  if (!constraint.class_id) return [];
  const rows = await db
    .prepare(
      `
      SELECT thing_id
      FROM things
      WHERE thing_type = ?
        AND is_active = 1
        AND (preferred_label IS NULL OR TRIM(preferred_label) = '')
      ORDER BY thing_id
    `,
    )
    .bind(constraint.class_id)
    .all<{ thing_id: string }>();

  return rows.results.map((row) =>
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: row.thing_id,
      kind: "missing_label",
      message: `${row.thing_id} is missing a preferred label`,
    }),
  );
}

async function validateObjectRangeClass(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  if (!constraint.property_id) return [];
  const rows = await db
    .prepare(
      `
      SELECT
        triples.triple_id,
        triples.subject_thing_id,
        triples.object_thing_id,
        object_things.thing_type AS object_thing_type
      FROM ontology_triples triples
      LEFT JOIN things object_things
        ON object_things.thing_id = triples.object_thing_id
      WHERE triples.valid_to IS NULL
        AND triples.predicate_id = ?
        AND triples.object_thing_id IS NOT NULL
        AND (
          object_things.thing_id IS NULL
          OR object_things.thing_type IS NOT ?
        )
      ORDER BY triples.subject_thing_id, triples.triple_id
    `,
    )
    .bind(constraint.property_id, constraint.constraint_value)
    .all<{
      triple_id: string;
      subject_thing_id: string;
      object_thing_id: string | null;
      object_thing_type: string | null;
    }>();

  return rows.results.map((row) =>
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: row.subject_thing_id,
      propertyId: constraint.property_id,
      suffix: row.triple_id,
      kind: "invalid_object_range",
      observedValue: row.object_thing_type ?? row.object_thing_id,
      message: `${constraint.property_id} from ${row.subject_thing_id} points to ${row.object_thing_type ?? "missing thing"} instead of ${constraint.constraint_value}`,
    }),
  );
}

async function validateDatatypeRange(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  if (!constraint.property_id) return [];
  const rows = await db
    .prepare(
      `
      SELECT triple_id, subject_thing_id, object_literal, object_datatype
      FROM ontology_triples
      WHERE valid_to IS NULL
        AND predicate_id = ?
        AND object_literal IS NOT NULL
        AND object_datatype IS NOT ?
      ORDER BY subject_thing_id, triple_id
    `,
    )
    .bind(constraint.property_id, constraint.constraint_value)
    .all<{
      triple_id: string;
      subject_thing_id: string;
      object_literal: string | null;
      object_datatype: string | null;
    }>();

  return rows.results.map((row) =>
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: row.subject_thing_id,
      propertyId: constraint.property_id,
      suffix: row.triple_id,
      kind: "invalid_datatype",
      observedValue: row.object_datatype,
      message: `${constraint.property_id} on ${row.subject_thing_id} has datatype ${row.object_datatype ?? "null"} instead of ${constraint.constraint_value}`,
    }),
  );
}

async function validateDecimalBoundary(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
  direction: "min" | "max",
): Promise<OntologyQualityViolation[]> {
  if (!constraint.property_id) return [];
  const boundary = Number(constraint.constraint_value);
  if (!Number.isFinite(boundary)) return [];
  const comparison = direction === "min" ? "<" : ">";
  const rows = await db
    .prepare(
      `
      SELECT triple_id, subject_thing_id, object_literal
      FROM ontology_triples
      WHERE valid_to IS NULL
        AND predicate_id = ?
        AND object_literal IS NOT NULL
        AND object_datatype = 'xsd:decimal'
        AND CAST(object_literal AS REAL) ${comparison} ?
      ORDER BY subject_thing_id, triple_id
    `,
    )
    .bind(constraint.property_id, boundary)
    .all<{
      triple_id: string;
      subject_thing_id: string;
      object_literal: string | null;
    }>();

  return rows.results.map((row) =>
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: row.subject_thing_id,
      propertyId: constraint.property_id,
      suffix: row.triple_id,
      kind: direction === "min" ? "decimal_below_minimum" : "decimal_above_maximum",
      observedValue: row.object_literal,
      message: `${constraint.property_id} on ${row.subject_thing_id} is ${row.object_literal}, outside ${direction} ${constraint.constraint_value}`,
    }),
  );
}

async function validateCurrentDatatypeSingleValue(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  if (!constraint.property_id) return [];
  const rows = await db
    .prepare(
      `
      SELECT subject_thing_id, COUNT(*) AS current_value_count, GROUP_CONCAT(object_literal, ', ') AS values_seen
      FROM ontology_triples
      WHERE valid_to IS NULL
        AND predicate_id = ?
        AND object_literal IS NOT NULL
      GROUP BY subject_thing_id
      HAVING COUNT(*) > 1
      ORDER BY subject_thing_id
    `,
    )
    .bind(constraint.property_id)
    .all<{
      subject_thing_id: string;
      current_value_count: number;
      values_seen: string | null;
    }>();

  return rows.results.map((row) =>
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: row.subject_thing_id,
      propertyId: constraint.property_id,
      kind: "multiple_current_datatype_values",
      observedValue: row.values_seen,
      message: `${constraint.property_id} on ${row.subject_thing_id} has ${row.current_value_count} current values`,
    }),
  );
}

async function validateRequiredPropertyDefinition(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  if (!constraint.property_id) return [];
  const expected = parsePropertyDefinitionConstraint(constraint.constraint_value);
  const row = await db
    .prepare(
      `
      SELECT property_kind, domain_class_id, range_class_id, range_datatype, description
      FROM ontology_properties
      WHERE property_id = ?
    `,
    )
    .bind(constraint.property_id)
    .first<{
      property_kind: string;
      domain_class_id: string | null;
      range_class_id: string | null;
      range_datatype: string | null;
      description: string | null;
    }>();

  if (!row) {
    return [
      qualityViolation({
        constraint,
        runKey,
        checkedAt,
        thingId: null,
        propertyId: constraint.property_id,
        kind: "missing_property_definition",
        message: `${constraint.property_id} is missing from ontology_properties`,
      }),
    ];
  }

  const mismatches = [
    row.property_kind === expected.kind ? null : `kind=${row.property_kind}`,
    row.domain_class_id === expected.domainClassId
      ? null
      : `domain=${row.domain_class_id ?? "null"}`,
    row.range_class_id === expected.rangeClassId
      ? null
      : `rangeClass=${row.range_class_id ?? "null"}`,
    row.range_datatype === expected.rangeDatatype
      ? null
      : `rangeDatatype=${row.range_datatype ?? "null"}`,
    row.description && row.description.trim() ? null : "description=missing",
  ].filter((value): value is string => value !== null);

  if (mismatches.length === 0) return [];

  return [
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: null,
      propertyId: constraint.property_id,
      kind: "invalid_property_definition",
      observedValue: mismatches.join("; "),
      message: `${constraint.property_id} does not match its required ontology definition`,
    }),
  ];
}

async function validateStationProfileLabelConsistency(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  const rows = await db
    .prepare(
      `
      SELECT
        station_profiles.station_thing_id,
        station_profiles.station_key,
        station_profiles.station_name,
        things.preferred_label
      FROM station_profiles
      LEFT JOIN things
        ON things.thing_id = station_profiles.station_thing_id
      WHERE station_profiles.is_active = 1
        AND station_profiles.station_name IS NOT NULL
        AND TRIM(station_profiles.station_name) != ''
        AND (
          things.thing_id IS NULL
          OR things.preferred_label IS NULL
          OR TRIM(things.preferred_label) = ''
          OR things.preferred_label IS NOT station_profiles.station_name
        )
      ORDER BY station_profiles.station_key
    `,
    )
    .all<{
      station_thing_id: string | null;
      station_key: string;
      station_name: string;
      preferred_label: string | null;
    }>();

  return rows.results.map((row) =>
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: row.station_thing_id ?? `rail:station:${row.station_key}`,
      kind: "station_label_mismatch",
      observedValue: row.preferred_label,
      message: `${row.station_key} ontology label does not match station profile name ${row.station_name}`,
    }),
  );
}

async function validateSourceEventPresence(
  db: D1DatabaseLike,
  constraint: OntologyConstraintRow,
  runKey: string,
  checkedAt: string,
): Promise<OntologyQualityViolation[]> {
  const row = await db
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM source_events) AS source_event_count,
        (
          (SELECT COUNT(*) FROM service_journeys)
          + (SELECT COUNT(*) FROM train_movements)
          + (SELECT COUNT(*) FROM network_incidents)
        ) AS operational_row_count
    `,
    )
    .first<{ source_event_count: number; operational_row_count: number }>();

  if (!row || row.source_event_count > 0 || row.operational_row_count === 0) return [];

  return [
    qualityViolation({
      constraint,
      runKey,
      checkedAt,
      thingId: null,
      suffix: "source-events",
      kind: "missing_source_events",
      observedValue: String(row.operational_row_count),
      message: `Operational data exists but source_events is empty`,
    }),
  ];
}

function qualityViolation(input: {
  constraint: OntologyConstraintRow;
  runKey: string;
  checkedAt: string;
  thingId: string | null;
  propertyId?: string | null;
  suffix?: string;
  kind: string;
  message: string;
  observedValue?: string | null;
}): OntologyQualityViolation {
  const violationSuffix = input.suffix ?? input.thingId ?? input.propertyId ?? "global";
  return {
    run_key: input.runKey,
    violation_id: `${input.constraint.constraint_id}|${violationSuffix}`,
    constraint_id: input.constraint.constraint_id,
    severity: input.constraint.severity,
    thing_id: input.thingId,
    property_id: input.propertyId ?? input.constraint.property_id,
    violation_kind: input.kind,
    message: input.message,
    observed_value: input.observedValue ?? null,
    checked_at: input.checkedAt,
  };
}

function qualitySummaryFromViolations(
  violations: OntologyQualityViolation[],
  runKey: string,
  checkedAt: string,
): OntologyQualitySummary {
  return {
    run_key: runKey,
    checked_at: checkedAt,
    violation_count: violations.length,
    error_count: violations.filter((violation) => violation.severity === "error").length,
    warning_count: violations.filter((violation) => violation.severity === "warning").length,
  };
}

function qualityRunKey(checkedAt: string): string {
  return `ontology-quality:${checkedAt}`;
}

function parsePropertyDefinitionConstraint(value: string): {
  kind: string;
  domainClassId: string | null;
  rangeClassId: string | null;
  rangeDatatype: string | null;
} {
  const [kind, domainClassId, rangeClassId, rangeDatatype] = value.split("|");
  return {
    kind,
    domainClassId: nullableConstraintPart(domainClassId),
    rangeClassId: nullableConstraintPart(rangeClassId),
    rangeDatatype: nullableConstraintPart(rangeDatatype),
  };
}

function nullableConstraintPart(value: string | undefined): string | null {
  if (!value || value === "-") return null;
  return value;
}
