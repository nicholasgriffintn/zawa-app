import { runD1Batch, type D1DatabaseLike, type D1StatementLike } from "../d1";
import {
  loadingCategoryThingId,
  operatorThingId,
  RAIL_SOURCE_KEY,
  reasonCodeThingId,
  sourceInstanceThingId,
  stationThingId,
  upsertRailThing,
} from "./ontology";

export interface ReferenceStationSummary {
  station_key: string;
  station_thing_id: string;
  station_name: string;
  service_count: number;
  next_scheduled_ts: string | null;
  last_updated_at: string | null;
}

export interface ReferenceStationProfile {
  station_key: string;
  station_name: string;
  sixteen_character_name: string | null;
  national_location_code: string | null;
  station_operator: string | null;
  latitude: number | null;
  longitude: number | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  address_line_4: string | null;
  postcode: string | null;
  staffing_level: string | null;
  cctv_available: number | null;
  cis_modes: string | null;
  customer_help_points_available: number | null;
  ticket_office_available: number | null;
  ticket_machine_available: number | null;
  oyster_accepted: number | null;
  smartcard_validator: number | null;
  seated_area_available: number | null;
  waiting_room_available: number | null;
  toilets_available: number | null;
  wifi_available: number | null;
  induction_loop: number | null;
  accessible_ticket_machines: number | null;
  ramp_for_train_access: number | null;
  accessible_taxis_available: number | null;
  national_key_toilets_available: number | null;
  step_free_access_coverage: string | null;
  impaired_mobility_set_down_available: number | null;
  cycle_storage_spaces: number | null;
  car_park_spaces: number | null;
  accessible_car_park_spaces: number | null;
  rail_replacement_map_url: string | null;
  profile_status: string | null;
  profile_checked_at: string | null;
  updated_at: string;
}

export interface RdmSyncState {
  source_key: string;
  source_version: string | null;
  status: string;
  item_count: number;
  cursor: string | null;
  last_checked_at: string;
  last_changed_at: string | null;
  error_message: string | null;
}

export interface ReferenceStationWrite {
  station_key: string;
  station_name: string;
  sixteen_character_name?: string | null;
  national_location_code?: string | null;
  station_operator?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_version: string | null;
  profile_hash?: string | null;
  profile_updated_at?: string | null;
  updated_at: string;
}

export interface ReferenceTocWrite {
  toc_code: string;
  toc_name: string;
  source_version: string | null;
  updated_at: string;
}

export interface ReferenceReasonCodeWrite {
  reason_code: string;
  late_reason: string | null;
  cancellation_reason: string | null;
  updated_at: string;
}

export interface ReferenceLoadingCategoryWrite {
  category_code: string;
  category_name: string | null;
  typical_description: string | null;
  expected_description: string | null;
  definition: string | null;
  colour: string | null;
  image: string | null;
  toc_code: string | null;
  source_version: string | null;
  updated_at: string;
}

export interface ReferenceSourceInstanceWrite {
  source_instance_id: string;
  source_instance_name: string;
  updated_at: string;
}

interface CurrentReferenceStationRow {
  station_key: string;
  station_name: string;
  sixteen_character_name: string | null;
  national_location_code: string | null;
  station_operator: string | null;
  latitude: number | null;
  longitude: number | null;
  profile_hash: string | null;
  profile_updated_at: string | null;
  is_active: number;
}

export async function getRdmSyncState(
  db: D1DatabaseLike,
  sourceKey: string,
): Promise<RdmSyncState | null> {
  return db
    .prepare(
      `
      SELECT
        sync_key AS source_key, source_version, status, item_count, cursor,
        last_checked_at, last_changed_at, error_message
      FROM source_sync_runs
      WHERE source_key = ? AND sync_key = ?
    `,
    )
    .bind(RAIL_SOURCE_KEY, sourceKey)
    .first<RdmSyncState>();
}

export async function upsertRdmSyncState(db: D1DatabaseLike, state: RdmSyncState): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO source_sync_runs (
        source_key, sync_key, source_version, status, item_count, cursor,
        last_checked_at, last_changed_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_key, sync_key) DO UPDATE SET
        source_version = excluded.source_version,
        status = excluded.status,
        item_count = excluded.item_count,
        cursor = excluded.cursor,
        last_checked_at = excluded.last_checked_at,
        last_changed_at = excluded.last_changed_at,
        error_message = excluded.error_message
    `,
    )
    .bind(
      RAIL_SOURCE_KEY,
      state.source_key,
      state.source_version,
      state.status,
      state.item_count,
      state.cursor,
      state.last_checked_at,
      state.last_changed_at,
      state.error_message,
    )
    .run();
}

type ActiveReferenceTable =
  | "station_profiles"
  | "operators"
  | "reason_codes"
  | "loading_categories"
  | "source_instances";

type ActiveReferenceKeyColumn =
  | "station_key"
  | "toc_code"
  | "reason_code"
  | "category_code"
  | "source_instance_id";

async function deactivateRowsMissingFromSnapshot(
  db: D1DatabaseLike,
  tableName: ActiveReferenceTable,
  keyColumn: ActiveReferenceKeyColumn,
  activeKeys: string[],
  nowIso: string,
): Promise<void> {
  const uniqueKeys = [...new Set(activeKeys)];

  if (uniqueKeys.length === 0) {
    await db
      .prepare(`UPDATE ${tableName} SET is_active = 0, updated_at = ? WHERE is_active = 1`)
      .bind(nowIso)
      .run();
    return;
  }

  const nextKeys = new Set(uniqueKeys);
  const current = await db
    .prepare(
      `
      SELECT ${keyColumn} AS row_key
      FROM ${tableName}
      WHERE is_active = 1
    `,
    )
    .all<{ row_key: string }>();

  const statements: D1StatementLike[] = [];
  for (const row of current.results) {
    if (nextKeys.has(row.row_key)) continue;

    statements.push(
      db
        .prepare(`UPDATE ${tableName} SET is_active = 0, updated_at = ? WHERE ${keyColumn} = ?`)
        .bind(nowIso, row.row_key),
    );
  }
  await runD1Batch(db, statements);
}

export async function replaceReferenceStations(
  db: D1DatabaseLike,
  rows: ReferenceStationWrite[],
  nowIso: string,
): Promise<void> {
  const currentStations = await listCurrentReferenceStations(db);
  const statements: D1StatementLike[] = [];

  for (const row of rows) {
    const current = currentStations.get(row.station_key);
    if (referenceStationMatchesCurrent(row, current)) continue;

    const stationId = stationThingId(row.station_key);
    const operatorId = row.station_operator ? operatorThingId(row.station_operator) : null;
    if (row.station_operator && operatorId) {
      await upsertRailThing(db, {
        thingId: operatorId,
        thingType: "rail:Operator",
        preferredLabel: row.station_operator,
        updatedAt: row.updated_at,
        identifiers: [{ scheme: "rdm:toc", value: row.station_operator, primary: true }],
      });
    }
    await upsertRailThing(db, {
      thingId: stationId,
      thingType: "rail:Station",
      preferredLabel: row.station_name,
      updatedAt: row.updated_at,
      identifiers: [
        { scheme: "rail:crs", value: row.station_key, primary: true },
        { scheme: "rail:nlc", value: row.national_location_code },
      ],
      datatypeTriples: [
        { predicateId: "rail:latitude", value: row.latitude },
        { predicateId: "rail:longitude", value: row.longitude },
      ],
      objectTriples: [{ predicateId: "rail:operatedBy", objectThingId: operatorId }],
    });
    statements.push(referenceStationStatement(db, row, stationId, operatorId));
  }

  await runD1Batch(db, statements);

  await deactivateRowsMissingFromSnapshot(
    db,
    "station_profiles",
    "station_key",
    rows.map((row) => row.station_key),
    nowIso,
  );
}

async function listCurrentReferenceStations(
  db: D1DatabaseLike,
): Promise<Map<string, CurrentReferenceStationRow>> {
  const current = await db
    .prepare(
      `
      SELECT
        station_key,
        station_name,
        sixteen_character_name,
        national_location_code,
        station_operator,
        latitude,
        longitude,
        profile_hash,
        profile_updated_at,
        is_active
      FROM station_profiles
    `,
    )
    .all<CurrentReferenceStationRow>();

  return new Map(current.results.map((row) => [row.station_key, row]));
}

function referenceStationMatchesCurrent(
  row: ReferenceStationWrite,
  current: CurrentReferenceStationRow | undefined,
): boolean {
  return (
    current !== undefined &&
    current.is_active === 1 &&
    current.station_name === row.station_name &&
    nullableInputMatchesCurrent(row.sixteen_character_name, current.sixteen_character_name) &&
    nullableInputMatchesCurrent(row.national_location_code, current.national_location_code) &&
    nullableInputMatchesCurrent(row.station_operator, current.station_operator) &&
    nullableInputMatchesCurrent(row.latitude, current.latitude) &&
    nullableInputMatchesCurrent(row.longitude, current.longitude) &&
    nullableInputMatchesCurrent(row.profile_hash, current.profile_hash) &&
    nullableInputMatchesCurrent(row.profile_updated_at, current.profile_updated_at)
  );
}

function nullableInputMatchesCurrent<T>(next: T | null | undefined, current: T | null): boolean {
  return next === undefined || next === null || next === current;
}

function referenceStationStatement(
  db: D1DatabaseLike,
  row: ReferenceStationWrite,
  stationId: string,
  operatorId: string | null,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO station_profiles (
        station_key, station_thing_id, station_name, sixteen_character_name, national_location_code,
        station_operator, station_operator_thing_id, latitude, longitude, source_version, profile_hash,
        profile_updated_at, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(station_key) DO UPDATE SET
        station_thing_id = excluded.station_thing_id,
        station_name = excluded.station_name,
        sixteen_character_name = COALESCE(excluded.sixteen_character_name, station_profiles.sixteen_character_name),
        national_location_code = COALESCE(excluded.national_location_code, station_profiles.national_location_code),
        station_operator = COALESCE(excluded.station_operator, station_profiles.station_operator),
        station_operator_thing_id = COALESCE(excluded.station_operator_thing_id, station_profiles.station_operator_thing_id),
        latitude = COALESCE(excluded.latitude, station_profiles.latitude),
        longitude = COALESCE(excluded.longitude, station_profiles.longitude),
        source_version = excluded.source_version,
        profile_hash = COALESCE(excluded.profile_hash, station_profiles.profile_hash),
        profile_updated_at = COALESCE(excluded.profile_updated_at, station_profiles.profile_updated_at),
        is_active = 1,
        updated_at = excluded.updated_at
      WHERE station_profiles.source_version IS NOT excluded.source_version
        OR station_profiles.station_name IS NOT excluded.station_name
        OR COALESCE(excluded.profile_hash, station_profiles.profile_hash) IS NOT station_profiles.profile_hash
        OR station_profiles.is_active IS NOT 1
    `,
    )
    .bind(
      row.station_key,
      stationId,
      row.station_name,
      row.sixteen_character_name ?? null,
      row.national_location_code ?? null,
      row.station_operator ?? null,
      operatorId,
      row.latitude ?? null,
      row.longitude ?? null,
      row.source_version,
      row.profile_hash ?? null,
      row.profile_updated_at ?? null,
      row.updated_at,
    );
}

export async function replaceReferenceTocs(
  db: D1DatabaseLike,
  rows: ReferenceTocWrite[],
  nowIso: string,
): Promise<void> {
  const statements: D1StatementLike[] = [];
  for (const row of rows) {
    const operatorId = operatorThingId(row.toc_code);
    await upsertRailThing(db, {
      thingId: operatorId,
      thingType: "rail:Operator",
      preferredLabel: row.toc_name,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rdm:toc", value: row.toc_code, primary: true }],
    });
    statements.push(referenceTocStatement(db, row, operatorId));
  }

  await runD1Batch(db, statements);

  await deactivateRowsMissingFromSnapshot(
    db,
    "operators",
    "toc_code",
    rows.map((row) => row.toc_code),
    nowIso,
  );
}

function referenceTocStatement(
  db: D1DatabaseLike,
  row: ReferenceTocWrite,
  operatorId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO operators (
        toc_code, operator_thing_id, toc_name, source_version, is_active, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(toc_code) DO UPDATE SET
        operator_thing_id = excluded.operator_thing_id,
        toc_name = excluded.toc_name,
        source_version = excluded.source_version,
        is_active = 1,
        updated_at = excluded.updated_at
    `,
    )
    .bind(row.toc_code, operatorId, row.toc_name, row.source_version, row.updated_at);
}

export async function replaceReferenceReasonCodes(
  db: D1DatabaseLike,
  rows: ReferenceReasonCodeWrite[],
  nowIso: string,
): Promise<void> {
  const statements: D1StatementLike[] = [];
  for (const row of rows) {
    const reasonId = reasonCodeThingId(row.reason_code);
    await upsertRailThing(db, {
      thingId: reasonId,
      thingType: "rail:ReasonCode",
      preferredLabel: row.late_reason ?? row.cancellation_reason ?? row.reason_code,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rdm:reason-code", value: row.reason_code, primary: true }],
    });
    statements.push(referenceReasonCodeStatement(db, row, reasonId));
  }

  await runD1Batch(db, statements);

  await deactivateRowsMissingFromSnapshot(
    db,
    "reason_codes",
    "reason_code",
    rows.map((row) => row.reason_code),
    nowIso,
  );
}

function referenceReasonCodeStatement(
  db: D1DatabaseLike,
  row: ReferenceReasonCodeWrite,
  reasonId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO reason_codes (
        reason_code, reason_thing_id, late_reason, cancellation_reason, is_active, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(reason_code) DO UPDATE SET
        reason_thing_id = excluded.reason_thing_id,
        late_reason = excluded.late_reason,
        cancellation_reason = excluded.cancellation_reason,
        is_active = 1,
        updated_at = excluded.updated_at
    `,
    )
    .bind(row.reason_code, reasonId, row.late_reason, row.cancellation_reason, row.updated_at);
}

export async function replaceReferenceLoadingCategories(
  db: D1DatabaseLike,
  rows: ReferenceLoadingCategoryWrite[],
  nowIso: string,
): Promise<void> {
  const statements: D1StatementLike[] = [];
  for (const row of rows) {
    const categoryId = loadingCategoryThingId(row.category_code);
    const operatorId = row.toc_code ? operatorThingId(row.toc_code) : null;
    if (row.toc_code && operatorId) {
      await upsertRailThing(db, {
        thingId: operatorId,
        thingType: "rail:Operator",
        preferredLabel: row.toc_code,
        updatedAt: row.updated_at,
        identifiers: [{ scheme: "rdm:toc", value: row.toc_code, primary: true }],
      });
    }
    await upsertRailThing(db, {
      thingId: categoryId,
      thingType: "rail:LoadingCategory",
      preferredLabel: row.category_name ?? row.category_code,
      updatedAt: row.updated_at,
      identifiers: [{ scheme: "rdm:loading-category", value: row.category_code, primary: true }],
      datatypeTriples: [
        { predicateId: "rail:colour", value: row.colour },
        { predicateId: "rail:expectedDescription", value: row.expected_description },
      ],
      objectTriples: [{ predicateId: "rail:definedByOperator", objectThingId: operatorId }],
    });
    statements.push(referenceLoadingCategoryStatement(db, row, categoryId, operatorId));
  }

  await runD1Batch(db, statements);

  await deactivateRowsMissingFromSnapshot(
    db,
    "loading_categories",
    "category_code",
    rows.map((row) => row.category_code),
    nowIso,
  );
}

function referenceLoadingCategoryStatement(
  db: D1DatabaseLike,
  row: ReferenceLoadingCategoryWrite,
  categoryId: string,
  operatorId: string | null,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO loading_categories (
        category_code, loading_category_thing_id, category_name, typical_description,
        expected_description, definition, colour, image, toc_code,
        toc_operator_thing_id, source_version, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(category_code) DO UPDATE SET
        loading_category_thing_id = excluded.loading_category_thing_id,
        category_name = excluded.category_name,
        typical_description = excluded.typical_description,
        expected_description = excluded.expected_description,
        definition = excluded.definition,
        colour = excluded.colour,
        image = excluded.image,
        toc_code = excluded.toc_code,
        toc_operator_thing_id = excluded.toc_operator_thing_id,
        source_version = excluded.source_version,
        is_active = 1,
        updated_at = excluded.updated_at
    `,
    )
    .bind(
      row.category_code,
      categoryId,
      row.category_name,
      row.typical_description,
      row.expected_description,
      row.definition,
      row.colour,
      row.image,
      row.toc_code,
      operatorId,
      row.source_version,
      row.updated_at,
    );
}

export async function replaceReferenceSourceInstances(
  db: D1DatabaseLike,
  rows: ReferenceSourceInstanceWrite[],
  nowIso: string,
): Promise<void> {
  const statements: D1StatementLike[] = [];
  for (const row of rows) {
    const instanceId = sourceInstanceThingId(row.source_instance_id);
    await upsertRailThing(db, {
      thingId: instanceId,
      thingType: "rail:SourceInstance",
      preferredLabel: row.source_instance_name,
      updatedAt: row.updated_at,
      identifiers: [
        { scheme: "rdm:source-instance", value: row.source_instance_id, primary: true },
      ],
    });
    statements.push(referenceSourceInstanceStatement(db, row, instanceId));
  }

  await runD1Batch(db, statements);

  await deactivateRowsMissingFromSnapshot(
    db,
    "source_instances",
    "source_instance_id",
    rows.map((row) => row.source_instance_id),
    nowIso,
  );
}

function referenceSourceInstanceStatement(
  db: D1DatabaseLike,
  row: ReferenceSourceInstanceWrite,
  instanceId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO source_instances (
        source_instance_id, source_instance_thing_id, source_instance_name, is_active, updated_at
      ) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(source_instance_id) DO UPDATE SET
        source_instance_thing_id = excluded.source_instance_thing_id,
        source_instance_name = excluded.source_instance_name,
        is_active = 1,
        updated_at = excluded.updated_at
    `,
    )
    .bind(row.source_instance_id, instanceId, row.source_instance_name, row.updated_at);
}

export async function listReferenceStationsAfter(
  db: D1DatabaseLike,
  cursor: string | null,
  limit: number,
): Promise<Array<{ station_key: string; station_name: string }>> {
  const result = await db
    .prepare(
      `
      SELECT station_key, station_name
      FROM station_profiles
      WHERE is_active = 1 AND station_key > ?
      ORDER BY station_key ASC
      LIMIT ?
    `,
    )
    .bind(cursor ?? "", Math.max(1, Math.trunc(limit)))
    .all<{ station_key: string; station_name: string }>();

  return result.results;
}

export async function searchReferenceStations(
  db: D1DatabaseLike,
  query: string,
  limit: number,
): Promise<ReferenceStationSummary[]> {
  const normalised = query.trim().toUpperCase();
  const likeQuery = `%${normalised}%`;
  const result = await db
    .prepare(
      `
      SELECT
        station_keys.station_key,
        COALESCE(station_profiles.station_thing_id, 'rail:station:' || station_keys.station_key) AS station_thing_id,
        COALESCE(station_profiles.station_name, station_keys.station_key) AS station_name,
        COUNT(station_board_entries.service_key) AS service_count,
        MIN(station_board_entries.scheduled_ts) AS next_scheduled_ts,
        MAX(station_board_entries.updated_at) AS last_updated_at
      FROM (
        SELECT station_key FROM station_profiles WHERE is_active = 1
        UNION
        SELECT DISTINCT station_key FROM station_board_entries
      ) station_keys
      LEFT JOIN station_profiles
        ON station_profiles.station_key = station_keys.station_key
      LEFT JOIN station_board_entries
        ON station_board_entries.station_key = station_keys.station_key
      WHERE ? = ''
        OR station_keys.station_key LIKE ?
        OR UPPER(COALESCE(station_profiles.station_name, station_keys.station_key)) LIKE ?
      GROUP BY station_keys.station_key, station_profiles.station_thing_id, station_profiles.station_name
      ORDER BY
        CASE WHEN station_keys.station_key = ? THEN 0 ELSE 1 END,
        CASE WHEN station_keys.station_key LIKE ? THEN 0 ELSE 1 END,
        COALESCE(station_profiles.station_name, station_keys.station_key) ASC,
        station_keys.station_key ASC
      LIMIT ?
    `,
    )
    .bind(
      normalised,
      likeQuery,
      likeQuery,
      normalised,
      `${normalised}%`,
      Math.max(1, Math.trunc(limit)),
    )
    .all<{
      station_key: string;
      station_thing_id: string;
      station_name: string;
      service_count: number;
      next_scheduled_ts: string | null;
      last_updated_at: string | null;
    }>();

  return result.results.map((station) => ({
    station_key: station.station_key,
    station_thing_id: station.station_thing_id,
    station_name: station.station_name,
    service_count: station.service_count,
    next_scheduled_ts: station.next_scheduled_ts,
    last_updated_at: station.last_updated_at,
  }));
}

export async function getReferenceStationProfile(
  db: D1DatabaseLike,
  stationKey: string,
): Promise<ReferenceStationProfile | null> {
  return db
    .prepare(
      `
      SELECT
        station_key,
        station_name,
        sixteen_character_name,
        national_location_code,
        station_operator,
        latitude,
        longitude,
        address_line_1,
        address_line_2,
        address_line_3,
        address_line_4,
        postcode,
        staffing_level,
        cctv_available,
        cis_modes,
        customer_help_points_available,
        ticket_office_available,
        ticket_machine_available,
        oyster_accepted,
        smartcard_validator,
        seated_area_available,
        waiting_room_available,
        toilets_available,
        wifi_available,
        induction_loop,
        accessible_ticket_machines,
        ramp_for_train_access,
        accessible_taxis_available,
        national_key_toilets_available,
        step_free_access_coverage,
        impaired_mobility_set_down_available,
        cycle_storage_spaces,
        car_park_spaces,
        accessible_car_park_spaces,
        rail_replacement_map_url,
        profile_status,
        profile_checked_at,
        updated_at
      FROM station_profiles
      WHERE station_key = ? AND is_active = 1
    `,
    )
    .bind(stationKey)
    .first<ReferenceStationProfile>();
}

export async function getReferenceStationProfiles(
  db: D1DatabaseLike,
  stationKeys: string[],
): Promise<ReferenceStationProfile[]> {
  const keys = [...new Set(stationKeys.map((key) => key.trim()).filter(Boolean))];
  if (keys.length === 0) return [];

  const placeholders = keys.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `
      SELECT
        station_key,
        station_name,
        sixteen_character_name,
        national_location_code,
        station_operator,
        latitude,
        longitude,
        address_line_1,
        address_line_2,
        address_line_3,
        address_line_4,
        postcode,
        staffing_level,
        cctv_available,
        cis_modes,
        customer_help_points_available,
        ticket_office_available,
        ticket_machine_available,
        oyster_accepted,
        smartcard_validator,
        seated_area_available,
        waiting_room_available,
        toilets_available,
        wifi_available,
        induction_loop,
        accessible_ticket_machines,
        ramp_for_train_access,
        accessible_taxis_available,
        national_key_toilets_available,
        step_free_access_coverage,
        impaired_mobility_set_down_available,
        cycle_storage_spaces,
        car_park_spaces,
        accessible_car_park_spaces,
        rail_replacement_map_url,
        profile_status,
        profile_checked_at,
        updated_at
      FROM station_profiles
      WHERE station_key IN (${placeholders}) AND is_active = 1
      ORDER BY station_name ASC
    `,
    )
    .bind(...keys)
    .all<ReferenceStationProfile>();

  return result.results;
}
