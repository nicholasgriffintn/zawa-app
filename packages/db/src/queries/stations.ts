import { runD1Batch, type D1DatabaseLike, type D1StatementLike, writeAccepted } from "../d1";
import { deactivateRailThings, serviceThingId, stationThingId, upsertRailThing } from "./ontology";

export interface StationBoardRow {
  station_key: string;
  board_type: string;
  service_key: string;
  scheduled_ts: string | null;
  expected_ts: string | null;
  platform: string | null;
  origin_name: string | null;
  destination_name: string | null;
  via_name: string | null;
  service_type: string | null;
  operator_code: string | null;
  status: string;
  updated_at: string;
}

export interface StationBoardPage {
  rows: StationBoardRow[];
  nextCursor: string | null;
}

export interface StationBoardReplaceResult {
  upsertedRows: StationBoardCurrentWrite[];
  removedServiceKeys: string[];
}

export interface StationBoardRefreshCandidate {
  station_key: string;
  board_type: "departures" | "arrivals";
  last_refresh_at: string | null;
}

export interface StationSummaryRow {
  station_key: string;
  station_name: string | null;
  service_count: number;
  next_scheduled_ts: string | null;
  last_updated_at: string | null;
}

export interface StationBoardCurrentWrite {
  station_key: string;
  board_type: "departures" | "arrivals";
  service_key: string;
  scheduled_ts: string | null;
  expected_ts: string | null;
  platform: string | null;
  destination_name: string | null;
  status: string;
  updated_at: string;
}

interface StationBoardCurrentRow {
  service_key: string;
  scheduled_ts: string | null;
  expected_ts: string | null;
  platform: string | null;
  destination_name: string | null;
  status: string;
  updated_at: string;
}

export interface StationBoardStatusPatch {
  station_key: string;
  board_type: "departures" | "arrivals";
  service_key: string;
  scheduled_ts: string | null;
  expected_ts: string | null;
  platform: string | null;
  destination_name: string | null;
  status: string;
  updated_at: string;
}

export async function upsertStationBoardCurrent(
  db: D1DatabaseLike,
  row: StationBoardCurrentWrite,
): Promise<boolean> {
  const stationId = stationThingId(row.station_key);
  const serviceId = serviceThingId(row.service_key);
  await upsertRailThing(db, {
    thingId: stationId,
    thingType: "rail:Station",
    preferredLabel: row.station_key,
    updatedAt: row.updated_at,
    identifiers: [{ scheme: "rail:crs", value: row.station_key, primary: true }],
  });
  await upsertRailThing(db, {
    thingId: serviceId,
    thingType: "rail:ServiceJourney",
    preferredLabel: row.destination_name ?? row.service_key,
    updatedAt: row.updated_at,
    identifiers: [{ scheme: "rail:service-key", value: row.service_key, primary: true }],
    objectTriples: [{ predicateId: "rail:callsAt", objectThingId: stationId }],
  });
  const result = await stationBoardCurrentStatement(db, row, stationId, serviceId).run();

  return writeAccepted(result);
}

function stationBoardCurrentStatement(
  db: D1DatabaseLike,
  row: StationBoardCurrentWrite,
  stationId: string,
  serviceId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO station_board_entries (
        station_key, station_thing_id, board_type, service_key, service_thing_id,
        scheduled_ts, expected_ts, platform, destination_name, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(station_key, board_type, service_key) DO UPDATE SET
        station_thing_id = excluded.station_thing_id,
        service_thing_id = excluded.service_thing_id,
        scheduled_ts = COALESCE(excluded.scheduled_ts, station_board_entries.scheduled_ts),
        expected_ts = COALESCE(excluded.expected_ts, station_board_entries.expected_ts),
        platform = COALESCE(excluded.platform, station_board_entries.platform),
        destination_name = COALESCE(excluded.destination_name, station_board_entries.destination_name),
        status = excluded.status,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= station_board_entries.updated_at
        AND (
          COALESCE(excluded.scheduled_ts, station_board_entries.scheduled_ts) IS NOT station_board_entries.scheduled_ts
          OR COALESCE(excluded.expected_ts, station_board_entries.expected_ts) IS NOT station_board_entries.expected_ts
          OR COALESCE(excluded.platform, station_board_entries.platform) IS NOT station_board_entries.platform
          OR COALESCE(excluded.destination_name, station_board_entries.destination_name) IS NOT station_board_entries.destination_name
          OR excluded.status IS NOT station_board_entries.status
        )
    `,
    )
    .bind(
      row.station_key,
      stationId,
      row.board_type,
      row.service_key,
      serviceId,
      row.scheduled_ts,
      row.expected_ts,
      row.platform,
      row.destination_name,
      row.status,
      row.updated_at,
    );
}

export async function replaceStationBoardCurrent(
  db: D1DatabaseLike,
  stationKey: string,
  boardType: "departures" | "arrivals",
  rows: StationBoardCurrentWrite[],
): Promise<StationBoardReplaceResult> {
  const current = await db
    .prepare(
      `
      SELECT
        service_key,
        scheduled_ts,
        expected_ts,
        platform,
        destination_name,
        status,
        updated_at
      FROM station_board_entries
      WHERE station_key = ? AND board_type = ?
    `,
    )
    .bind(stationKey, boardType)
    .all<StationBoardCurrentRow>();

  const currentByServiceKey = new Map(current.results.map((row) => [row.service_key, row]));
  const snapshotKeys = new Set(rows.map((row) => row.service_key));
  const removedServiceKeys = current.results
    .map((row) => row.service_key)
    .filter((serviceKey) => !snapshotKeys.has(serviceKey));

  const upsertedRows: StationBoardCurrentWrite[] = [];
  const upsertStatements: D1StatementLike[] = [];
  const upsertCandidateRows: StationBoardCurrentWrite[] = [];
  for (const row of rows) {
    if (stationBoardWriteMatchesCurrent(row, currentByServiceKey.get(row.service_key))) {
      continue;
    }

    const stationId = stationThingId(row.station_key);
    const serviceId = serviceThingId(row.service_key);
    await upsertRailThing(db, {
      thingId: stationId,
      thingType: "rail:Station",
      preferredLabel: row.station_key,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rail:crs", value: row.station_key, primary: true }],
    });
    await upsertRailThing(db, {
      thingId: serviceId,
      thingType: "rail:ServiceJourney",
      preferredLabel: row.destination_name ?? row.service_key,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rail:service-key", value: row.service_key, primary: true }],
      objectTriples: [{ predicateId: "rail:callsAt", objectThingId: stationId }],
    });
    upsertCandidateRows.push(row);
    upsertStatements.push(stationBoardCurrentStatement(db, row, stationId, serviceId));
  }

  const upsertResults = await runD1Batch(db, upsertStatements);
  for (const [index, result] of upsertResults.entries()) {
    if (writeAccepted(result)) upsertedRows.push(upsertCandidateRows[index]);
  }

  const deleteStatements: D1StatementLike[] = [];
  for (const serviceKey of removedServiceKeys) {
    deleteStatements.push(
      db
        .prepare(
          `
        DELETE FROM station_board_entries
        WHERE station_key = ? AND board_type = ? AND service_key = ?
      `,
        )
        .bind(stationKey, boardType, serviceKey),
    );
  }
  await runD1Batch(db, deleteStatements);
  await deactivateUnreferencedServiceThings(
    db,
    removedServiceKeys,
    rows[0]?.updated_at ?? new Date().toISOString(),
  );

  return { upsertedRows, removedServiceKeys };
}

async function deactivateUnreferencedServiceThings(
  db: D1DatabaseLike,
  serviceKeys: string[],
  updatedAt: string,
): Promise<void> {
  const staleThingIds: string[] = [];
  const uniqueServiceKeys = [...new Set(serviceKeys)];

  for (const serviceKey of uniqueServiceKeys) {
    const referenced = await db
      .prepare(
        `
        SELECT 1 AS has_reference
        WHERE EXISTS (SELECT 1 FROM station_board_entries WHERE service_key = ?)
           OR EXISTS (SELECT 1 FROM service_call_points WHERE service_key = ?)
           OR EXISTS (SELECT 1 FROM service_formations WHERE service_key = ?)
           OR EXISTS (SELECT 1 FROM train_movements WHERE service_key = ?)
        LIMIT 1
      `,
      )
      .bind(serviceKey, serviceKey, serviceKey, serviceKey)
      .first<{ has_reference: number }>();

    if (!referenced) staleThingIds.push(serviceThingId(serviceKey));
  }

  await deactivateRailThings(db, staleThingIds, updatedAt);
}

export async function markStationBoardRefreshRequested(
  db: D1DatabaseLike,
  stationKey: string,
  boardType: "departures" | "arrivals",
  requestedAt: string,
): Promise<void> {
  await stationBoardRefreshRequestedStatement(db, stationKey, boardType, requestedAt).run();
}

export async function markStationBoardRefreshRequests(
  db: D1DatabaseLike,
  rows: Array<{ station_key: string; board_type: "departures" | "arrivals" }>,
  requestedAt: string,
): Promise<void> {
  await runD1Batch(
    db,
    rows.map((row) =>
      stationBoardRefreshRequestedStatement(db, row.station_key, row.board_type, requestedAt),
    ),
  );
}

function stationBoardRefreshRequestedStatement(
  db: D1DatabaseLike,
  stationKey: string,
  boardType: "departures" | "arrivals",
  requestedAt: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO station_board_refreshes (
        station_key, board_type, last_requested_at, updated_at
      )
      SELECT ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM station_profiles WHERE station_key = ?
      )
      ON CONFLICT(station_key, board_type) DO UPDATE SET
        last_requested_at = excluded.last_requested_at,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= station_board_refreshes.updated_at
    `,
    )
    .bind(stationKey, boardType, requestedAt, requestedAt, stationKey);
}

export async function markStationBoardRefreshed(
  db: D1DatabaseLike,
  stationKey: string,
  boardType: "departures" | "arrivals",
  refreshedAt: string,
  rowCount: number,
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO station_board_refreshes (
        station_key, board_type, last_refreshed_at, row_count, updated_at
      )
      SELECT ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM station_profiles WHERE station_key = ?
      )
      ON CONFLICT(station_key, board_type) DO UPDATE SET
        last_refreshed_at = excluded.last_refreshed_at,
        row_count = excluded.row_count,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= station_board_refreshes.updated_at
    `,
    )
    .bind(
      stationKey,
      boardType,
      refreshedAt,
      Math.max(0, Math.trunc(rowCount)),
      refreshedAt,
      stationKey,
    )
    .run();
}

export async function listStationBoardsDueForRefresh(
  db: D1DatabaseLike,
  staleBeforeIso: string,
  limit: number,
): Promise<StationBoardRefreshCandidate[]> {
  const pageLimit = Math.max(1, Math.trunc(limit));
  const result = await db
    .prepare(
      `
      WITH board_types(board_type) AS (
        VALUES ('departures'), ('arrivals')
      )
      SELECT
        station_profiles.station_key,
        board_types.board_type,
        COALESCE(
          station_board_refreshes.last_refreshed_at,
          station_board_refreshes.last_requested_at,
          MAX(station_board_entries.updated_at)
        ) AS last_refresh_at
      FROM station_profiles
      CROSS JOIN board_types
      LEFT JOIN station_board_entries
        ON station_board_entries.station_key = station_profiles.station_key
        AND station_board_entries.board_type = board_types.board_type
      LEFT JOIN station_board_refreshes
        ON station_board_refreshes.station_key = station_profiles.station_key
        AND station_board_refreshes.board_type = board_types.board_type
      WHERE station_profiles.is_active = 1
      GROUP BY station_profiles.station_key, board_types.board_type
      HAVING last_refresh_at IS NULL OR last_refresh_at < ?
      ORDER BY
        last_refresh_at IS NOT NULL,
        last_refresh_at ASC,
        station_profiles.station_key ASC,
        board_types.board_type ASC
      LIMIT ?
    `,
    )
    .bind(staleBeforeIso, pageLimit)
    .all<StationBoardRefreshCandidate>();

  return result.results;
}

export async function getStationBoard(
  db: D1DatabaseLike,
  stationKey: string,
  boardType = "departures",
  limit = 50,
): Promise<StationBoardRow[]> {
  return (await getStationBoardPage(db, stationKey, boardType, limit)).rows;
}

export async function getStationBoardPage(
  db: D1DatabaseLike,
  stationKey: string,
  boardType = "departures",
  limit = 50,
  cursor?: string | null,
  activeSinceIso?: string | null,
): Promise<StationBoardPage> {
  const pageLimit = clampBoardLimit(limit);
  const cursorParts = parseBoardCursor(cursor);
  const result = await db
    .prepare(
      `
      SELECT
        board.station_key,
        board.board_type,
        board.service_key,
        board.scheduled_ts,
        board.expected_ts,
        board.platform,
        services.origin_name,
        board.destination_name,
        (
          SELECT stop.station_name
          FROM service_call_points stop
          WHERE
            stop.service_key = board.service_key
            AND stop.station_key != board.station_key
            AND stop.station_name IS NOT NULL
          ORDER BY stop.stop_index ASC
          LIMIT 1
        ) AS via_name,
        services.service_type,
        services.operator_code,
        board.status,
        board.updated_at,
        COALESCE(board.scheduled_ts, board.expected_ts, board.updated_at) AS sort_ts
      FROM station_board_entries board
      LEFT JOIN service_journeys services ON services.service_key = board.service_key
      WHERE
        board.station_key = ?
        AND board.board_type = ?
        AND (
          ? IS NULL
          OR COALESCE(board.expected_ts, board.scheduled_ts, board.updated_at) >= ?
        )
        AND (
          ? IS NULL
          OR COALESCE(board.scheduled_ts, board.expected_ts, board.updated_at) > ?
          OR (
            COALESCE(board.scheduled_ts, board.expected_ts, board.updated_at) = ?
            AND board.service_key > ?
          )
        )
      ORDER BY COALESCE(board.scheduled_ts, board.expected_ts, board.updated_at) ASC, board.service_key ASC
      LIMIT ?
    `,
    )
    .bind(
      stationKey,
      boardType,
      activeSinceIso ?? null,
      activeSinceIso ?? null,
      cursorParts?.sortTime ?? null,
      cursorParts?.sortTime ?? null,
      cursorParts?.sortTime ?? null,
      cursorParts?.serviceKey ?? "",
      pageLimit + 1,
    )
    .all<StationBoardRow & { sort_ts: string }>();

  const rows = result.results.slice(0, pageLimit).map(({ sort_ts: _sortTime, ...row }) => row);
  const nextRow = result.results[pageLimit];
  const lastRow = result.results[Math.min(result.results.length, pageLimit) - 1];

  return {
    rows,
    nextCursor: nextRow && lastRow ? createBoardCursor(lastRow.sort_ts, lastRow.service_key) : null,
  };
}

export async function patchStationBoardStatusForService(
  db: D1DatabaseLike,
  serviceKey: string,
  status: string,
  updatedAt: string,
): Promise<StationBoardStatusPatch[]> {
  const currentRows = await db
    .prepare(
      `
      SELECT
        station_key,
        board_type,
        service_key,
        scheduled_ts,
        expected_ts,
        platform,
        destination_name,
        status,
        updated_at
      FROM station_board_entries
      WHERE service_key = ? AND updated_at <= ? AND status IS NOT ?
    `,
    )
    .bind(serviceKey, updatedAt, status)
    .all<StationBoardStatusPatch>();

  if (currentRows.results.length === 0) return [];

  await db
    .prepare(
      `
      UPDATE station_board_entries
      SET status = ?, updated_at = ?
      WHERE service_key = ? AND updated_at <= ? AND status IS NOT ?
    `,
    )
    .bind(status, updatedAt, serviceKey, updatedAt, status)
    .run();

  return currentRows.results.map((row) => ({
    ...row,
    status,
    updated_at: updatedAt,
  }));
}

export async function listStations(
  db: D1DatabaseLike,
  query = "",
  limit = 20,
): Promise<StationSummaryRow[]> {
  const stationQuery = query.trim().toUpperCase();
  const likeQuery = `%${stationQuery}%`;
  const result = await db
    .prepare(
      `
      SELECT
        board.station_key,
        MIN(stops.station_name) AS station_name,
        COUNT(DISTINCT board.service_key) AS service_count,
        MIN(board.scheduled_ts) AS next_scheduled_ts,
        MAX(board.updated_at) AS last_updated_at
      FROM station_board_entries board
      LEFT JOIN service_call_points stops
        ON stops.station_key = board.station_key
        AND stops.station_name IS NOT NULL
      WHERE (
        ? = ''
        OR board.station_key LIKE ?
        OR UPPER(stops.station_name) LIKE ?
      )
      GROUP BY board.station_key
      ORDER BY last_updated_at DESC, station_key ASC
      LIMIT ?
    `,
    )
    .bind(stationQuery, likeQuery, likeQuery, limit)
    .all<StationSummaryRow>();

  return result.results;
}

export async function getStationName(
  db: D1DatabaseLike,
  stationKey: string,
): Promise<string | null> {
  const result = await db
    .prepare(
      `
      SELECT MIN(station_name) AS station_name
      FROM service_call_points
      WHERE station_key = ? AND station_name IS NOT NULL
    `,
    )
    .bind(stationKey)
    .first<{ station_name: string | null }>();

  return result?.station_name ?? null;
}

function clampBoardLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 8;
  return Math.min(50, Math.max(1, Math.trunc(limit)));
}

function stationBoardWriteMatchesCurrent(
  row: StationBoardCurrentWrite,
  current: StationBoardCurrentRow | undefined,
): boolean {
  if (!current) return false;
  if (row.updated_at < current.updated_at) return true;

  return (
    (row.scheduled_ts ?? current.scheduled_ts) === current.scheduled_ts &&
    (row.expected_ts ?? current.expected_ts) === current.expected_ts &&
    (row.platform ?? current.platform) === current.platform &&
    (row.destination_name ?? current.destination_name) === current.destination_name &&
    row.status === current.status
  );
}

function createBoardCursor(sortTime: string, serviceKey: string): string {
  return `${sortTime}|${serviceKey}`;
}

function parseBoardCursor(cursor: string | null | undefined): {
  sortTime: string;
  serviceKey: string;
} | null {
  if (!cursor) return null;

  const separatorIndex = cursor.indexOf("|");
  if (separatorIndex <= 0 || separatorIndex === cursor.length - 1) return null;

  return {
    sortTime: cursor.slice(0, separatorIndex),
    serviceKey: cursor.slice(separatorIndex + 1),
  };
}
