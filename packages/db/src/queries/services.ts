import { runD1Batch, type D1DatabaseLike, type D1StatementLike, writeAccepted } from "../d1";
import {
  operatorThingId,
  type RailThingWrite,
  serviceThingId,
  trainRunThingId,
  upsertRailThings,
} from "./ontology";

export interface ServiceRow {
  service_key: string;
  train_run_key: string | null;
  rid?: string | null;
  uid?: string | null;
  train_id?: string | null;
  rsid?: string | null;
  operator_code: string | null;
  origin_name: string | null;
  destination_name: string | null;
  service_type?: string | null;
  category?: string | null;
  activities?: string | null;
  service_length?: number | null;
  is_passenger_service?: number | null;
  is_charter?: number | null;
  is_reverse_formation?: number | null;
  detach_front?: number | null;
  scheduled_start_ts: string | null;
  expected_start_ts: string | null;
  status: string;
  delay_minutes: number | null;
  cancellation_reason: string | null;
  last_event_id: string;
  updated_at: string;
}

export async function upsertServiceCurrent(db: D1DatabaseLike, row: ServiceRow): Promise<boolean> {
  const serviceId = serviceThingId(row.service_key);
  const trainRunId = row.train_run_key ? trainRunThingId(row.train_run_key) : null;
  const operatorId = row.operator_code ? operatorThingId(row.operator_code) : null;
  await upsertRailThings(db, serviceRailThingWrites(row, serviceId, trainRunId, operatorId));
  const result = await serviceCurrentStatement(db, row, serviceId, trainRunId, operatorId).run();

  return writeAccepted(result);
}

export async function upsertServiceCurrents(
  db: D1DatabaseLike,
  rows: ServiceRow[],
): Promise<boolean[]> {
  const statements: D1StatementLike[] = [];
  const thingWrites: RailThingWrite[] = [];

  for (const row of rows) {
    const serviceId = serviceThingId(row.service_key);
    const trainRunId = row.train_run_key ? trainRunThingId(row.train_run_key) : null;
    const operatorId = row.operator_code ? operatorThingId(row.operator_code) : null;
    thingWrites.push(...serviceRailThingWrites(row, serviceId, trainRunId, operatorId));
    statements.push(serviceCurrentStatement(db, row, serviceId, trainRunId, operatorId));
  }

  await upsertRailThings(db, thingWrites);
  const results = await runD1Batch(db, statements);
  return results.map(writeAccepted);
}

function serviceRailThingWrites(
  row: ServiceRow,
  serviceId: string,
  trainRunId: string | null,
  operatorId: string | null,
): RailThingWrite[] {
  const things: RailThingWrite[] = [];
  if (trainRunId && row.train_run_key) {
    things.push({
      thingId: trainRunId,
      thingType: "rail:TrainRun",
      preferredLabel: row.train_id ?? row.train_run_key,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rail:train-run-key", value: row.train_run_key, primary: true }],
    });
  }
  if (operatorId && row.operator_code) {
    things.push({
      thingId: operatorId,
      thingType: "rail:Operator",
      preferredLabel: row.operator_code,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rdm:toc", value: row.operator_code, primary: true }],
    });
  }
  things.push({
    thingId: serviceId,
    thingType: "rail:ServiceJourney",
    preferredLabel: row.destination_name
      ? `${row.origin_name ?? "Service"} to ${row.destination_name}`
      : row.service_key,
    updatedAt: row.updated_at,
    identifiers: [
      { scheme: "rail:service-key", value: row.service_key, primary: true },
      { scheme: "rdm:rid", value: row.rid },
      { scheme: "rail:uid", value: row.uid },
      { scheme: "rail:train-id", value: row.train_id },
    ],
    datatypeTriples: [
      { predicateId: "rail:status", value: row.status },
      { predicateId: "rail:category", value: row.category },
      { predicateId: "rail:serviceType", value: row.service_type },
    ],
    objectTriples: [
      { predicateId: "rail:realisesTrainRun", objectThingId: trainRunId },
      { predicateId: "rail:operatedBy", objectThingId: operatorId },
    ],
  });
  return things;
}

function serviceCurrentStatement(
  db: D1DatabaseLike,
  row: ServiceRow,
  serviceId: string,
  trainRunId: string | null,
  operatorId: string | null,
): D1StatementLike {
  return db
    .prepare(`
      INSERT INTO service_journeys (
        service_key, service_thing_id, train_run_key, train_run_thing_id, rid, uid,
        train_id, rsid, operator_code, operator_thing_id, origin_name,
        destination_name, service_type, category, activities,
        service_length, is_passenger_service, is_charter, is_reverse_formation,
        detach_front, scheduled_start_ts, expected_start_ts, status, delay_minutes,
        cancellation_reason, last_event_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(service_key) DO UPDATE SET
        service_thing_id = excluded.service_thing_id,
        train_run_key = COALESCE(excluded.train_run_key, service_journeys.train_run_key),
        train_run_thing_id = COALESCE(excluded.train_run_thing_id, service_journeys.train_run_thing_id),
        rid = COALESCE(excluded.rid, service_journeys.rid),
        uid = COALESCE(excluded.uid, service_journeys.uid),
        train_id = COALESCE(excluded.train_id, service_journeys.train_id),
        rsid = COALESCE(excluded.rsid, service_journeys.rsid),
        operator_code = COALESCE(excluded.operator_code, service_journeys.operator_code),
        operator_thing_id = COALESCE(excluded.operator_thing_id, service_journeys.operator_thing_id),
        origin_name = COALESCE(excluded.origin_name, service_journeys.origin_name),
        destination_name = COALESCE(excluded.destination_name, service_journeys.destination_name),
        service_type = COALESCE(excluded.service_type, service_journeys.service_type),
        category = COALESCE(excluded.category, service_journeys.category),
        activities = COALESCE(excluded.activities, service_journeys.activities),
        service_length = COALESCE(excluded.service_length, service_journeys.service_length),
        is_passenger_service = COALESCE(excluded.is_passenger_service, service_journeys.is_passenger_service),
        is_charter = COALESCE(excluded.is_charter, service_journeys.is_charter),
        is_reverse_formation = COALESCE(excluded.is_reverse_formation, service_journeys.is_reverse_formation),
        detach_front = COALESCE(excluded.detach_front, service_journeys.detach_front),
        scheduled_start_ts = COALESCE(excluded.scheduled_start_ts, service_journeys.scheduled_start_ts),
        expected_start_ts = COALESCE(excluded.expected_start_ts, service_journeys.expected_start_ts),
        status = excluded.status,
        delay_minutes = COALESCE(excluded.delay_minutes, service_journeys.delay_minutes),
        cancellation_reason = COALESCE(excluded.cancellation_reason, service_journeys.cancellation_reason),
        last_event_id = excluded.last_event_id,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= service_journeys.updated_at
        AND (
          COALESCE(excluded.train_run_key, service_journeys.train_run_key) IS NOT service_journeys.train_run_key
          OR COALESCE(excluded.train_run_thing_id, service_journeys.train_run_thing_id) IS NOT service_journeys.train_run_thing_id
          OR COALESCE(excluded.rid, service_journeys.rid) IS NOT service_journeys.rid
          OR COALESCE(excluded.uid, service_journeys.uid) IS NOT service_journeys.uid
          OR COALESCE(excluded.train_id, service_journeys.train_id) IS NOT service_journeys.train_id
          OR COALESCE(excluded.rsid, service_journeys.rsid) IS NOT service_journeys.rsid
          OR COALESCE(excluded.operator_code, service_journeys.operator_code) IS NOT service_journeys.operator_code
          OR COALESCE(excluded.operator_thing_id, service_journeys.operator_thing_id) IS NOT service_journeys.operator_thing_id
          OR COALESCE(excluded.origin_name, service_journeys.origin_name) IS NOT service_journeys.origin_name
          OR COALESCE(excluded.destination_name, service_journeys.destination_name) IS NOT service_journeys.destination_name
          OR COALESCE(excluded.service_type, service_journeys.service_type) IS NOT service_journeys.service_type
          OR COALESCE(excluded.category, service_journeys.category) IS NOT service_journeys.category
          OR COALESCE(excluded.activities, service_journeys.activities) IS NOT service_journeys.activities
          OR COALESCE(excluded.service_length, service_journeys.service_length) IS NOT service_journeys.service_length
          OR COALESCE(excluded.is_passenger_service, service_journeys.is_passenger_service) IS NOT service_journeys.is_passenger_service
          OR COALESCE(excluded.is_charter, service_journeys.is_charter) IS NOT service_journeys.is_charter
          OR COALESCE(excluded.is_reverse_formation, service_journeys.is_reverse_formation) IS NOT service_journeys.is_reverse_formation
          OR COALESCE(excluded.detach_front, service_journeys.detach_front) IS NOT service_journeys.detach_front
          OR COALESCE(excluded.scheduled_start_ts, service_journeys.scheduled_start_ts) IS NOT service_journeys.scheduled_start_ts
          OR COALESCE(excluded.expected_start_ts, service_journeys.expected_start_ts) IS NOT service_journeys.expected_start_ts
          OR excluded.status IS NOT service_journeys.status
          OR COALESCE(excluded.delay_minutes, service_journeys.delay_minutes) IS NOT service_journeys.delay_minutes
          OR COALESCE(excluded.cancellation_reason, service_journeys.cancellation_reason) IS NOT service_journeys.cancellation_reason
        )
    `)
    .bind(
      row.service_key,
      serviceId,
      row.train_run_key,
      trainRunId,
      row.rid ?? null,
      row.uid ?? null,
      row.train_id ?? null,
      row.rsid ?? null,
      row.operator_code,
      operatorId,
      row.origin_name,
      row.destination_name,
      row.service_type ?? null,
      row.category ?? null,
      row.activities ?? null,
      row.service_length ?? null,
      row.is_passenger_service ?? null,
      row.is_charter ?? null,
      row.is_reverse_formation ?? null,
      row.detach_front ?? null,
      row.scheduled_start_ts,
      row.expected_start_ts,
      row.status,
      row.delay_minutes,
      row.cancellation_reason,
      row.last_event_id,
      row.updated_at,
    );
}
