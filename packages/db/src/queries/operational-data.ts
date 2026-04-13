import { runD1Batch, sqlPlaceholders, type D1DatabaseLike, type D1StatementLike } from "../d1";
import {
  deactivateRailThings,
  disruptionThingId,
  incidentThingId,
  operatorThingId,
  stationMessageThingId,
  stationThingId,
  upsertRailThing,
} from "./ontology";

export interface StationProfileWrite {
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
  cctv_available: boolean | null;
  cis_modes: string | null;
  customer_help_points_available: boolean | null;
  ticket_office_available: boolean | null;
  ticket_machine_available: boolean | null;
  oyster_issued: boolean | null;
  oyster_topup_ticket_machine: boolean | null;
  oyster_accepted: boolean | null;
  smartcard_issued: boolean | null;
  smartcard_topup_ticket_office: boolean | null;
  smartcard_topup_ticket_machine: boolean | null;
  smartcard_validator: boolean | null;
  seated_area_available: boolean | null;
  waiting_room_available: boolean | null;
  toilets_available: boolean | null;
  wifi_available: boolean | null;
  induction_loop: boolean | null;
  accessible_ticket_machines: boolean | null;
  ramp_for_train_access: boolean | null;
  accessible_taxis_available: boolean | null;
  national_key_toilets_available: boolean | null;
  step_free_access_coverage: string | null;
  impaired_mobility_set_down_available: boolean | null;
  cycle_storage_spaces: number | null;
  car_park_spaces: number | null;
  accessible_car_park_spaces: number | null;
  rail_replacement_map_url: string | null;
  profile_status: "available" | "unavailable";
  profile_error_status: number | null;
  profile_error_message: string | null;
  profile_hash: string | null;
  profile_updated_at: string | null;
  updated_at: string;
}

export interface OperatorStatusWrite {
  toc_code: string;
  toc_name: string | null;
  status: string;
  status_description: string | null;
  status_image: string | null;
  twitter_account: string | null;
  additional_info: string | null;
  updated_at: string;
  disruptions: Array<{
    disruption_id: string;
    detail: string | null;
    url: string | null;
  }>;
}

export interface IncidentWrite {
  incident_id: string;
  version: string | null;
  planned: boolean | null;
  priority: number | null;
  summary: string | null;
  description_html: string | null;
  start_at: string | null;
  end_at: string | null;
  routes_affected_html: string | null;
  info_link_url: string | null;
  info_link_label: string | null;
  updated_at: string;
  operators: Array<{ operator_code: string; operator_name: string | null }>;
}

export interface StationDisruptionGroupWrite {
  station_key: string;
  generated_at: string | null;
  updated_at: string;
  disruptions: Array<{
    disruption_id: string;
    category: string | null;
    severity: string | null;
    description: string | null;
    message_html: string | null;
    is_suppressed: boolean;
  }>;
}

export interface StationMessageWrite {
  station_key: string;
  message_hash: string;
  category: string | null;
  severity: string | null;
  message_html: string;
  generated_at: string | null;
  updated_at: string;
}

export interface OperatorIncidentRow {
  incident_id: string;
  version: string | null;
  planned: number | null;
  priority: number | null;
  summary: string | null;
  description_html: string | null;
  start_at: string | null;
  end_at: string | null;
  routes_affected_html: string | null;
  info_link_url: string | null;
  info_link_label: string | null;
  operator_code: string | null;
  operator_name: string | null;
  updated_at: string;
}

interface IncidentCurrentRow {
  incident_id: string;
  version: string | null;
  planned: number | null;
  priority: number | null;
  summary: string | null;
  description_html: string | null;
  start_at: string | null;
  end_at: string | null;
  routes_affected_html: string | null;
  info_link_url: string | null;
  info_link_label: string | null;
}

interface IncidentOperatorCurrentRow {
  incident_id: string;
  operator_code: string;
  operator_name: string | null;
}

interface OperatorStatusCurrentRow {
  toc_code: string;
  toc_name: string | null;
  status: string;
  status_description: string | null;
  status_image: string | null;
  twitter_account: string | null;
  additional_info: string | null;
}

interface OperatorDisruptionCurrentRow {
  toc_code: string;
  disruption_id: string;
  detail: string | null;
  url: string | null;
}

export interface StationDisruptionRow {
  station_key: string;
  disruption_id: string;
  generated_at: string | null;
  category: string | null;
  severity: string | null;
  description: string | null;
  message_html: string | null;
  is_suppressed: number;
  updated_at: string;
}

export interface StationMessageRow {
  station_key: string;
  message_hash: string;
  category: string | null;
  severity: string | null;
  message_html: string;
  generated_at: string | null;
  updated_at: string;
}

const STATION_PROFILE_INSERT_COLUMNS = [
  "station_key",
  "station_thing_id",
  "station_name",
  "sixteen_character_name",
  "national_location_code",
  "station_operator",
  "station_operator_thing_id",
  "latitude",
  "longitude",
  "profile_hash",
  "profile_updated_at",
  "address_line_1",
  "address_line_2",
  "address_line_3",
  "address_line_4",
  "postcode",
  "staffing_level",
  "cctv_available",
  "cis_modes",
  "customer_help_points_available",
  "ticket_office_available",
  "ticket_machine_available",
  "oyster_issued",
  "oyster_topup_ticket_machine",
  "oyster_accepted",
  "smartcard_issued",
  "smartcard_topup_ticket_office",
  "smartcard_topup_ticket_machine",
  "smartcard_validator",
  "seated_area_available",
  "waiting_room_available",
  "toilets_available",
  "wifi_available",
  "induction_loop",
  "accessible_ticket_machines",
  "ramp_for_train_access",
  "accessible_taxis_available",
  "national_key_toilets_available",
  "step_free_access_coverage",
  "impaired_mobility_set_down_available",
  "cycle_storage_spaces",
  "car_park_spaces",
  "accessible_car_park_spaces",
  "rail_replacement_map_url",
  "profile_status",
  "profile_error_status",
  "profile_error_message",
  "profile_checked_at",
  "is_active",
  "updated_at",
] as const;

const STATION_PROFILE_INSERT_VALUES = STATION_PROFILE_INSERT_COLUMNS.map((column) =>
  column === "is_active" ? "1" : "?",
).join(", ");

export async function upsertStationProfiles(
  db: D1DatabaseLike,
  rows: StationProfileWrite[],
): Promise<void> {
  const statements: D1StatementLike[] = [];
  for (const row of rows) {
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
        { predicateId: "rail:postcode", value: row.postcode },
        { predicateId: "rail:stepFreeAccessCoverage", value: row.step_free_access_coverage },
      ],
      objectTriples: [{ predicateId: "rail:operatedBy", objectThingId: operatorId }],
    });
    statements.push(stationProfileStatement(db, row));
  }
  await runD1Batch(db, statements);
}

function stationProfileStatement(db: D1DatabaseLike, row: StationProfileWrite): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO station_profiles (
        ${STATION_PROFILE_INSERT_COLUMNS.join(", ")}
      ) VALUES (${STATION_PROFILE_INSERT_VALUES})
      ON CONFLICT(station_key) DO UPDATE SET
        station_thing_id = excluded.station_thing_id,
        station_name = excluded.station_name,
        sixteen_character_name = excluded.sixteen_character_name,
        national_location_code = excluded.national_location_code,
        station_operator = excluded.station_operator,
        station_operator_thing_id = excluded.station_operator_thing_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        profile_hash = excluded.profile_hash,
        profile_updated_at = excluded.profile_updated_at,
        address_line_1 = excluded.address_line_1,
        address_line_2 = excluded.address_line_2,
        address_line_3 = excluded.address_line_3,
        address_line_4 = excluded.address_line_4,
        postcode = excluded.postcode,
        staffing_level = excluded.staffing_level,
        cctv_available = excluded.cctv_available,
        cis_modes = excluded.cis_modes,
        customer_help_points_available = excluded.customer_help_points_available,
        ticket_office_available = excluded.ticket_office_available,
        ticket_machine_available = excluded.ticket_machine_available,
        oyster_issued = excluded.oyster_issued,
        oyster_topup_ticket_machine = excluded.oyster_topup_ticket_machine,
        oyster_accepted = excluded.oyster_accepted,
        smartcard_issued = excluded.smartcard_issued,
        smartcard_topup_ticket_office = excluded.smartcard_topup_ticket_office,
        smartcard_topup_ticket_machine = excluded.smartcard_topup_ticket_machine,
        smartcard_validator = excluded.smartcard_validator,
        seated_area_available = excluded.seated_area_available,
        waiting_room_available = excluded.waiting_room_available,
        toilets_available = excluded.toilets_available,
        wifi_available = excluded.wifi_available,
        induction_loop = excluded.induction_loop,
        accessible_ticket_machines = excluded.accessible_ticket_machines,
        ramp_for_train_access = excluded.ramp_for_train_access,
        accessible_taxis_available = excluded.accessible_taxis_available,
        national_key_toilets_available = excluded.national_key_toilets_available,
        step_free_access_coverage = excluded.step_free_access_coverage,
        impaired_mobility_set_down_available = excluded.impaired_mobility_set_down_available,
        cycle_storage_spaces = excluded.cycle_storage_spaces,
        car_park_spaces = excluded.car_park_spaces,
        accessible_car_park_spaces = excluded.accessible_car_park_spaces,
        rail_replacement_map_url = excluded.rail_replacement_map_url,
        profile_status = excluded.profile_status,
        profile_error_status = excluded.profile_error_status,
        profile_error_message = excluded.profile_error_message,
        profile_checked_at = excluded.profile_checked_at,
        is_active = 1,
        updated_at = excluded.updated_at
      WHERE station_profiles.profile_hash IS NOT excluded.profile_hash
        OR station_profiles.profile_updated_at IS NOT excluded.profile_updated_at
        OR station_profiles.profile_status IS NOT excluded.profile_status
        OR station_profiles.profile_error_status IS NOT excluded.profile_error_status
        OR station_profiles.profile_error_message IS NOT excluded.profile_error_message
        OR station_profiles.is_active IS NOT 1
    `,
    )
    .bind(...stationProfileBindValues(row));
}

function stationProfileBindValues(row: StationProfileWrite): unknown[] {
  const operatorId = row.station_operator ? operatorThingId(row.station_operator) : null;
  return [
    row.station_key,
    stationThingId(row.station_key),
    row.station_name,
    row.sixteen_character_name,
    row.national_location_code,
    row.station_operator,
    operatorId,
    row.latitude,
    row.longitude,
    row.profile_hash,
    row.profile_updated_at,
    row.address_line_1,
    row.address_line_2,
    row.address_line_3,
    row.address_line_4,
    row.postcode,
    row.staffing_level,
    booleanToInteger(row.cctv_available),
    row.cis_modes,
    booleanToInteger(row.customer_help_points_available),
    booleanToInteger(row.ticket_office_available),
    booleanToInteger(row.ticket_machine_available),
    booleanToInteger(row.oyster_issued),
    booleanToInteger(row.oyster_topup_ticket_machine),
    booleanToInteger(row.oyster_accepted),
    booleanToInteger(row.smartcard_issued),
    booleanToInteger(row.smartcard_topup_ticket_office),
    booleanToInteger(row.smartcard_topup_ticket_machine),
    booleanToInteger(row.smartcard_validator),
    booleanToInteger(row.seated_area_available),
    booleanToInteger(row.waiting_room_available),
    booleanToInteger(row.toilets_available),
    booleanToInteger(row.wifi_available),
    booleanToInteger(row.induction_loop),
    booleanToInteger(row.accessible_ticket_machines),
    booleanToInteger(row.ramp_for_train_access),
    booleanToInteger(row.accessible_taxis_available),
    booleanToInteger(row.national_key_toilets_available),
    row.step_free_access_coverage,
    booleanToInteger(row.impaired_mobility_set_down_available),
    row.cycle_storage_spaces,
    row.car_park_spaces,
    row.accessible_car_park_spaces,
    row.rail_replacement_map_url,
    row.profile_status,
    row.profile_error_status,
    row.profile_error_message,
    row.updated_at,
    row.updated_at,
  ];
}

function booleanToInteger(value: boolean | null): number | null {
  if (value === null) return null;
  return value ? 1 : 0;
}

export async function replaceOperatorStatuses(
  db: D1DatabaseLike,
  rows: OperatorStatusWrite[],
  nowIso = new Date().toISOString(),
): Promise<void> {
  const currentStatuses = await listOperatorStatusRows(db);
  const currentDisruptionsByToc = await listOperatorDisruptionsByToc(db);
  const statements: D1StatementLike[] = [];
  const removedDisruptionThingIds: string[] = [];
  await deleteMissingOperatorDisruptionOwners(
    db,
    currentDisruptionsByToc,
    new Set(rows.map((row) => row.toc_code)),
    nowIso,
  );

  for (const row of rows) {
    const operatorId = operatorThingId(row.toc_code);
    if (!operatorStatusMatchesCurrent(row, currentStatuses.get(row.toc_code))) {
      await upsertRailThing(db, {
        thingId: operatorId,
        thingType: "rail:Operator",
        preferredLabel: row.toc_name ?? row.toc_code,
        updatedAt: row.updated_at,
        identifiers: [{ scheme: "rdm:toc", value: row.toc_code, primary: true }],
        datatypeTriples: [{ predicateId: "rail:networkStatus", value: row.status }],
      });
      statements.push(operatorStatusStatement(db, row, operatorId));
    }

    const currentDisruptions = currentDisruptionsByToc.get(row.toc_code) ?? new Map();
    pushMissingOperatorDisruptionStatements(
      statements,
      db,
      row.toc_code,
      currentDisruptions,
      new Set(row.disruptions.map((disruption) => disruption.disruption_id)),
      removedDisruptionThingIds,
    );

    for (const disruption of row.disruptions) {
      if (
        operatorDisruptionMatchesCurrent(
          disruption,
          currentDisruptions.get(disruption.disruption_id),
        )
      ) {
        continue;
      }
      const disruptionId = disruptionThingId(`${row.toc_code}:${disruption.disruption_id}`);
      await upsertRailThing(db, {
        thingId: disruptionId,
        thingType: "rail:OperatorDisruption",
        preferredLabel: disruption.detail ?? disruption.disruption_id,
        updatedAt: row.updated_at,
        identifiers: [
          {
            scheme: "rdm:operator-disruption",
            value: `${row.toc_code}:${disruption.disruption_id}`,
            primary: true,
          },
        ],
        objectTriples: [{ predicateId: "rail:affectsOperator", objectThingId: operatorId }],
      });
      statements.push(operatorDisruptionStatement(db, row, disruption, operatorId, disruptionId));
    }
  }
  await runD1Batch(db, statements);
  await deactivateRailThings(db, removedDisruptionThingIds, nowIso);
}

function operatorStatusStatement(
  db: D1DatabaseLike,
  row: OperatorStatusWrite,
  operatorId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO operator_statuses (
        toc_code, operator_thing_id, toc_name, status, status_description, status_image,
        twitter_account, additional_info, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(toc_code) DO UPDATE SET
        operator_thing_id = excluded.operator_thing_id,
        toc_name = excluded.toc_name,
        status = excluded.status,
        status_description = excluded.status_description,
        status_image = excluded.status_image,
        twitter_account = excluded.twitter_account,
        additional_info = excluded.additional_info,
        updated_at = excluded.updated_at
      WHERE operator_statuses.toc_name IS NOT excluded.toc_name
        OR operator_statuses.status IS NOT excluded.status
        OR operator_statuses.status_description IS NOT excluded.status_description
        OR operator_statuses.status_image IS NOT excluded.status_image
        OR operator_statuses.twitter_account IS NOT excluded.twitter_account
        OR operator_statuses.additional_info IS NOT excluded.additional_info
    `,
    )
    .bind(
      row.toc_code,
      operatorId,
      row.toc_name,
      row.status,
      row.status_description,
      row.status_image,
      row.twitter_account,
      row.additional_info,
      row.updated_at,
    );
}

function operatorDisruptionStatement(
  db: D1DatabaseLike,
  row: OperatorStatusWrite,
  disruption: OperatorStatusWrite["disruptions"][number],
  operatorId: string,
  disruptionId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO operator_disruptions (
        toc_code, operator_thing_id, disruption_id, disruption_thing_id,
        detail, url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(toc_code, disruption_id) DO UPDATE SET
        operator_thing_id = excluded.operator_thing_id,
        disruption_thing_id = excluded.disruption_thing_id,
        detail = excluded.detail,
        url = excluded.url,
        updated_at = excluded.updated_at
      WHERE operator_disruptions.detail IS NOT excluded.detail
        OR operator_disruptions.url IS NOT excluded.url
    `,
    )
    .bind(
      row.toc_code,
      operatorId,
      disruption.disruption_id,
      disruptionId,
      disruption.detail,
      disruption.url,
      row.updated_at,
    );
}

async function listOperatorStatusRows(
  db: D1DatabaseLike,
): Promise<Map<string, OperatorStatusCurrentRow>> {
  const current = await db
    .prepare(
      `
      SELECT
        toc_code,
        toc_name,
        status,
        status_description,
        status_image,
        twitter_account,
        additional_info
      FROM operator_statuses
    `,
    )
    .all<OperatorStatusCurrentRow>();

  return new Map(current.results.map((row) => [row.toc_code, row]));
}

async function listOperatorDisruptionsByToc(
  db: D1DatabaseLike,
): Promise<Map<string, Map<string, OperatorDisruptionCurrentRow>>> {
  const current = await db
    .prepare(
      `
      SELECT toc_code, disruption_id, detail, url
      FROM operator_disruptions
    `,
    )
    .all<OperatorDisruptionCurrentRow>();

  const byToc = new Map<string, Map<string, OperatorDisruptionCurrentRow>>();
  for (const row of current.results) {
    let disruptions = byToc.get(row.toc_code);
    if (!disruptions) {
      disruptions = new Map();
      byToc.set(row.toc_code, disruptions);
    }
    disruptions.set(row.disruption_id, row);
  }

  return byToc;
}

async function deleteMissingOperatorDisruptionOwners(
  db: D1DatabaseLike,
  currentDisruptionsByToc: Map<string, Map<string, OperatorDisruptionCurrentRow>>,
  nextTocCodes: Set<string>,
  nowIso: string,
): Promise<void> {
  const statements: D1StatementLike[] = [];
  const removedThingIds: string[] = [];
  for (const tocCode of currentDisruptionsByToc.keys()) {
    if (nextTocCodes.has(tocCode)) continue;

    for (const disruptionId of currentDisruptionsByToc.get(tocCode)?.keys() ?? []) {
      removedThingIds.push(disruptionThingId(`${tocCode}:${disruptionId}`));
    }
    statements.push(
      db.prepare("DELETE FROM operator_disruptions WHERE toc_code = ?").bind(tocCode),
    );
  }
  await runD1Batch(db, statements);
  await deactivateRailThings(db, removedThingIds, nowIso);
}

function pushMissingOperatorDisruptionStatements(
  statements: D1StatementLike[],
  db: D1DatabaseLike,
  tocCode: string,
  currentDisruptions: Map<string, OperatorDisruptionCurrentRow>,
  nextDisruptionIds: Set<string>,
  removedThingIds: string[],
): void {
  for (const disruptionId of currentDisruptions.keys()) {
    if (nextDisruptionIds.has(disruptionId)) continue;

    removedThingIds.push(disruptionThingId(`${tocCode}:${disruptionId}`));
    statements.push(
      db
        .prepare("DELETE FROM operator_disruptions WHERE toc_code = ? AND disruption_id = ?")
        .bind(tocCode, disruptionId),
    );
  }
}

function operatorStatusMatchesCurrent(
  row: OperatorStatusWrite,
  current: OperatorStatusCurrentRow | undefined,
): boolean {
  return (
    current !== undefined &&
    current.toc_name === row.toc_name &&
    current.status === row.status &&
    current.status_description === row.status_description &&
    current.status_image === row.status_image &&
    current.twitter_account === row.twitter_account &&
    current.additional_info === row.additional_info
  );
}

function operatorDisruptionMatchesCurrent(
  row: OperatorStatusWrite["disruptions"][number],
  current: OperatorDisruptionCurrentRow | undefined,
): boolean {
  return current !== undefined && current.detail === row.detail && current.url === row.url;
}

export async function replaceIncidents(
  db: D1DatabaseLike,
  rows: IncidentWrite[],
  nowIso: string,
  options: { deactivateMissingIncidentIds?: Set<string> | null } = {},
): Promise<void> {
  const incidentIds = rows.map((row) => row.incident_id);
  const currentIncidents = await listActiveIncidentRows(db, incidentIds);
  const currentOperatorsByIncident = await listIncidentOperatorsByIncident(db, incidentIds);

  if (options.deactivateMissingIncidentIds) {
    await deactivateMissingIncidents(
      db,
      await listActiveIncidentIds(db),
      options.deactivateMissingIncidentIds,
      nowIso,
    );
  }

  const statements: D1StatementLike[] = [];
  for (const row of rows) {
    const incidentId = incidentThingId(row.incident_id);
    if (!incidentMatchesCurrent(row, currentIncidents.get(row.incident_id))) {
      await upsertRailThing(db, {
        thingId: incidentId,
        thingType: "rail:NetworkIncident",
        preferredLabel: row.summary ?? row.incident_id,
        updatedAt: row.updated_at,
        identifiers: [{ scheme: "rdm:incident", value: row.incident_id, primary: true }],
        datatypeTriples: [
          { predicateId: "rail:planned", value: row.planned },
          { predicateId: "rail:priority", value: row.priority },
        ],
      });
      statements.push(networkIncidentStatement(db, row, incidentId));
    }

    const currentOperators = currentOperatorsByIncident.get(row.incident_id) ?? new Map();
    await deleteMissingIncidentOperators(
      db,
      row.incident_id,
      currentOperators,
      new Set(row.operators.map((operator) => operator.operator_code)),
    );

    for (const operator of row.operators) {
      if (currentOperators.get(operator.operator_code) === operator.operator_name) continue;
      const operatorId = operatorThingId(operator.operator_code);
      await upsertRailThing(db, {
        thingId: operatorId,
        thingType: "rail:Operator",
        preferredLabel: operator.operator_name ?? operator.operator_code,
        updatedAt: row.updated_at,
        identifiers: [{ scheme: "rdm:toc", value: operator.operator_code, primary: true }],
      });
      await upsertRailThing(db, {
        thingId: incidentId,
        thingType: "rail:NetworkIncident",
        preferredLabel: row.summary ?? row.incident_id,
        updatedAt: row.updated_at,
        objectTriples: [{ predicateId: "rail:affectsOperator", objectThingId: operatorId }],
      });

      statements.push(networkIncidentOperatorStatement(db, row, operator, incidentId, operatorId));
    }
  }
  await runD1Batch(db, statements);
}

function networkIncidentStatement(
  db: D1DatabaseLike,
  row: IncidentWrite,
  incidentId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO network_incidents (
        incident_id, incident_thing_id, version, planned, priority, summary, description_html,
        start_at, end_at, routes_affected_html, info_link_url, info_link_label,
        is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(incident_id) DO UPDATE SET
        incident_thing_id = excluded.incident_thing_id,
        version = excluded.version,
        planned = excluded.planned,
        priority = excluded.priority,
        summary = excluded.summary,
        description_html = excluded.description_html,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        routes_affected_html = excluded.routes_affected_html,
        info_link_url = excluded.info_link_url,
        info_link_label = excluded.info_link_label,
        is_active = 1,
        updated_at = excluded.updated_at
      WHERE network_incidents.is_active IS NOT 1
        OR network_incidents.version IS NOT excluded.version
        OR network_incidents.planned IS NOT excluded.planned
        OR network_incidents.priority IS NOT excluded.priority
        OR network_incidents.summary IS NOT excluded.summary
        OR network_incidents.description_html IS NOT excluded.description_html
        OR network_incidents.start_at IS NOT excluded.start_at
        OR network_incidents.end_at IS NOT excluded.end_at
        OR network_incidents.routes_affected_html IS NOT excluded.routes_affected_html
        OR network_incidents.info_link_url IS NOT excluded.info_link_url
        OR network_incidents.info_link_label IS NOT excluded.info_link_label
    `,
    )
    .bind(
      row.incident_id,
      incidentId,
      row.version,
      incidentPlannedValue(row),
      row.priority,
      row.summary,
      row.description_html,
      row.start_at,
      row.end_at,
      row.routes_affected_html,
      row.info_link_url,
      row.info_link_label,
      row.updated_at,
    );
}

function networkIncidentOperatorStatement(
  db: D1DatabaseLike,
  row: IncidentWrite,
  operator: IncidentWrite["operators"][number],
  incidentId: string,
  operatorId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO network_incident_operators (
        incident_id, incident_thing_id, operator_code, operator_thing_id,
        operator_name, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(incident_id, operator_code) DO UPDATE SET
        incident_thing_id = excluded.incident_thing_id,
        operator_thing_id = excluded.operator_thing_id,
        operator_name = excluded.operator_name,
        updated_at = excluded.updated_at
      WHERE network_incident_operators.operator_name IS NOT excluded.operator_name
    `,
    )
    .bind(
      row.incident_id,
      incidentId,
      operator.operator_code,
      operatorId,
      operator.operator_name,
      row.updated_at,
    );
}

async function deactivateMissingIncidents(
  db: D1DatabaseLike,
  currentIncidentIds: Set<string>,
  nextIncidentIds: Set<string>,
  nowIso: string,
): Promise<void> {
  const statements: D1StatementLike[] = [];
  const removedThingIds: string[] = [];
  for (const incidentId of currentIncidentIds) {
    if (nextIncidentIds.has(incidentId)) continue;

    removedThingIds.push(incidentThingId(incidentId));
    statements.push(
      db
        .prepare("UPDATE network_incidents SET is_active = 0, updated_at = ? WHERE incident_id = ?")
        .bind(nowIso, incidentId),
      db.prepare("DELETE FROM network_incident_operators WHERE incident_id = ?").bind(incidentId),
    );
  }
  await runD1Batch(db, statements);
  await deactivateRailThings(db, removedThingIds, nowIso);
}

async function deleteMissingIncidentOperators(
  db: D1DatabaseLike,
  incidentId: string,
  currentOperators: Map<string, string | null>,
  nextOperatorCodes: Set<string>,
): Promise<void> {
  const statements: D1StatementLike[] = [];
  for (const operatorCode of currentOperators.keys()) {
    if (nextOperatorCodes.has(operatorCode)) continue;

    statements.push(
      db
        .prepare(
          "DELETE FROM network_incident_operators WHERE incident_id = ? AND operator_code = ?",
        )
        .bind(incidentId, operatorCode),
    );
  }
  await runD1Batch(db, statements);
}

async function listActiveIncidentRows(
  db: D1DatabaseLike,
  incidentIds: string[],
): Promise<Map<string, IncidentCurrentRow>> {
  if (incidentIds.length === 0) return new Map();

  const current = await db
    .prepare(
      `
      SELECT
        incident_id,
        version,
        planned,
        priority,
        summary,
        description_html,
        start_at,
        end_at,
        routes_affected_html,
        info_link_url,
        info_link_label
      FROM network_incidents
      WHERE is_active = 1
        AND incident_id IN (${sqlPlaceholders(incidentIds.length)})
    `,
    )
    .bind(...incidentIds)
    .all<IncidentCurrentRow>();

  return new Map(current.results.map((row) => [row.incident_id, row]));
}

async function listActiveIncidentIds(db: D1DatabaseLike): Promise<Set<string>> {
  const current = await db
    .prepare(
      `
      SELECT incident_id
      FROM network_incidents
      WHERE is_active = 1
    `,
    )
    .all<{ incident_id: string }>();

  return new Set(current.results.map((row) => row.incident_id));
}

async function listIncidentOperatorsByIncident(
  db: D1DatabaseLike,
  incidentIds: string[],
): Promise<Map<string, Map<string, string | null>>> {
  if (incidentIds.length === 0) return new Map();

  const current = await db
    .prepare(
      `
      SELECT incident_id, operator_code, operator_name
      FROM network_incident_operators
      WHERE incident_id IN (${sqlPlaceholders(incidentIds.length)})
    `,
    )
    .bind(...incidentIds)
    .all<IncidentOperatorCurrentRow>();

  const byIncident = new Map<string, Map<string, string | null>>();
  for (const row of current.results) {
    let operators = byIncident.get(row.incident_id);
    if (!operators) {
      operators = new Map();
      byIncident.set(row.incident_id, operators);
    }
    operators.set(row.operator_code, row.operator_name);
  }

  return byIncident;
}

function incidentMatchesCurrent(
  row: IncidentWrite,
  current: IncidentCurrentRow | undefined,
): boolean {
  return (
    current !== undefined &&
    current.version === row.version &&
    current.planned === incidentPlannedValue(row) &&
    current.priority === row.priority &&
    current.summary === row.summary &&
    current.description_html === row.description_html &&
    current.start_at === row.start_at &&
    current.end_at === row.end_at &&
    current.routes_affected_html === row.routes_affected_html &&
    current.info_link_url === row.info_link_url &&
    current.info_link_label === row.info_link_label
  );
}

function incidentPlannedValue(row: IncidentWrite): number | null {
  if (row.planned === null) return null;
  return row.planned ? 1 : 0;
}

export async function replaceStationDisruptions(
  db: D1DatabaseLike,
  groups: StationDisruptionGroupWrite[],
  nowIso: string,
): Promise<void> {
  const statements: D1StatementLike[] = [];
  for (const group of groups) {
    const stationId = stationThingId(group.station_key);
    await upsertRailThing(db, {
      thingId: stationId,
      thingType: "rail:Station",
      preferredLabel: group.station_key,
      updatedAt: group.updated_at,
      identifiers: [{ scheme: "rail:crs", value: group.station_key, primary: true }],
    });
    await deactivateMissingStationDisruptions(
      db,
      group.station_key,
      new Set(group.disruptions.map((disruption) => disruption.disruption_id)),
      nowIso,
    );

    for (const disruption of group.disruptions) {
      const disruptionId = disruptionThingId(`${group.station_key}:${disruption.disruption_id}`);
      await upsertRailThing(db, {
        thingId: disruptionId,
        thingType: "rail:StationDisruption",
        preferredLabel: disruption.description ?? disruption.disruption_id,
        updatedAt: group.updated_at,
        identifiers: [
          {
            scheme: "rdm:station-disruption",
            value: `${group.station_key}:${disruption.disruption_id}`,
            primary: true,
          },
        ],
        datatypeTriples: [
          { predicateId: "rail:category", value: disruption.category },
          { predicateId: "rail:severity", value: disruption.severity },
        ],
        objectTriples: [{ predicateId: "rail:affectsStation", objectThingId: stationId }],
      });
      statements.push(stationDisruptionStatement(db, group, disruption, stationId, disruptionId));
    }
  }
  await runD1Batch(db, statements);
}

function stationDisruptionStatement(
  db: D1DatabaseLike,
  group: StationDisruptionGroupWrite,
  disruption: StationDisruptionGroupWrite["disruptions"][number],
  stationId: string,
  disruptionId: string,
): D1StatementLike {
  return db
    .prepare(
      `
      INSERT INTO station_disruptions (
        station_key, station_thing_id, disruption_id, disruption_thing_id,
        generated_at, category, severity, description, message_html,
        is_suppressed, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(station_key, disruption_id) DO UPDATE SET
        station_thing_id = excluded.station_thing_id,
        disruption_thing_id = excluded.disruption_thing_id,
        generated_at = excluded.generated_at,
        category = excluded.category,
        severity = excluded.severity,
        description = excluded.description,
        message_html = excluded.message_html,
        is_suppressed = excluded.is_suppressed,
        is_active = 1,
        updated_at = excluded.updated_at
      WHERE station_disruptions.is_active IS NOT 1
        OR station_disruptions.category IS NOT excluded.category
        OR station_disruptions.severity IS NOT excluded.severity
        OR station_disruptions.description IS NOT excluded.description
        OR station_disruptions.message_html IS NOT excluded.message_html
        OR station_disruptions.is_suppressed IS NOT excluded.is_suppressed
    `,
    )
    .bind(
      group.station_key,
      stationId,
      disruption.disruption_id,
      disruptionId,
      group.generated_at,
      disruption.category,
      disruption.severity,
      disruption.description,
      disruption.message_html,
      disruption.is_suppressed ? 1 : 0,
      group.updated_at,
    );
}

async function deactivateMissingStationDisruptions(
  db: D1DatabaseLike,
  stationKey: string,
  nextDisruptionIds: Set<string>,
  nowIso: string,
): Promise<void> {
  const current = await db
    .prepare(
      "SELECT disruption_id FROM station_disruptions WHERE station_key = ? AND is_active = 1",
    )
    .bind(stationKey)
    .all<{ disruption_id: string }>();

  const statements: D1StatementLike[] = [];
  const removedThingIds: string[] = [];
  for (const row of current.results) {
    if (nextDisruptionIds.has(row.disruption_id)) continue;

    removedThingIds.push(disruptionThingId(`${stationKey}:${row.disruption_id}`));
    statements.push(
      db
        .prepare(
          "UPDATE station_disruptions SET is_active = 0, updated_at = ? WHERE station_key = ? AND disruption_id = ?",
        )
        .bind(nowIso, stationKey, row.disruption_id),
    );
  }
  await runD1Batch(db, statements);
  await deactivateRailThings(db, removedThingIds, nowIso);
}

export async function getActiveStationDisruptions(
  db: D1DatabaseLike,
  stationKey: string,
): Promise<StationDisruptionRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        station_key,
        disruption_id,
        generated_at,
        category,
        severity,
        description,
        message_html,
        is_suppressed,
        updated_at
      FROM station_disruptions
      WHERE station_key = ? AND is_active = 1 AND is_suppressed = 0
      ORDER BY
        CASE LOWER(COALESCE(severity, ''))
          WHEN 'severe' THEN 0
          WHEN 'major' THEN 1
          WHEN 'minor' THEN 2
          ELSE 3
        END,
        updated_at DESC
    `,
    )
    .bind(stationKey)
    .all<StationDisruptionRow>();

  return result.results;
}

export async function getStationMessages(
  db: D1DatabaseLike,
  stationKey: string,
): Promise<StationMessageRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        station_key,
        message_hash,
        category,
        severity,
        message_html,
        generated_at,
        updated_at
      FROM station_messages
      WHERE station_key = ?
      ORDER BY updated_at DESC
      LIMIT 10
    `,
    )
    .bind(stationKey)
    .all<StationMessageRow>();

  return result.results;
}

export async function upsertStationMessageCurrent(
  db: D1DatabaseLike,
  row: StationMessageWrite,
): Promise<void> {
  const stationId = stationThingId(row.station_key);
  const messageId = stationMessageThingId(row.station_key, row.message_hash);
  await upsertRailThing(db, {
    thingId: stationId,
    thingType: "rail:Station",
    preferredLabel: row.station_key,
    updatedAt: row.updated_at,
    identifiers: [{ scheme: "rail:crs", value: row.station_key, primary: true }],
  });
  await upsertRailThing(db, {
    thingId: messageId,
    thingType: "rail:StationMessage",
    preferredLabel: row.category ?? row.message_hash,
    updatedAt: row.updated_at,
    identifiers: [{ scheme: "rail:station-message-hash", value: row.message_hash, primary: true }],
    datatypeTriples: [
      { predicateId: "rail:category", value: row.category },
      { predicateId: "rail:severity", value: row.severity },
    ],
    objectTriples: [{ predicateId: "rail:messageForStation", objectThingId: stationId }],
  });
  await db
    .prepare(
      `
      INSERT INTO station_messages (
        station_key, station_thing_id, message_hash, message_thing_id,
        category, severity, message_html, generated_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(station_key, message_hash) DO UPDATE SET
        station_thing_id = excluded.station_thing_id,
        message_thing_id = excluded.message_thing_id,
        category = excluded.category,
        severity = excluded.severity,
        message_html = excluded.message_html,
        generated_at = excluded.generated_at,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= station_messages.updated_at
        AND (
          excluded.category IS NOT station_messages.category
          OR excluded.severity IS NOT station_messages.severity
          OR excluded.message_html IS NOT station_messages.message_html
          OR excluded.generated_at IS NOT station_messages.generated_at
        )
    `,
    )
    .bind(
      row.station_key,
      stationId,
      row.message_hash,
      messageId,
      row.category,
      row.severity,
      row.message_html,
      row.generated_at,
      row.updated_at,
    )
    .run();
}

export async function getActiveIncidentsForOperators(
  db: D1DatabaseLike,
  operatorCodes: string[],
  activeAtIso: string,
): Promise<OperatorIncidentRow[]> {
  const codes = [...new Set(operatorCodes.map((code) => code.trim()).filter(Boolean))];
  if (codes.length === 0) return [];

  const placeholders = codes.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `
      SELECT
        incidents.incident_id,
        incidents.version,
        incidents.planned,
        incidents.priority,
        incidents.summary,
        incidents.description_html,
        incidents.start_at,
        incidents.end_at,
        incidents.routes_affected_html,
        incidents.info_link_url,
        incidents.info_link_label,
        incident_operators.operator_code,
        incident_operators.operator_name,
        incidents.updated_at
      FROM network_incidents incidents
      INNER JOIN network_incident_operators incident_operators
        ON incident_operators.incident_id = incidents.incident_id
      WHERE incidents.is_active = 1
        AND incident_operators.operator_code IN (${placeholders})
        AND (incidents.start_at IS NULL OR datetime(incidents.start_at) <= datetime(?))
        AND (incidents.end_at IS NULL OR datetime(incidents.end_at) >= datetime(?))
      ORDER BY incidents.priority ASC, incidents.updated_at DESC
      LIMIT 20
    `,
    )
    .bind(...codes, activeAtIso, activeAtIso)
    .all<OperatorIncidentRow>();

  return result.results;
}
