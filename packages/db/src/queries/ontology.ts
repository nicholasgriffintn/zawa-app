import { runD1Batch, type D1DatabaseLike, type D1StatementLike } from "../d1";

export const RAIL_SOURCE_KEY = "rdm";
export const INTERNAL_SOURCE_KEY = "internal";

export interface ThingIdentifierWrite {
  scheme: string;
  value: string | null | undefined;
  primary?: boolean;
}

export interface DatatypeTripleWrite {
  predicateId: string;
  label?: string;
  value: string | number | boolean | null | undefined;
}

export interface ObjectTripleWrite {
  predicateId: string;
  label?: string;
  objectThingId: string | null | undefined;
}

export interface RailThingWrite {
  thingId: string;
  thingType: string;
  preferredLabel: string | null | undefined;
  disambiguationHint?: string | null;
  sourceKey?: string;
  updatedAt: string;
  identifiers?: ThingIdentifierWrite[];
  datatypeTriples?: DatatypeTripleWrite[];
  objectTriples?: ObjectTripleWrite[];
}

export function stationThingId(stationKey: string): string {
  return `rail:station:${stationKey.trim().toUpperCase()}`;
}

export function operatorThingId(tocCode: string): string {
  return `rail:operator:${tocCode.trim().toUpperCase()}`;
}

export function serviceThingId(serviceKey: string): string {
  return `rail:service:${serviceKey.trim()}`;
}

export function trainRunThingId(trainRunKey: string): string {
  return `rail:train-run:${trainRunKey.trim()}`;
}

export function incidentThingId(incidentId: string): string {
  return `rail:incident:${incidentId.trim()}`;
}

export function disruptionThingId(disruptionId: string): string {
  return `rail:disruption:${disruptionId.trim()}`;
}

export function stationMessageThingId(stationKey: string, messageHash: string): string {
  return `rail:station-message:${stationKey.trim().toUpperCase()}:${messageHash.trim()}`;
}

export function loadingCategoryThingId(categoryCode: string): string {
  return `rail:loading-category:${categoryCode.trim().toUpperCase()}`;
}

export function reasonCodeThingId(reasonCode: string): string {
  return `rail:reason-code:${reasonCode.trim().toUpperCase()}`;
}

export function sourceInstanceThingId(sourceInstanceId: string): string {
  return `rail:source-instance:${sourceInstanceId.trim().toUpperCase()}`;
}

export function formationThingId(serviceKey: string, formationIndex: number): string {
  return `${serviceThingId(serviceKey)}:formation:${formationIndex}`;
}

export function movementThingId(trainRunKey: string, movementIndex: number): string {
  return `${trainRunThingId(trainRunKey)}:movement:${movementIndex}`;
}

export async function upsertRailThing(db: D1DatabaseLike, thing: RailThingWrite): Promise<void> {
  await runD1Batch(db, railThingStatements(db, thing));
}

export async function upsertRailThings(
  db: D1DatabaseLike,
  things: RailThingWrite[],
): Promise<void> {
  await runD1Batch(
    db,
    things.flatMap((thing) => railThingStatements(db, thing)),
  );
}

export async function deactivateRailThing(
  db: D1DatabaseLike,
  thingId: string,
  updatedAt: string,
): Promise<void> {
  await runD1Batch(db, railThingDeactivationStatements(db, thingId, updatedAt));
}

export async function deactivateRailThings(
  db: D1DatabaseLike,
  thingIds: string[],
  updatedAt: string,
): Promise<void> {
  await runD1Batch(
    db,
    thingIds.flatMap((thingId) => railThingDeactivationStatements(db, thingId, updatedAt)),
  );
}

function railThingStatements(db: D1DatabaseLike, thing: RailThingWrite): D1StatementLike[] {
  const sourceKey = thing.sourceKey ?? RAIL_SOURCE_KEY;
  const statements: D1StatementLike[] = [
    railSourceStatement(db, sourceKey, thing.updatedAt),
    ontologyClassStatement(db, thing.thingType, sourceKey, thing.updatedAt),
    railThingStatement(db, thing),
    thingClassAssertionStatement(db, {
      thingId: thing.thingId,
      classId: thing.thingType,
      sourceKey,
      updatedAt: thing.updatedAt,
    }),
  ];

  if (thing.preferredLabel) {
    statements.push(
      thingLabelStatement(db, {
        thingId: thing.thingId,
        labelKind: "preferred",
        locale: "en-GB",
        label: thing.preferredLabel,
        sourceKey,
        updatedAt: thing.updatedAt,
      }),
    );
  }

  for (const identifier of thing.identifiers ?? []) {
    if (!identifier.value) continue;
    statements.push(
      thingIdentifierStatement(db, {
        thingId: thing.thingId,
        scheme: identifier.scheme,
        value: identifier.value,
        sourceKey,
        primary: identifier.primary ?? false,
        updatedAt: thing.updatedAt,
      }),
    );
  }

  for (const triple of thing.datatypeTriples ?? []) {
    if (triple.value === undefined) continue;
    pushDatatypeTripleStatements(statements, db, {
      subjectThingId: thing.thingId,
      predicateId: triple.predicateId,
      label: triple.label ?? labelFromIdentifier(triple.predicateId),
      value: triple.value,
      sourceKey,
      updatedAt: thing.updatedAt,
    });
  }

  for (const triple of thing.objectTriples ?? []) {
    if (!triple.objectThingId) continue;
    statements.push(
      ontologyPropertyStatement(db, {
        propertyId: triple.predicateId,
        label: triple.label ?? labelFromIdentifier(triple.predicateId),
        kind: "object",
        sourceKey,
        updatedAt: thing.updatedAt,
      }),
      objectTripleStatement(db, {
        subjectThingId: thing.thingId,
        predicateId: triple.predicateId,
        objectThingId: triple.objectThingId,
        sourceKey,
        updatedAt: thing.updatedAt,
      }),
    );
  }

  return statements;
}

function railThingDeactivationStatements(
  db: D1DatabaseLike,
  thingId: string,
  updatedAt: string,
): D1StatementLike[] {
  return [
    db
      .prepare(
        "UPDATE things SET is_active = 0, updated_at = ? WHERE thing_id = ? AND is_active = 1",
      )
      .bind(updatedAt, thingId),
    db
      .prepare(
        `
        UPDATE ontology_triples
        SET valid_to = ?, updated_at = ?
        WHERE valid_to IS NULL
          AND (subject_thing_id = ? OR object_thing_id = ?)
      `,
      )
      .bind(updatedAt, updatedAt, thingId, thingId),
  ];
}

export async function recordSourceEventThing(
  db: D1DatabaseLike,
  event: {
    eventId: string;
    sourceKey: string;
    messageId: string | null;
    topic: string | null;
    eventType: string | null;
    thingId: string | null;
    occurredAt: string | null;
    receivedAt: string;
    payloadJson: string;
  },
): Promise<void> {
  await runD1Batch(db, sourceEventStatements(db, [event]));
}

export async function recordSourceEventThings(
  db: D1DatabaseLike,
  events: Array<{
    eventId: string;
    sourceKey: string;
    messageId: string | null;
    topic: string | null;
    eventType: string | null;
    thingId: string | null;
    occurredAt: string | null;
    receivedAt: string;
    payloadJson: string;
  }>,
): Promise<void> {
  await runD1Batch(db, sourceEventStatements(db, events));
}

function sourceEventStatements(
  db: D1DatabaseLike,
  events: Array<{
    eventId: string;
    sourceKey: string;
    messageId: string | null;
    topic: string | null;
    eventType: string | null;
    thingId: string | null;
    occurredAt: string | null;
    receivedAt: string;
    payloadJson: string;
  }>,
): D1StatementLike[] {
  const latestSourceUpdates = new Map<string, string>();
  for (const event of events) {
    const current = latestSourceUpdates.get(event.sourceKey);
    if (!current || event.receivedAt > current) {
      latestSourceUpdates.set(event.sourceKey, event.receivedAt);
    }
  }

  return [
    ...[...latestSourceUpdates.entries()].map(([sourceKey, receivedAt]) =>
      railSourceStatement(db, sourceKey, receivedAt),
    ),
    ...events.map((event) => sourceEventStatement(db, event)),
  ];
}

function sourceEventStatement(
  db: D1DatabaseLike,
  event: {
    eventId: string;
    sourceKey: string;
    messageId: string | null;
    topic: string | null;
    eventType: string | null;
    thingId: string | null;
    occurredAt: string | null;
    receivedAt: string;
    payloadJson: string;
  },
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO source_events (
        event_id, source_key, message_id, topic, event_type, thing_id,
        occurred_at, received_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO NOTHING
    `,
    )
    .bind(
      event.eventId,
      event.sourceKey,
      event.messageId,
      event.topic,
      event.eventType,
      event.thingId,
      event.occurredAt,
      event.receivedAt,
      event.payloadJson,
    );
}

function railThingStatement(db: D1DatabaseLike, thing: RailThingWrite): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO things (
        thing_id, thing_type, preferred_label, disambiguation_hint,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(thing_id) DO UPDATE SET
        thing_type = excluded.thing_type,
        preferred_label = CASE
          WHEN excluded.preferred_label IS NULL THEN things.preferred_label
          WHEN things.preferred_label IS NULL OR TRIM(things.preferred_label) = '' THEN excluded.preferred_label
          WHEN things.thing_type = 'rail:Station'
            AND excluded.preferred_label = SUBSTR(things.thing_id, LENGTH('rail:station:') + 1)
            THEN things.preferred_label
          ELSE excluded.preferred_label
        END,
        disambiguation_hint = COALESCE(excluded.disambiguation_hint, things.disambiguation_hint),
        is_active = 1,
        updated_at = excluded.updated_at
      WHERE things.thing_type IS NOT excluded.thing_type
        OR CASE
          WHEN excluded.preferred_label IS NULL THEN things.preferred_label
          WHEN things.preferred_label IS NULL OR TRIM(things.preferred_label) = '' THEN excluded.preferred_label
          WHEN things.thing_type = 'rail:Station'
            AND excluded.preferred_label = SUBSTR(things.thing_id, LENGTH('rail:station:') + 1)
            THEN things.preferred_label
          ELSE excluded.preferred_label
        END IS NOT things.preferred_label
        OR COALESCE(excluded.disambiguation_hint, things.disambiguation_hint) IS NOT things.disambiguation_hint
        OR things.is_active IS NOT 1
    `,
    )
    .bind(
      thing.thingId,
      thing.thingType,
      thing.preferredLabel ?? null,
      thing.disambiguationHint ?? null,
      thing.updatedAt,
      thing.updatedAt,
    );
}

function railSourceStatement(
  db: D1DatabaseLike,
  sourceKey: string,
  updatedAt: string,
): D1StatementLike {
  const sourceName = sourceKey === INTERNAL_SOURCE_KEY ? "Internal projection pipeline" : sourceKey;
  const provider = sourceKey === INTERNAL_SOURCE_KEY ? "zawa" : "Rail Data Marketplace";
  return db
    .prepare(
      `
      INSERT INTO rail_sources (source_key, source_name, provider, description, updated_at)
      VALUES (?, ?, ?, NULL, ?)
      ON CONFLICT(source_key) DO UPDATE SET
        updated_at = excluded.updated_at
      WHERE rail_sources.updated_at < excluded.updated_at
    `,
    )
    .bind(sourceKey, sourceName, provider, updatedAt);
}

function ontologyClassStatement(
  db: D1DatabaseLike,
  classId: string,
  sourceKey: string,
  updatedAt: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO ontology_classes (
        class_id, label, description, parent_class_id, source_key, updated_at
      ) VALUES (?, ?, NULL, 'rail:Thing', ?, ?)
      ON CONFLICT(class_id) DO UPDATE SET
        label = excluded.label,
        updated_at = excluded.updated_at
      WHERE ontology_classes.label IS NOT excluded.label
    `,
    )
    .bind(classId, labelFromIdentifier(classId), sourceKey, updatedAt);
}

function ontologyPropertyStatement(
  db: D1DatabaseLike,
  property: {
    propertyId: string;
    label: string;
    kind: "object" | "datatype";
    rangeDatatype?: string | null;
    sourceKey: string;
    updatedAt: string;
  },
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO ontology_properties (
        property_id, label, description, property_kind, domain_class_id,
        range_class_id, range_datatype, parent_property_id, source_key, updated_at
      ) VALUES (?, ?, NULL, ?, 'rail:Thing', NULL, ?, NULL, ?, ?)
      ON CONFLICT(property_id) DO UPDATE SET
        label = excluded.label,
        property_kind = excluded.property_kind,
        range_datatype = COALESCE(excluded.range_datatype, ontology_properties.range_datatype),
        updated_at = excluded.updated_at
      WHERE ontology_properties.label IS NOT excluded.label
        OR ontology_properties.property_kind IS NOT excluded.property_kind
        OR COALESCE(excluded.range_datatype, ontology_properties.range_datatype) IS NOT ontology_properties.range_datatype
    `,
    )
    .bind(
      property.propertyId,
      property.label,
      property.kind,
      property.rangeDatatype ?? null,
      property.sourceKey,
      property.updatedAt,
    );
}

function thingClassAssertionStatement(
  db: D1DatabaseLike,
  assertion: {
    thingId: string;
    classId: string;
    sourceKey: string;
    updatedAt: string;
  },
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO thing_class_assertions (
        thing_id, class_id, source_key, confidence, updated_at
      ) VALUES (?, ?, ?, NULL, ?)
      ON CONFLICT(thing_id, class_id, source_key) DO UPDATE SET
        updated_at = excluded.updated_at
      WHERE thing_class_assertions.confidence IS NOT excluded.confidence
    `,
    )
    .bind(assertion.thingId, assertion.classId, assertion.sourceKey, assertion.updatedAt);
}

function thingIdentifierStatement(
  db: D1DatabaseLike,
  identifier: {
    thingId: string;
    scheme: string;
    value: string;
    sourceKey: string;
    primary: boolean;
    updatedAt: string;
  },
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO thing_identifiers (
        identifier_scheme, identifier_value, thing_id, source_key, is_primary, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(identifier_scheme, identifier_value) DO UPDATE SET
        thing_id = excluded.thing_id,
        source_key = excluded.source_key,
        is_primary = excluded.is_primary,
        updated_at = excluded.updated_at
      WHERE thing_identifiers.thing_id IS NOT excluded.thing_id
        OR thing_identifiers.source_key IS NOT excluded.source_key
        OR thing_identifiers.is_primary IS NOT excluded.is_primary
    `,
    )
    .bind(
      identifier.scheme,
      identifier.value,
      identifier.thingId,
      identifier.sourceKey,
      identifier.primary ? 1 : 0,
      identifier.updatedAt,
    );
}

function thingLabelStatement(
  db: D1DatabaseLike,
  label: {
    thingId: string;
    labelKind: string;
    locale: string;
    label: string;
    sourceKey: string;
    updatedAt: string;
  },
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO thing_labels (
        thing_id, label_kind, locale, label, source_key, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(thing_id, label_kind, locale, label) DO UPDATE SET
        source_key = excluded.source_key,
        updated_at = excluded.updated_at
      WHERE thing_labels.source_key IS NOT excluded.source_key
    `,
    )
    .bind(
      label.thingId,
      label.labelKind,
      label.locale,
      label.label,
      label.sourceKey,
      label.updatedAt,
    );
}

function objectTripleStatement(
  db: D1DatabaseLike,
  triple: {
    subjectThingId: string;
    predicateId: string;
    objectThingId: string;
    sourceKey: string;
    updatedAt: string;
  },
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO ontology_triples (
        triple_id, subject_thing_id, predicate_id, object_thing_id, object_literal,
        object_datatype, source_key, confidence, valid_from, valid_to, updated_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(triple_id) DO UPDATE SET
        valid_to = NULL,
        updated_at = excluded.updated_at
      WHERE ontology_triples.valid_to IS NOT NULL
    `,
    )
    .bind(
      tripleId(triple.subjectThingId, triple.predicateId, triple.objectThingId),
      triple.subjectThingId,
      triple.predicateId,
      triple.objectThingId,
      triple.sourceKey,
      triple.updatedAt,
    );
}

function pushDatatypeTripleStatements(
  statements: D1StatementLike[],
  db: D1DatabaseLike,
  triple: {
    subjectThingId: string;
    predicateId: string;
    label: string;
    value: string | number | boolean | null;
    sourceKey: string;
    updatedAt: string;
  },
): void {
  if (triple.value === null) return;
  const datatype = datatypeForValue(triple.value);
  const literal = String(triple.value);
  const currentTripleId = datatypeTripleId(triple.subjectThingId, triple.predicateId);
  statements.push(
    ontologyPropertyStatement(db, {
      propertyId: triple.predicateId,
      label: triple.label,
      kind: "datatype",
      rangeDatatype: datatype,
      sourceKey: triple.sourceKey,
      updatedAt: triple.updatedAt,
    }),
    deactivateDatatypeTripleStatement(db, triple, currentTripleId),
    datatypeTripleStatement(db, triple, currentTripleId, literal, datatype),
  );
}

function deactivateDatatypeTripleStatement(
  db: D1DatabaseLike,
  triple: {
    subjectThingId: string;
    predicateId: string;
    updatedAt: string;
  },
  currentTripleId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      UPDATE ontology_triples
      SET valid_to = ?, updated_at = ?
      WHERE subject_thing_id = ?
        AND predicate_id = ?
        AND object_literal IS NOT NULL
        AND valid_to IS NULL
        AND triple_id IS NOT ?
    `,
    )
    .bind(
      triple.updatedAt,
      triple.updatedAt,
      triple.subjectThingId,
      triple.predicateId,
      currentTripleId,
    );
}

function datatypeTripleStatement(
  db: D1DatabaseLike,
  triple: {
    subjectThingId: string;
    predicateId: string;
    sourceKey: string;
    updatedAt: string;
  },
  currentTripleId: string,
  literal: string,
  datatype: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO ontology_triples (
        triple_id, subject_thing_id, predicate_id, object_thing_id, object_literal,
        object_datatype, source_key, confidence, valid_from, valid_to, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(triple_id) DO UPDATE SET
        object_literal = excluded.object_literal,
        object_datatype = excluded.object_datatype,
        updated_at = excluded.updated_at
      WHERE ontology_triples.object_literal IS NOT excluded.object_literal
        OR ontology_triples.object_datatype IS NOT excluded.object_datatype
        OR ontology_triples.valid_to IS NOT NULL
    `,
    )
    .bind(
      currentTripleId,
      triple.subjectThingId,
      triple.predicateId,
      literal,
      datatype,
      triple.sourceKey,
      triple.updatedAt,
    );
}

function datatypeForValue(value: string | number | boolean): string {
  if (typeof value === "number") return "xsd:decimal";
  if (typeof value === "boolean") return "xsd:boolean";
  return "xsd:string";
}

function labelFromIdentifier(identifier: string): string {
  const raw = identifier.includes(":")
    ? identifier.slice(identifier.lastIndexOf(":") + 1)
    : identifier;
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .trim()
    .toLowerCase();
}

function tripleId(subjectThingId: string, predicateId: string, objectValue: string): string {
  return `${subjectThingId}|${predicateId}|${objectValue}`;
}

function datatypeTripleId(subjectThingId: string, predicateId: string): string {
  return `${subjectThingId}|${predicateId}`;
}
