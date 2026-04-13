import { runD1Batch, type D1DatabaseLike, type D1StatementLike, writeAccepted } from "../d1";
import { type RailThingWrite, serviceThingId, stationThingId, upsertRailThings } from "./ontology";

export interface ServiceStopRow {
  service_key: string;
  stop_index: number;
  station_key: string;
  station_name: string | null;
  tiploc?: string | null;
  scheduled_arrival_ts: string | null;
  expected_arrival_ts: string | null;
  actual_arrival_ts?: string | null;
  scheduled_departure_ts: string | null;
  expected_departure_ts: string | null;
  actual_departure_ts?: string | null;
  arrival_type?: string | null;
  arrival_source?: string | null;
  arrival_source_instance?: string | null;
  departure_type?: string | null;
  departure_source?: string | null;
  departure_source_instance?: string | null;
  platform: string | null;
  platform_is_hidden?: number | null;
  path?: string | null;
  line?: string | null;
  activities?: string | null;
  is_pass?: number | null;
  is_operational?: number | null;
  stop_cancel_reason?: string | null;
  stop_delay_reason?: string | null;
  stop_status: string | null;
  updated_at: string;
}

export async function upsertServiceStopCurrent(
  db: D1DatabaseLike,
  row: ServiceStopRow,
): Promise<boolean> {
  const serviceId = serviceThingId(row.service_key);
  const stationId = stationThingId(row.station_key);
  await upsertRailThings(db, serviceAndStationThingWrites(row, serviceId, stationId));
  const result = await serviceStopStatement(db, row, serviceId, stationId).run();

  return writeAccepted(result);
}

export async function upsertServiceStopCurrents(
  db: D1DatabaseLike,
  rows: ServiceStopRow[],
): Promise<boolean[]> {
  const statements: D1StatementLike[] = [];
  const thingWrites: RailThingWrite[] = [];

  for (const row of rows) {
    const serviceId = serviceThingId(row.service_key);
    const stationId = stationThingId(row.station_key);
    thingWrites.push(...serviceAndStationThingWrites(row, serviceId, stationId));
    statements.push(serviceStopStatement(db, row, serviceId, stationId));
  }

  await upsertRailThings(db, thingWrites);
  const results = await runD1Batch(db, statements);
  return results.map(writeAccepted);
}

function serviceStopStatement(
  db: D1DatabaseLike,
  row: ServiceStopRow,
  serviceId: string,
  stationId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO service_call_points (
        service_key, service_thing_id, stop_index, station_key, station_thing_id,
        station_name, tiploc,
        scheduled_arrival_ts, expected_arrival_ts, actual_arrival_ts,
        scheduled_departure_ts, expected_departure_ts, actual_departure_ts,
        arrival_type, arrival_source, arrival_source_instance,
        departure_type, departure_source, departure_source_instance,
        platform, platform_is_hidden, path, line, activities, is_pass,
        is_operational, stop_cancel_reason, stop_delay_reason, stop_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(service_key, stop_index) DO UPDATE SET
        service_thing_id = excluded.service_thing_id,
        station_key = excluded.station_key,
        station_thing_id = excluded.station_thing_id,
        station_name = COALESCE(excluded.station_name, service_call_points.station_name),
        tiploc = COALESCE(excluded.tiploc, service_call_points.tiploc),
        scheduled_arrival_ts = COALESCE(excluded.scheduled_arrival_ts, service_call_points.scheduled_arrival_ts),
        expected_arrival_ts = COALESCE(excluded.expected_arrival_ts, service_call_points.expected_arrival_ts),
        actual_arrival_ts = COALESCE(excluded.actual_arrival_ts, service_call_points.actual_arrival_ts),
        scheduled_departure_ts = COALESCE(excluded.scheduled_departure_ts, service_call_points.scheduled_departure_ts),
        expected_departure_ts = COALESCE(excluded.expected_departure_ts, service_call_points.expected_departure_ts),
        actual_departure_ts = COALESCE(excluded.actual_departure_ts, service_call_points.actual_departure_ts),
        arrival_type = COALESCE(excluded.arrival_type, service_call_points.arrival_type),
        arrival_source = COALESCE(excluded.arrival_source, service_call_points.arrival_source),
        arrival_source_instance = COALESCE(excluded.arrival_source_instance, service_call_points.arrival_source_instance),
        departure_type = COALESCE(excluded.departure_type, service_call_points.departure_type),
        departure_source = COALESCE(excluded.departure_source, service_call_points.departure_source),
        departure_source_instance = COALESCE(excluded.departure_source_instance, service_call_points.departure_source_instance),
        platform = COALESCE(excluded.platform, service_call_points.platform),
        platform_is_hidden = COALESCE(excluded.platform_is_hidden, service_call_points.platform_is_hidden),
        path = COALESCE(excluded.path, service_call_points.path),
        line = COALESCE(excluded.line, service_call_points.line),
        activities = COALESCE(excluded.activities, service_call_points.activities),
        is_pass = COALESCE(excluded.is_pass, service_call_points.is_pass),
        is_operational = COALESCE(excluded.is_operational, service_call_points.is_operational),
        stop_cancel_reason = COALESCE(excluded.stop_cancel_reason, service_call_points.stop_cancel_reason),
        stop_delay_reason = COALESCE(excluded.stop_delay_reason, service_call_points.stop_delay_reason),
        stop_status = COALESCE(excluded.stop_status, service_call_points.stop_status),
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= service_call_points.updated_at
        AND (
          excluded.station_key IS NOT service_call_points.station_key
          OR COALESCE(excluded.station_name, service_call_points.station_name) IS NOT service_call_points.station_name
          OR COALESCE(excluded.tiploc, service_call_points.tiploc) IS NOT service_call_points.tiploc
          OR COALESCE(excluded.scheduled_arrival_ts, service_call_points.scheduled_arrival_ts) IS NOT service_call_points.scheduled_arrival_ts
          OR COALESCE(excluded.expected_arrival_ts, service_call_points.expected_arrival_ts) IS NOT service_call_points.expected_arrival_ts
          OR COALESCE(excluded.actual_arrival_ts, service_call_points.actual_arrival_ts) IS NOT service_call_points.actual_arrival_ts
          OR COALESCE(excluded.scheduled_departure_ts, service_call_points.scheduled_departure_ts) IS NOT service_call_points.scheduled_departure_ts
          OR COALESCE(excluded.expected_departure_ts, service_call_points.expected_departure_ts) IS NOT service_call_points.expected_departure_ts
          OR COALESCE(excluded.actual_departure_ts, service_call_points.actual_departure_ts) IS NOT service_call_points.actual_departure_ts
          OR COALESCE(excluded.arrival_type, service_call_points.arrival_type) IS NOT service_call_points.arrival_type
          OR COALESCE(excluded.arrival_source, service_call_points.arrival_source) IS NOT service_call_points.arrival_source
          OR COALESCE(excluded.arrival_source_instance, service_call_points.arrival_source_instance) IS NOT service_call_points.arrival_source_instance
          OR COALESCE(excluded.departure_type, service_call_points.departure_type) IS NOT service_call_points.departure_type
          OR COALESCE(excluded.departure_source, service_call_points.departure_source) IS NOT service_call_points.departure_source
          OR COALESCE(excluded.departure_source_instance, service_call_points.departure_source_instance) IS NOT service_call_points.departure_source_instance
          OR COALESCE(excluded.platform, service_call_points.platform) IS NOT service_call_points.platform
          OR COALESCE(excluded.platform_is_hidden, service_call_points.platform_is_hidden) IS NOT service_call_points.platform_is_hidden
          OR COALESCE(excluded.path, service_call_points.path) IS NOT service_call_points.path
          OR COALESCE(excluded.line, service_call_points.line) IS NOT service_call_points.line
          OR COALESCE(excluded.activities, service_call_points.activities) IS NOT service_call_points.activities
          OR COALESCE(excluded.is_pass, service_call_points.is_pass) IS NOT service_call_points.is_pass
          OR COALESCE(excluded.is_operational, service_call_points.is_operational) IS NOT service_call_points.is_operational
          OR COALESCE(excluded.stop_cancel_reason, service_call_points.stop_cancel_reason) IS NOT service_call_points.stop_cancel_reason
          OR COALESCE(excluded.stop_delay_reason, service_call_points.stop_delay_reason) IS NOT service_call_points.stop_delay_reason
          OR COALESCE(excluded.stop_status, service_call_points.stop_status) IS NOT service_call_points.stop_status
        )
    `,
    )
    .bind(
      row.service_key,
      serviceId,
      row.stop_index,
      row.station_key,
      stationId,
      row.station_name,
      row.tiploc ?? null,
      row.scheduled_arrival_ts,
      row.expected_arrival_ts,
      row.actual_arrival_ts ?? null,
      row.scheduled_departure_ts,
      row.expected_departure_ts,
      row.actual_departure_ts ?? null,
      row.arrival_type ?? null,
      row.arrival_source ?? null,
      row.arrival_source_instance ?? null,
      row.departure_type ?? null,
      row.departure_source ?? null,
      row.departure_source_instance ?? null,
      row.platform,
      row.platform_is_hidden ?? null,
      row.path ?? null,
      row.line ?? null,
      row.activities ?? null,
      row.is_pass ?? null,
      row.is_operational ?? null,
      row.stop_cancel_reason ?? null,
      row.stop_delay_reason ?? null,
      row.stop_status,
      row.updated_at,
    );
}

export async function upsertServiceLocationStopCurrent(
  db: D1DatabaseLike,
  row: Omit<ServiceStopRow, "stop_index">,
): Promise<boolean> {
  await ensureServiceAndStationThings(
    db,
    row,
    serviceThingId(row.service_key),
    stationThingId(row.station_key),
  );
  const updateResult = await db
    .prepare(
      `
      UPDATE service_call_points
      SET
        station_name = COALESCE(?, station_name),
        tiploc = COALESCE(?, tiploc),
        scheduled_arrival_ts = COALESCE(?, scheduled_arrival_ts),
        expected_arrival_ts = COALESCE(?, expected_arrival_ts),
        actual_arrival_ts = COALESCE(?, actual_arrival_ts),
        scheduled_departure_ts = COALESCE(?, scheduled_departure_ts),
        expected_departure_ts = COALESCE(?, expected_departure_ts),
        actual_departure_ts = COALESCE(?, actual_departure_ts),
        platform = COALESCE(?, platform),
        path = COALESCE(?, path),
        line = COALESCE(?, line),
        stop_status = COALESCE(?, stop_status),
        updated_at = ?
      WHERE
        service_key = ?
        AND station_key = ?
        AND updated_at <= ?
        AND (
          COALESCE(?, station_name) IS NOT station_name
          OR COALESCE(?, tiploc) IS NOT tiploc
          OR COALESCE(?, scheduled_arrival_ts) IS NOT scheduled_arrival_ts
          OR COALESCE(?, expected_arrival_ts) IS NOT expected_arrival_ts
          OR COALESCE(?, actual_arrival_ts) IS NOT actual_arrival_ts
          OR COALESCE(?, scheduled_departure_ts) IS NOT scheduled_departure_ts
          OR COALESCE(?, expected_departure_ts) IS NOT expected_departure_ts
          OR COALESCE(?, actual_departure_ts) IS NOT actual_departure_ts
          OR COALESCE(?, platform) IS NOT platform
          OR COALESCE(?, path) IS NOT path
          OR COALESCE(?, line) IS NOT line
          OR COALESCE(?, stop_status) IS NOT stop_status
        )
    `,
    )
    .bind(
      row.station_name,
      row.tiploc ?? null,
      row.scheduled_arrival_ts,
      row.expected_arrival_ts,
      row.actual_arrival_ts ?? null,
      row.scheduled_departure_ts,
      row.expected_departure_ts,
      row.actual_departure_ts ?? null,
      row.platform,
      row.path ?? null,
      row.line ?? null,
      row.stop_status,
      row.updated_at,
      row.service_key,
      row.station_key,
      row.updated_at,
      row.station_name,
      row.tiploc ?? null,
      row.scheduled_arrival_ts,
      row.expected_arrival_ts,
      row.actual_arrival_ts ?? null,
      row.scheduled_departure_ts,
      row.expected_departure_ts,
      row.actual_departure_ts ?? null,
      row.platform,
      row.path ?? null,
      row.line ?? null,
      row.stop_status,
    )
    .run();

  if (writeAccepted(updateResult)) return true;

  if (await serviceLocationStopExists(db, row.service_key, row.station_key)) return false;

  const currentState = await db
    .prepare(
      `
      SELECT
        COALESCE(MAX(stop_index) + 1, 0) AS next_stop_index,
        MAX(updated_at) AS latest_updated_at
      FROM service_call_points
      WHERE service_key = ?
    `,
    )
    .bind(row.service_key)
    .first<{ next_stop_index: number; latest_updated_at: string | null }>();

  if (currentState?.latest_updated_at && currentState.latest_updated_at > row.updated_at) {
    return false;
  }

  return upsertServiceStopCurrent(db, {
    ...row,
    stop_index: currentState?.next_stop_index ?? 0,
  });
}

async function ensureServiceAndStationThings(
  db: D1DatabaseLike,
  row: Pick<ServiceStopRow, "service_key" | "station_key" | "station_name" | "updated_at">,
  serviceId: string,
  stationId: string,
): Promise<void> {
  await upsertRailThings(db, serviceAndStationThingWrites(row, serviceId, stationId));
}

function serviceAndStationThingWrites(
  row: Pick<ServiceStopRow, "service_key" | "station_key" | "station_name" | "updated_at">,
  serviceId: string,
  stationId: string,
): RailThingWrite[] {
  return [
    {
      thingId: stationId,
      thingType: "rail:Station",
      preferredLabel: row.station_name ?? row.station_key,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rail:crs", value: row.station_key, primary: true }],
    },
    {
      thingId: serviceId,
      thingType: "rail:ServiceJourney",
      preferredLabel: row.service_key,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rail:service-key", value: row.service_key, primary: true }],
      objectTriples: [{ predicateId: "rail:callsAt", objectThingId: stationId }],
    },
  ];
}

export async function patchServiceStopsStatusForService(
  db: D1DatabaseLike,
  serviceKey: string,
  status: string,
  updatedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `
      UPDATE service_call_points
      SET stop_status = ?, updated_at = ?
      WHERE service_key = ? AND updated_at <= ? AND stop_status IS NOT ?
    `,
    )
    .bind(status, updatedAt, serviceKey, updatedAt, status)
    .run();

  return writeAccepted(result);
}

async function serviceLocationStopExists(
  db: D1DatabaseLike,
  serviceKey: string,
  stationKey: string,
): Promise<boolean> {
  const current = await db
    .prepare(
      `
      SELECT 1 AS existing_stop
      FROM service_call_points
      WHERE service_key = ? AND station_key = ?
      LIMIT 1
    `,
    )
    .bind(serviceKey, stationKey)
    .first<{ existing_stop: number }>();

  return current !== null;
}
