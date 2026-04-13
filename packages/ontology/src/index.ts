import type { D1DatabaseLike } from "@zawa/db/d1";
import {
  getOntologyQualityReport,
  getOntologyQualitySummary,
  validateOntologyQuality,
  type OntologyQualityReport,
  type OntologyQualityReportOptions,
  type OntologyQualitySummary,
  type OntologyQualityViolationPage,
} from "./quality";
import { normalisePageOptions } from "./paging";
import { searchOntology, type OntologySearchOptions, type OntologySearchResponse } from "./search";

export { getOntologyQualityReport, validateOntologyQuality } from "./quality";
export type {
  OntologyQualityReport,
  OntologyQualityReportOptions,
  OntologyQualitySummary,
  OntologyQualityViolation,
  OntologyQualityViolationPage,
} from "./quality";
export { searchOntology } from "./search";
export type { OntologySearchOptions, OntologySearchResponse, OntologySearchResult } from "./search";

export type OntologyConstraintKind =
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

export type OntologyQualitySeverity = "error" | "warning";

export interface OntologyClass {
  class_id: string;
  label: string;
  description: string | null;
  parent_class_id: string | null;
  source_key: string;
  updated_at: string;
}

export interface OntologyProperty {
  property_id: string;
  label: string;
  description: string | null;
  property_kind: "object" | "datatype";
  domain_class_id: string | null;
  range_class_id: string | null;
  range_datatype: string | null;
  parent_property_id: string | null;
  source_key: string;
  updated_at: string;
}

export interface OntologyConstraint {
  constraint_id: string;
  class_id: string | null;
  property_id: string | null;
  constraint_kind: OntologyConstraintKind;
  constraint_value: string;
  severity: OntologyQualitySeverity;
  updated_at: string;
}

export interface OntologyStats {
  class_count: number;
  property_count: number;
  constraint_count: number;
  thing_count: number;
  triple_count: number;
  source_event_count: number;
  quality_violation_count: number;
  quality_error_count: number;
  quality_warning_count: number;
}

export interface OntologyCatalog {
  stats: OntologyStats;
  quality: OntologyQualitySummary;
  classes: OntologyClass[];
  properties: OntologyProperty[];
  constraints: OntologyConstraint[];
}

export interface OntologyIdentifier {
  identifier_scheme: string;
  identifier_value: string;
  is_primary: number;
  source_key: string;
}

export interface OntologyLabel {
  label_kind: string;
  locale: string;
  label: string;
  source_key: string;
}

export interface OntologyClassAssertion {
  class_id: string;
  class_label: string | null;
  source_key: string;
  confidence: number | null;
}

export interface OntologyThing {
  thing_id: string;
  thing_type: string;
  preferred_label: string | null;
  disambiguation_hint: string | null;
  is_active: number;
  updated_at: string;
  classes: OntologyClassAssertion[];
  identifiers: OntologyIdentifier[];
  labels: OntologyLabel[];
}

export interface OntologyTriple {
  triple_id: string;
  subject_thing_id: string;
  predicate_id: string;
  predicate_label: string | null;
  predicate_kind: "object" | "datatype" | null;
  object_thing_id: string | null;
  object_thing_type: string | null;
  object_preferred_label: string | null;
  object_literal: string | null;
  object_datatype: string | null;
  source_key: string;
  confidence: number | null;
  valid_from: string | null;
  valid_to: string | null;
  updated_at: string;
}

export interface OntologyGraph {
  rootThingIds: string[];
  things: OntologyThing[];
  triples: OntologyTriple[];
}

export interface OntologyPageOptions {
  limit?: number;
  offset?: number;
}

export interface OntologyThingPageOptions extends OntologyPageOptions {
  query?: string;
  thingType?: string;
  classId?: string;
}

export interface OntologyTriplePageOptions extends OntologyPageOptions {
  query?: string;
  predicateId?: string;
  subjectThingId?: string;
  objectThingId?: string;
}

export interface OntologyThingPage {
  items: OntologyThing[];
  total: number;
  limit: number;
  offset: number;
}

export interface OntologyTriplePage {
  items: OntologyTriple[];
  total: number;
  limit: number;
  offset: number;
}

export interface RailOntologySdk {
  getCatalog(): Promise<OntologyCatalog>;
  getGraph(
    thingIds: Array<string | null | undefined>,
    options?: OntologyGraphOptions,
  ): Promise<OntologyGraph>;
  getThingsPage(options?: OntologyThingPageOptions): Promise<OntologyThingPage>;
  getTriplesPage(options?: OntologyTriplePageOptions): Promise<OntologyTriplePage>;
  getQualityReport(options?: OntologyQualityReportOptions): Promise<OntologyQualityViolationPage>;
  search(options?: OntologySearchOptions): Promise<OntologySearchResponse>;
  validateQuality(checkedAt?: string): Promise<OntologyQualityReport>;
}

export interface OntologyGraphOptions {
  includeInbound?: boolean;
  tripleLimit?: number;
}

export function createRailOntologySdk(db: D1DatabaseLike): RailOntologySdk {
  return {
    getCatalog: () => getOntologyCatalog(db),
    getGraph: (thingIds, options) => getOntologyGraph(db, thingIds, options),
    getThingsPage: (options) => getOntologyThingsPage(db, options),
    getTriplesPage: (options) => getOntologyTriplesPage(db, options),
    getQualityReport: (options) => getOntologyQualityReport(db, options),
    search: (options) => searchOntology(db, options),
    validateQuality: (checkedAt) => validateOntologyQuality(db, checkedAt),
  };
}

export async function getOntologyCatalog(db: D1DatabaseLike): Promise<OntologyCatalog> {
  const [stats, quality, classes, properties, constraints] = await Promise.all([
    getOntologyStats(db),
    getOntologyQualitySummary(db),
    db
      .prepare(
        `
        SELECT *
        FROM ontology_classes
        ORDER BY parent_class_id IS NOT NULL, parent_class_id, class_id
      `,
      )
      .all<OntologyClass>(),
    db
      .prepare(
        `
        SELECT *
        FROM ontology_properties
        ORDER BY property_kind, property_id
      `,
      )
      .all<OntologyProperty>(),
    db
      .prepare(
        `
        SELECT *
        FROM ontology_constraints
        ORDER BY severity, constraint_kind, constraint_id
      `,
      )
      .all<OntologyConstraint>(),
  ]);

  return {
    stats,
    quality,
    classes: classes.results,
    properties: properties.results,
    constraints: constraints.results,
  };
}

export async function getOntologyGraph(
  db: D1DatabaseLike,
  thingIds: Array<string | null | undefined>,
  options: OntologyGraphOptions = {},
): Promise<OntologyGraph> {
  const rootThingIds = normaliseThingIds(thingIds);
  if (rootThingIds.length === 0) return { rootThingIds: [], things: [], triples: [] };

  const triples = await getTriplesForThings(db, rootThingIds, options);
  const linkedThingIds = normaliseThingIds([
    ...rootThingIds,
    ...triples.map((triple) => triple.subject_thing_id),
    ...triples.map((triple) => triple.object_thing_id),
  ]);
  const things = await getThings(db, linkedThingIds);
  const thingIdSet = new Set(things.map((thing) => thing.thing_id));
  const presentRootThingIds = rootThingIds.filter((thingId) => thingIdSet.has(thingId));

  return { rootThingIds: presentRootThingIds, things, triples };
}

export async function getOntologyThingsPage(
  db: D1DatabaseLike,
  options: OntologyThingPageOptions = {},
): Promise<OntologyThingPage> {
  const page = normalisePageOptions(options);
  const filter = thingPageFilter(options);
  const [totalRow, thingRows] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS count FROM things WHERE ${filter.whereSql}`)
      .bind(...filter.values)
      .first<{ count: number }>(),
    db
      .prepare(
        `
        SELECT thing_id
        FROM things
        WHERE ${filter.whereSql}
        ORDER BY thing_type, preferred_label IS NULL, preferred_label, thing_id
        LIMIT ? OFFSET ?
      `,
      )
      .bind(...filter.values, page.limit, page.offset)
      .all<{ thing_id: string }>(),
  ]);
  const thingIds = thingRows.results.map((row) => row.thing_id);
  const thingsById = new Map(
    (await getThings(db, thingIds)).map((thing) => [thing.thing_id, thing]),
  );

  return {
    ...page,
    total: totalRow?.count ?? 0,
    items: thingIds.flatMap((thingId) => {
      const thing = thingsById.get(thingId);
      return thing ? [thing] : [];
    }),
  };
}

export async function getOntologyTriplesPage(
  db: D1DatabaseLike,
  options: OntologyTriplePageOptions = {},
): Promise<OntologyTriplePage> {
  const page = normalisePageOptions(options);
  const filter = triplePageFilter(options);
  const [totalRow, triples] = await Promise.all([
    db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM ontology_triples triples
        LEFT JOIN ontology_properties properties ON properties.property_id = triples.predicate_id
        LEFT JOIN things subject_things ON subject_things.thing_id = triples.subject_thing_id
        LEFT JOIN things object_things ON object_things.thing_id = triples.object_thing_id
        WHERE ${filter.whereSql}
      `,
      )
      .bind(...filter.values)
      .first<{ count: number }>(),
    db
      .prepare(
        `
        SELECT
          triples.triple_id,
          triples.subject_thing_id,
          triples.predicate_id,
          properties.label AS predicate_label,
          properties.property_kind AS predicate_kind,
          triples.object_thing_id,
          object_things.thing_type AS object_thing_type,
          object_things.preferred_label AS object_preferred_label,
          triples.object_literal,
          triples.object_datatype,
          triples.source_key,
          triples.confidence,
          triples.valid_from,
          triples.valid_to,
          triples.updated_at
        FROM ontology_triples triples
        LEFT JOIN ontology_properties properties ON properties.property_id = triples.predicate_id
        LEFT JOIN things subject_things ON subject_things.thing_id = triples.subject_thing_id
        LEFT JOIN things object_things ON object_things.thing_id = triples.object_thing_id
        WHERE ${filter.whereSql}
        ORDER BY triples.subject_thing_id, triples.predicate_id, triples.object_thing_id, triples.object_literal
        LIMIT ? OFFSET ?
      `,
      )
      .bind(...filter.values, page.limit, page.offset)
      .all<OntologyTriple>(),
  ]);

  return {
    ...page,
    total: totalRow?.count ?? 0,
    items: triples.results,
  };
}

function thingPageFilter(options: OntologyThingPageOptions): {
  whereSql: string;
  values: unknown[];
} {
  const conditions = ["things.is_active = 1"];
  const values: unknown[] = [];
  const thingType = options.thingType?.trim();
  const classId = options.classId?.trim();
  const query = options.query?.trim();

  if (thingType) {
    conditions.push("things.thing_type = ?");
    values.push(thingType);
  }

  if (classId) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM thing_class_assertions assertions
        WHERE assertions.thing_id = things.thing_id
          AND assertions.class_id = ?
      )
    `);
    values.push(classId);
  }

  if (query) {
    conditions.push(`
      (
        INSTR(LOWER(things.thing_id), LOWER(?)) > 0
        OR INSTR(LOWER(things.thing_type), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(things.preferred_label, '')), LOWER(?)) > 0
        OR EXISTS (
          SELECT 1
          FROM thing_identifiers identifiers
          WHERE identifiers.thing_id = things.thing_id
            AND (
              INSTR(LOWER(identifiers.identifier_scheme), LOWER(?)) > 0
              OR INSTR(LOWER(identifiers.identifier_value), LOWER(?)) > 0
            )
        )
        OR EXISTS (
          SELECT 1
          FROM thing_labels labels
          WHERE labels.thing_id = things.thing_id
            AND INSTR(LOWER(labels.label), LOWER(?)) > 0
        )
      )
    `);
    values.push(query, query, query, query, query, query);
  }

  return { whereSql: conditions.join(" AND "), values };
}

function triplePageFilter(options: OntologyTriplePageOptions): {
  whereSql: string;
  values: unknown[];
} {
  const conditions = ["triples.valid_to IS NULL"];
  const values: unknown[] = [];
  const predicateId = options.predicateId?.trim();
  const subjectThingId = options.subjectThingId?.trim();
  const objectThingId = options.objectThingId?.trim();
  const query = options.query?.trim();

  if (predicateId) {
    conditions.push("triples.predicate_id = ?");
    values.push(predicateId);
  }

  if (subjectThingId) {
    conditions.push("triples.subject_thing_id = ?");
    values.push(subjectThingId);
  }

  if (objectThingId) {
    conditions.push("triples.object_thing_id = ?");
    values.push(objectThingId);
  }

  if (query) {
    conditions.push(`
      (
        INSTR(LOWER(triples.triple_id), LOWER(?)) > 0
        OR INSTR(LOWER(triples.subject_thing_id), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(subject_things.preferred_label, '')), LOWER(?)) > 0
        OR INSTR(LOWER(triples.predicate_id), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(properties.label, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(triples.object_thing_id, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(object_things.preferred_label, '')), LOWER(?)) > 0
        OR INSTR(LOWER(COALESCE(triples.object_literal, '')), LOWER(?)) > 0
      )
    `);
    values.push(query, query, query, query, query, query, query, query);
  }

  return { whereSql: conditions.join(" AND "), values };
}

async function getOntologyStats(db: D1DatabaseLike): Promise<OntologyStats> {
  const row = await db
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM ontology_classes) AS class_count,
        (SELECT COUNT(*) FROM ontology_properties) AS property_count,
        (SELECT COUNT(*) FROM ontology_constraints) AS constraint_count,
        (SELECT COUNT(*) FROM things WHERE is_active = 1) AS thing_count,
        (SELECT COUNT(*) FROM ontology_triples WHERE valid_to IS NULL) AS triple_count,
        (SELECT COUNT(*) FROM source_events) AS source_event_count,
        COALESCE((
          SELECT violation_count
          FROM ontology_quality_runs
          ORDER BY checked_at DESC, run_key DESC
          LIMIT 1
        ), 0) AS quality_violation_count,
        COALESCE((
          SELECT error_count
          FROM ontology_quality_runs
          ORDER BY checked_at DESC, run_key DESC
          LIMIT 1
        ), 0) AS quality_error_count,
        COALESCE((
          SELECT warning_count
          FROM ontology_quality_runs
          ORDER BY checked_at DESC, run_key DESC
          LIMIT 1
        ), 0) AS quality_warning_count
    `,
    )
    .first<OntologyStats>();

  return (
    row ?? {
      class_count: 0,
      property_count: 0,
      constraint_count: 0,
      thing_count: 0,
      triple_count: 0,
      source_event_count: 0,
      quality_violation_count: 0,
      quality_error_count: 0,
      quality_warning_count: 0,
    }
  );
}

async function getThings(db: D1DatabaseLike, thingIds: string[]): Promise<OntologyThing[]> {
  if (thingIds.length === 0) return [];

  const placeholders = thingIds.map(() => "?").join(", ");
  const [things, identifiers, labels, classes] = await Promise.all([
    db
      .prepare(
        `
        SELECT thing_id, thing_type, preferred_label, disambiguation_hint, is_active, updated_at
        FROM things
        WHERE thing_id IN (${placeholders})
        ORDER BY thing_id
      `,
      )
      .bind(...thingIds)
      .all<Omit<OntologyThing, "classes" | "identifiers" | "labels">>(),
    db
      .prepare(
        `
        SELECT thing_id, identifier_scheme, identifier_value, is_primary, source_key
        FROM thing_identifiers
        WHERE thing_id IN (${placeholders})
        ORDER BY thing_id, is_primary DESC, identifier_scheme
      `,
      )
      .bind(...thingIds)
      .all<OntologyIdentifier & { thing_id: string }>(),
    db
      .prepare(
        `
        SELECT thing_id, label_kind, locale, label, source_key
        FROM thing_labels
        WHERE thing_id IN (${placeholders})
        ORDER BY thing_id, label_kind, locale, label
      `,
      )
      .bind(...thingIds)
      .all<OntologyLabel & { thing_id: string }>(),
    db
      .prepare(
        `
        SELECT
          assertions.thing_id,
          assertions.class_id,
          classes.label AS class_label,
          assertions.source_key,
          assertions.confidence
        FROM thing_class_assertions assertions
        LEFT JOIN ontology_classes classes ON classes.class_id = assertions.class_id
        WHERE assertions.thing_id IN (${placeholders})
        ORDER BY assertions.thing_id, assertions.class_id
      `,
      )
      .bind(...thingIds)
      .all<OntologyClassAssertion & { thing_id: string }>(),
  ]);

  const identifiersByThing = groupByThingId(identifiers.results);
  const labelsByThing = groupByThingId(labels.results);
  const classesByThing = groupByThingId(classes.results);

  return things.results.map((thing) => ({
    ...thing,
    classes: stripThingId(classesByThing.get(thing.thing_id) ?? []),
    identifiers: stripThingId(identifiersByThing.get(thing.thing_id) ?? []),
    labels: stripThingId(labelsByThing.get(thing.thing_id) ?? []),
  }));
}

async function getTriplesForThings(
  db: D1DatabaseLike,
  thingIds: string[],
  options: OntologyGraphOptions,
): Promise<OntologyTriple[]> {
  const placeholders = thingIds.map(() => "?").join(", ");
  const limit = Math.min(Math.max(Math.trunc(options.tripleLimit ?? 80), 1), 250);
  const inboundPredicate = options.includeInbound
    ? `OR triples.object_thing_id IN (${placeholders})`
    : "";
  const values = options.includeInbound ? [...thingIds, ...thingIds, limit] : [...thingIds, limit];
  const result = await db
    .prepare(
      `
      SELECT
        triples.triple_id,
        triples.subject_thing_id,
        triples.predicate_id,
        properties.label AS predicate_label,
        properties.property_kind AS predicate_kind,
        triples.object_thing_id,
        object_things.thing_type AS object_thing_type,
        object_things.preferred_label AS object_preferred_label,
        triples.object_literal,
        triples.object_datatype,
        triples.source_key,
        triples.confidence,
        triples.valid_from,
        triples.valid_to,
        triples.updated_at
      FROM ontology_triples triples
      LEFT JOIN ontology_properties properties ON properties.property_id = triples.predicate_id
      LEFT JOIN things object_things ON object_things.thing_id = triples.object_thing_id
      WHERE triples.valid_to IS NULL
        AND (triples.subject_thing_id IN (${placeholders}) ${inboundPredicate})
      ORDER BY triples.subject_thing_id, triples.predicate_id, triples.object_thing_id, triples.object_literal
      LIMIT ?
    `,
    )
    .bind(...values)
    .all<OntologyTriple>();

  return result.results;
}

function normaliseThingIds(thingIds: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawThingId of thingIds) {
    const thingId = rawThingId?.trim();
    if (!thingId || seen.has(thingId)) continue;
    seen.add(thingId);
    result.push(thingId);
  }
  return result;
}

function groupByThingId<T extends { thing_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const values = grouped.get(row.thing_id) ?? [];
    values.push(row);
    grouped.set(row.thing_id, values);
  }
  return grouped;
}

function stripThingId<T extends { thing_id: string }>(rows: T[]): Array<Omit<T, "thing_id">> {
  return rows.map(({ thing_id: _thingId, ...row }) => row);
}
