import { runD1Batch, type D1DatabaseLike, type D1StatementLike } from "../d1";
import {
  formationThingId,
  loadingCategoryThingId,
  movementThingId,
  operatorThingId,
  serviceThingId,
  sourceInstanceThingId,
  trainRunThingId,
  upsertRailThing,
} from "./ontology";

export interface ServiceCoachRow {
  service_key: string;
  formation_index: number;
  coach_index: number;
  tiploc: string | null;
  coach_number: string | null;
  coach_class: string | null;
  toilet_status: string | null;
  toilet_value: string | null;
  loading: number | null;
  loading_specified: number | null;
  updated_at: string;
}

export interface ServiceFormationRow {
  service_key: string;
  formation_index: number;
  tiploc: string | null;
  loading_category_code: string | null;
  loading_category_name: string | null;
  loading_category_colour: string | null;
  loading_category_image: string | null;
  loading_percentage: number | null;
  source: string | null;
  source_instance: string | null;
  updated_at: string;
}

export interface ServiceFormationWithCoaches extends ServiceFormationRow {
  coaches: ServiceCoachRow[];
}

export interface ServiceMovementRow {
  train_run_key: string;
  movement_index: number;
  service_key: string | null;
  train_id: string | null;
  train_uid: string | null;
  toc: string | null;
  train_service_code: string | null;
  stanox: string | null;
  reporting_stanox: string | null;
  platform: string | null;
  path: string | null;
  line: string | null;
  planned_event_type: string | null;
  event_type: string | null;
  planned_ts: string | null;
  gbtt_ts: string | null;
  actual_ts: string | null;
  timetable_variation_minutes: number | null;
  variation_status: string | null;
  auto_expected: number | null;
  updated_at: string;
}

export async function replaceServiceFormationsCurrent(
  db: D1DatabaseLike,
  serviceKey: string,
  formations: ServiceFormationWithCoaches[],
): Promise<void> {
  await runD1Batch(db, [
    db.prepare("DELETE FROM service_coaches WHERE service_key = ?").bind(serviceKey),
    db.prepare("DELETE FROM service_formations WHERE service_key = ?").bind(serviceKey),
  ]);

  const statements: D1StatementLike[] = [];
  for (const formation of formations) {
    const serviceId = serviceThingId(formation.service_key);
    const formationId = formationThingId(formation.service_key, formation.formation_index);
    const loadingCategoryId = formation.loading_category_code
      ? loadingCategoryThingId(formation.loading_category_code)
      : null;
    const sourceInstanceId = formation.source_instance
      ? sourceInstanceThingId(formation.source_instance)
      : null;
    await upsertRailThing(db, {
      thingId: serviceId,
      thingType: "rail:ServiceJourney",
      preferredLabel: formation.service_key,
      updatedAt: formation.updated_at,
      identifiers: [{ scheme: "rail:service-key", value: formation.service_key, primary: true }],
    });
    if (loadingCategoryId && formation.loading_category_code) {
      await upsertRailThing(db, {
        thingId: loadingCategoryId,
        thingType: "rail:LoadingCategory",
        preferredLabel: formation.loading_category_name ?? formation.loading_category_code,
        updatedAt: formation.updated_at,
        identifiers: [
          { scheme: "rdm:loading-category", value: formation.loading_category_code, primary: true },
        ],
      });
    }
    if (sourceInstanceId && formation.source_instance) {
      await upsertRailThing(db, {
        thingId: sourceInstanceId,
        thingType: "rail:SourceInstance",
        preferredLabel: formation.source_instance,
        updatedAt: formation.updated_at,
        identifiers: [
          { scheme: "rdm:source-instance", value: formation.source_instance, primary: true },
        ],
      });
    }
    await upsertRailThing(db, {
      thingId: formationId,
      thingType: "rail:ServiceFormation",
      preferredLabel: `${formation.service_key} formation ${formation.formation_index + 1}`,
      updatedAt: formation.updated_at,
      identifiers: [{ scheme: "rail:formation-key", value: formationId, primary: true }],
      objectTriples: [
        { predicateId: "rail:formationOf", objectThingId: serviceId },
        { predicateId: "rail:loadingCategory", objectThingId: loadingCategoryId },
        { predicateId: "rail:reportedBySourceInstance", objectThingId: sourceInstanceId },
      ],
    });
    statements.push(
      serviceFormationStatement(
        db,
        formation,
        serviceId,
        formationId,
        loadingCategoryId,
        sourceInstanceId,
      ),
    );

    for (const coach of formation.coaches) {
      statements.push(serviceCoachStatement(db, coach, serviceId, formationId));
    }
  }
  await runD1Batch(db, statements);
}

function serviceFormationStatement(
  db: D1DatabaseLike,
  formation: ServiceFormationWithCoaches,
  serviceId: string,
  formationId: string,
  loadingCategoryId: string | null,
  sourceInstanceId: string | null,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO service_formations (
        service_key, service_thing_id, formation_index, formation_thing_id, tiploc,
        loading_category_code, loading_category_thing_id, loading_category_name,
        loading_category_colour, loading_category_image, loading_percentage,
        source, source_instance, source_instance_thing_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      formation.service_key,
      serviceId,
      formation.formation_index,
      formationId,
      formation.tiploc,
      formation.loading_category_code,
      loadingCategoryId,
      formation.loading_category_name,
      formation.loading_category_colour,
      formation.loading_category_image,
      formation.loading_percentage,
      formation.source,
      formation.source_instance,
      sourceInstanceId,
      formation.updated_at,
    );
}

function serviceCoachStatement(
  db: D1DatabaseLike,
  coach: ServiceCoachRow,
  serviceId: string,
  formationId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO service_coaches (
        service_key, service_thing_id, formation_index, formation_thing_id,
        coach_index, tiploc, coach_number, coach_class,
        toilet_status, toilet_value, loading, loading_specified, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      coach.service_key,
      serviceId,
      coach.formation_index,
      formationId,
      coach.coach_index,
      coach.tiploc,
      coach.coach_number,
      coach.coach_class,
      coach.toilet_status,
      coach.toilet_value,
      coach.loading,
      coach.loading_specified,
      coach.updated_at,
    );
}

export async function getServiceFormationsCurrent(
  db: D1DatabaseLike,
  serviceKey: string,
): Promise<ServiceFormationWithCoaches[]> {
  const [formationRows, coachRows] = await Promise.all([
    db
      .prepare(
        `
        SELECT *
        FROM service_formations
        WHERE service_key = ?
        ORDER BY formation_index ASC
      `,
      )
      .bind(serviceKey)
      .all<ServiceFormationRow>(),
    db
      .prepare(
        `
        SELECT *
        FROM service_coaches
        WHERE service_key = ?
        ORDER BY formation_index ASC, coach_index ASC
      `,
      )
      .bind(serviceKey)
      .all<ServiceCoachRow>(),
  ]);

  const coachesByFormation = new Map<number, ServiceCoachRow[]>();
  for (const coach of coachRows.results) {
    const coaches = coachesByFormation.get(coach.formation_index) ?? [];
    coaches.push(coach);
    coachesByFormation.set(coach.formation_index, coaches);
  }

  return formationRows.results.map((formation) => ({
    ...formation,
    coaches: coachesByFormation.get(formation.formation_index) ?? [],
  }));
}

export async function upsertServiceMovementCurrent(
  db: D1DatabaseLike,
  row: Omit<ServiceMovementRow, "movement_index">,
): Promise<boolean> {
  const current = await db
    .prepare(
      `
      SELECT movement_index
      FROM train_movements
      WHERE train_run_key = ? AND actual_ts = ? AND event_type IS ?
      LIMIT 1
    `,
    )
    .bind(row.train_run_key, row.actual_ts, row.event_type)
    .first<{ movement_index: number }>();

  const movementIndex = current?.movement_index ?? (await nextMovementIndex(db, row.train_run_key));
  const trainRunId = trainRunThingId(row.train_run_key);
  const movementId = movementThingId(row.train_run_key, movementIndex);
  const serviceId = row.service_key ? serviceThingId(row.service_key) : null;
  const operatorId = row.toc ? operatorThingId(row.toc) : null;
  await upsertRailThing(db, {
    thingId: trainRunId,
    thingType: "rail:TrainRun",
    preferredLabel: row.train_id ?? row.train_run_key,
    updatedAt: row.updated_at,
    identifiers: [{ scheme: "rail:train-run-key", value: row.train_run_key, primary: true }],
  });
  if (serviceId && row.service_key) {
    await upsertRailThing(db, {
      thingId: serviceId,
      thingType: "rail:ServiceJourney",
      preferredLabel: row.service_key,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rail:service-key", value: row.service_key, primary: true }],
    });
  }
  if (operatorId && row.toc) {
    await upsertRailThing(db, {
      thingId: operatorId,
      thingType: "rail:Operator",
      preferredLabel: row.toc,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rdm:toc", value: row.toc, primary: true }],
    });
  }
  await upsertRailThing(db, {
    thingId: movementId,
    thingType: "rail:TrainMovement",
    preferredLabel: `${row.train_run_key} movement ${movementIndex + 1}`,
    updatedAt: row.updated_at,
    identifiers: [{ scheme: "rail:movement-key", value: movementId, primary: true }],
    datatypeTriples: [
      { predicateId: "rail:eventType", value: row.event_type },
      { predicateId: "rail:variationStatus", value: row.variation_status },
    ],
    objectTriples: [
      { predicateId: "rail:movementOf", objectThingId: trainRunId },
      { predicateId: "rail:observedService", objectThingId: serviceId },
      { predicateId: "rail:reportedByOperator", objectThingId: operatorId },
    ],
  });

  await db
    .prepare(
      `
      INSERT INTO train_movements (
        train_run_key, train_run_thing_id, movement_index, movement_thing_id,
        service_key, service_thing_id, train_id, train_uid, toc,
        operator_thing_id, train_service_code, stanox, reporting_stanox, platform, path, line,
        planned_event_type, event_type, planned_ts, gbtt_ts, actual_ts,
        timetable_variation_minutes, variation_status, auto_expected, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(train_run_key, movement_index) DO UPDATE SET
        train_run_thing_id = excluded.train_run_thing_id,
        movement_thing_id = excluded.movement_thing_id,
        service_key = COALESCE(excluded.service_key, train_movements.service_key),
        service_thing_id = COALESCE(excluded.service_thing_id, train_movements.service_thing_id),
        train_id = COALESCE(excluded.train_id, train_movements.train_id),
        train_uid = COALESCE(excluded.train_uid, train_movements.train_uid),
        toc = COALESCE(excluded.toc, train_movements.toc),
        operator_thing_id = COALESCE(excluded.operator_thing_id, train_movements.operator_thing_id),
        train_service_code = COALESCE(excluded.train_service_code, train_movements.train_service_code),
        stanox = COALESCE(excluded.stanox, train_movements.stanox),
        reporting_stanox = COALESCE(excluded.reporting_stanox, train_movements.reporting_stanox),
        platform = COALESCE(excluded.platform, train_movements.platform),
        path = COALESCE(excluded.path, train_movements.path),
        line = COALESCE(excluded.line, train_movements.line),
        planned_event_type = COALESCE(excluded.planned_event_type, train_movements.planned_event_type),
        event_type = COALESCE(excluded.event_type, train_movements.event_type),
        planned_ts = COALESCE(excluded.planned_ts, train_movements.planned_ts),
        gbtt_ts = COALESCE(excluded.gbtt_ts, train_movements.gbtt_ts),
        actual_ts = COALESCE(excluded.actual_ts, train_movements.actual_ts),
        timetable_variation_minutes = COALESCE(excluded.timetable_variation_minutes, train_movements.timetable_variation_minutes),
        variation_status = COALESCE(excluded.variation_status, train_movements.variation_status),
        auto_expected = COALESCE(excluded.auto_expected, train_movements.auto_expected),
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= train_movements.updated_at
    `,
    )
    .bind(
      row.train_run_key,
      trainRunId,
      movementIndex,
      movementId,
      row.service_key,
      serviceId,
      row.train_id,
      row.train_uid,
      row.toc,
      operatorId,
      row.train_service_code,
      row.stanox,
      row.reporting_stanox,
      row.platform,
      row.path,
      row.line,
      row.planned_event_type,
      row.event_type,
      row.planned_ts,
      row.gbtt_ts,
      row.actual_ts,
      row.timetable_variation_minutes,
      row.variation_status,
      row.auto_expected,
      row.updated_at,
    )
    .run();

  return true;
}

export async function getServiceMovementsCurrent(
  db: D1DatabaseLike,
  serviceKey: string,
  trainRunKey: string | null,
): Promise<ServiceMovementRow[]> {
  const result = await db
    .prepare(
      `
      SELECT *
      FROM train_movements
      WHERE service_key = ? OR (? IS NOT NULL AND train_run_key = ?)
      ORDER BY COALESCE(actual_ts, gbtt_ts, planned_ts, updated_at) ASC, movement_index ASC
    `,
    )
    .bind(serviceKey, trainRunKey, trainRunKey)
    .all<ServiceMovementRow>();

  return result.results;
}

async function nextMovementIndex(db: D1DatabaseLike, trainRunKey: string): Promise<number> {
  const current = await db
    .prepare(
      `
      SELECT COALESCE(MAX(movement_index) + 1, 0) AS next_movement_index
      FROM train_movements
      WHERE train_run_key = ?
    `,
    )
    .bind(trainRunKey)
    .first<{ next_movement_index: number }>();

  return current?.next_movement_index ?? 0;
}
