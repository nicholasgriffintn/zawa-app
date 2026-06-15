import { isJsonObject, parseJsonSafe } from "@zawa/shared/json";
import type { OntologyGraph } from "@zawa/ontology";

export interface ServicePatch {
  status?: string;
  updated_at?: string;
}

export interface ServiceSnapshotService {
  service_key: string;
  train_run_key: string | null;
  rid: string | null;
  uid: string | null;
  train_id: string | null;
  rsid: string | null;
  operator_code: string | null;
  origin_name: string | null;
  destination_name: string | null;
  service_type: string | null;
  category: string | null;
  activities: string | null;
  service_length: number | null;
  is_passenger_service: number | null;
  is_charter: number | null;
  is_reverse_formation: number | null;
  detach_front: number | null;
  scheduled_start_ts: string | null;
  expected_start_ts: string | null;
  status: string;
  delay_minutes: number | null;
  cancellation_reason: string | null;
  last_event_id: string;
  updated_at: string;
}

export interface ServiceSnapshotStop {
  service_key: string;
  stop_index: number;
  station_key: string;
  station_name: string | null;
  tiploc: string | null;
  scheduled_arrival_ts: string | null;
  expected_arrival_ts: string | null;
  actual_arrival_ts: string | null;
  scheduled_departure_ts: string | null;
  expected_departure_ts: string | null;
  actual_departure_ts: string | null;
  arrival_type: string | null;
  arrival_source: string | null;
  arrival_source_instance: string | null;
  departure_type: string | null;
  departure_source: string | null;
  departure_source_instance: string | null;
  platform: string | null;
  platform_is_hidden: number | null;
  path: string | null;
  line: string | null;
  activities: string | null;
  is_pass: number | null;
  is_operational: number | null;
  stop_cancel_reason: string | null;
  stop_delay_reason: string | null;
  stop_status: string | null;
  updated_at: string;
}

export interface ServiceSnapshotSummary {
  calling_point_count: number;
  scheduled_duration_minutes: number | null;
  expected_duration_minutes: number | null;
  delay_minutes: number | null;
}

export interface ServiceSnapshotCoach {
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

export interface ServiceSnapshotFormation {
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
  coaches: ServiceSnapshotCoach[];
}

export interface ServiceSnapshotMovement {
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

export interface StationBoardPatch {
  scheduled_ts?: string | null;
  expected_ts?: string | null;
  platform?: string | null;
  origin_name?: string | null;
  destination_name?: string | null;
  via_name?: string | null;
  service_type?: string | null;
  operator_code?: string | null;
  status?: string;
  updated_at?: string;
}

export interface StationBoardSnapshotRow {
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

export type StationBoardMessage =
  | {
      type: "station.board.snapshot";
      stationKey: string;
      boardType: "departures" | "arrivals";
      rows: StationBoardSnapshotRow[];
      previousCursor: string | null;
      nextCursor: string | null;
      sentAt: string;
    }
  | {
      type: "station.board.patch";
      stationKey: string;
      boardType: "departures" | "arrivals";
      serviceKey: string;
      rootThingIds?: string[];
      patch: StationBoardPatch;
      sentAt: string;
    }
  | {
      type: "station.board.remove";
      stationKey: string;
      boardType: "departures" | "arrivals";
      serviceKey: string;
      rootThingIds?: string[];
      sentAt: string;
    };

export type ServiceMessage =
  | {
      type: "service.snapshot";
      serviceKey: string;
      service: ServiceSnapshotService;
      stops: ServiceSnapshotStop[];
      summary: ServiceSnapshotSummary;
      formations: ServiceSnapshotFormation[];
      movements: ServiceSnapshotMovement[];
      ontology?: OntologyGraph;
      sentAt: string;
    }
  | {
      type: "service.patch";
      serviceKey: string;
      rootThingIds?: string[];
      patch: ServicePatch;
      sentAt: string;
    };

export function parseStationBoardMessage(data: unknown): StationBoardMessage | null {
  const parsed = parseJsonSafe(data);
  if (!isJsonObject(parsed)) {
    return null;
  }

  const { type, stationKey, boardType, serviceKey, sentAt } = parsed;
  if (
    typeof type !== "string" ||
    typeof stationKey !== "string" ||
    (boardType !== "departures" && boardType !== "arrivals") ||
    typeof sentAt !== "string"
  ) {
    return null;
  }

  if (type === "station.board.snapshot") {
    if (!Array.isArray(parsed.rows)) return null;
    const rows = parseStationBoardRows(parsed.rows);
    if (!rows) return null;
    if (!isNullableString(parsed.previousCursor)) return null;
    if (!isNullableString(parsed.nextCursor)) return null;
    return {
      type,
      stationKey,
      boardType,
      rows,
      previousCursor: parsed.previousCursor,
      nextCursor: parsed.nextCursor,
      sentAt,
    };
  }

  if (typeof serviceKey !== "string") {
    return null;
  }

  if (type === "station.board.remove") {
    const rootThingIds = parseRootThingIds(parsed.rootThingIds);
    return { type, stationKey, boardType, serviceKey, rootThingIds, sentAt };
  }

  if (type !== "station.board.patch") {
    return null;
  }

  if (!isJsonObject(parsed.patch)) {
    return null;
  }

  const {
    scheduled_ts,
    expected_ts,
    platform,
    origin_name,
    destination_name,
    via_name,
    service_type,
    operator_code,
    status,
    updated_at,
  } = parsed.patch;
  if (
    (scheduled_ts !== undefined && scheduled_ts !== null && typeof scheduled_ts !== "string") ||
    (expected_ts !== undefined && expected_ts !== null && typeof expected_ts !== "string") ||
    (platform !== undefined && platform !== null && typeof platform !== "string") ||
    (origin_name !== undefined && origin_name !== null && typeof origin_name !== "string") ||
    (destination_name !== undefined &&
      destination_name !== null &&
      typeof destination_name !== "string") ||
    (via_name !== undefined && via_name !== null && typeof via_name !== "string") ||
    (service_type !== undefined && service_type !== null && typeof service_type !== "string") ||
    (operator_code !== undefined && operator_code !== null && typeof operator_code !== "string") ||
    (status !== undefined && typeof status !== "string") ||
    (updated_at !== undefined && typeof updated_at !== "string")
  ) {
    return null;
  }

  return {
    type,
    stationKey,
    boardType,
    serviceKey,
    rootThingIds: parseRootThingIds(parsed.rootThingIds),
    patch: {
      scheduled_ts,
      expected_ts,
      platform,
      origin_name,
      destination_name,
      via_name,
      service_type,
      operator_code,
      status,
      updated_at,
    },
    sentAt,
  };
}

export function parseServiceMessage(data: unknown): ServiceMessage | null {
  const parsed = parseJsonSafe(data);
  if (!isJsonObject(parsed)) {
    return null;
  }

  const { type, serviceKey, sentAt } = parsed;
  if (typeof type !== "string" || typeof serviceKey !== "string" || typeof sentAt !== "string") {
    return null;
  }

  if (type === "service.snapshot") {
    const service = parseServiceSnapshotService(parsed.service);
    const stops = Array.isArray(parsed.stops) ? parseServiceSnapshotStops(parsed.stops) : null;
    const summary = parseServiceSnapshotSummary(parsed.summary);
    const formations = Array.isArray(parsed.formations)
      ? parseServiceSnapshotFormations(parsed.formations)
      : [];
    const movements = Array.isArray(parsed.movements)
      ? parseServiceSnapshotMovements(parsed.movements)
      : [];
    if (!service || !stops || !summary || !formations || !movements) return null;
    const ontology = parseOntologyGraph(parsed.ontology);
    return { type, serviceKey, service, stops, summary, formations, movements, ontology, sentAt };
  }

  if (type !== "service.patch") {
    return null;
  }

  if (!isJsonObject(parsed.patch)) {
    return null;
  }

  const { status, updated_at } = parsed.patch;
  if (
    (status !== undefined && typeof status !== "string") ||
    (updated_at !== undefined && typeof updated_at !== "string")
  ) {
    return null;
  }

  return {
    type,
    serviceKey,
    rootThingIds: parseRootThingIds(parsed.rootThingIds),
    patch: { status, updated_at },
    sentAt,
  };
}

function parseStationBoardRows(rows: unknown[]): StationBoardSnapshotRow[] | null {
  const parsedRows: StationBoardSnapshotRow[] = [];
  for (const row of rows) {
    if (!isJsonObject(row)) return null;
    if (
      typeof row.station_key !== "string" ||
      typeof row.board_type !== "string" ||
      typeof row.service_key !== "string" ||
      !isNullableString(row.scheduled_ts) ||
      !isNullableString(row.expected_ts) ||
      !isNullableString(row.platform) ||
      !isNullableString(row.origin_name) ||
      !isNullableString(row.destination_name) ||
      !isNullableString(row.via_name) ||
      (row.service_type !== undefined && !isNullableString(row.service_type)) ||
      !isNullableString(row.operator_code) ||
      typeof row.status !== "string" ||
      typeof row.updated_at !== "string"
    ) {
      return null;
    }

    parsedRows.push({
      station_key: row.station_key,
      board_type: row.board_type,
      service_key: row.service_key,
      scheduled_ts: row.scheduled_ts,
      expected_ts: row.expected_ts,
      platform: row.platform,
      origin_name: row.origin_name,
      destination_name: row.destination_name,
      via_name: row.via_name,
      service_type: row.service_type ?? null,
      operator_code: row.operator_code,
      status: row.status,
      updated_at: row.updated_at,
    });
  }

  return parsedRows;
}

function parseOntologyGraph(value: unknown): OntologyGraph | undefined {
  if (value === undefined) return undefined;
  if (!isJsonObject(value) || !Array.isArray(value.rootThingIds)) return undefined;
  if (!Array.isArray(value.things) || !Array.isArray(value.triples)) return undefined;
  if (!value.rootThingIds.every((thingId) => typeof thingId === "string")) return undefined;
  return value as unknown as OntologyGraph;
}

function parseRootThingIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  if (!value.every((thingId) => typeof thingId === "string")) return undefined;
  return value;
}

function parseServiceSnapshotService(value: unknown): ServiceSnapshotService | null {
  if (!isJsonObject(value)) return null;
  if (
    typeof value.service_key !== "string" ||
    !isNullableString(value.train_run_key) ||
    !isNullableString(value.rid) ||
    !isNullableString(value.uid) ||
    !isNullableString(value.train_id) ||
    !isNullableString(value.rsid) ||
    !isNullableString(value.operator_code) ||
    !isNullableString(value.origin_name) ||
    !isNullableString(value.destination_name) ||
    !isNullableString(value.service_type) ||
    !isNullableString(value.category) ||
    !isNullableString(value.activities) ||
    !isNullableNumber(value.service_length) ||
    !isNullableNumber(value.is_passenger_service) ||
    !isNullableNumber(value.is_charter) ||
    !isNullableNumber(value.is_reverse_formation) ||
    !isNullableNumber(value.detach_front) ||
    !isNullableString(value.scheduled_start_ts) ||
    !isNullableString(value.expected_start_ts) ||
    typeof value.status !== "string" ||
    !isNullableNumber(value.delay_minutes) ||
    !isNullableString(value.cancellation_reason) ||
    typeof value.last_event_id !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    return null;
  }

  return {
    service_key: value.service_key,
    train_run_key: value.train_run_key,
    rid: value.rid,
    uid: value.uid,
    train_id: value.train_id,
    rsid: value.rsid,
    operator_code: value.operator_code,
    origin_name: value.origin_name,
    destination_name: value.destination_name,
    service_type: value.service_type,
    category: value.category,
    activities: value.activities,
    service_length: value.service_length,
    is_passenger_service: value.is_passenger_service,
    is_charter: value.is_charter,
    is_reverse_formation: value.is_reverse_formation,
    detach_front: value.detach_front,
    scheduled_start_ts: value.scheduled_start_ts,
    expected_start_ts: value.expected_start_ts,
    status: value.status,
    delay_minutes: value.delay_minutes,
    cancellation_reason: value.cancellation_reason,
    last_event_id: value.last_event_id,
    updated_at: value.updated_at,
  };
}

function parseServiceSnapshotStops(stops: unknown[]): ServiceSnapshotStop[] | null {
  const parsedStops: ServiceSnapshotStop[] = [];
  for (const stop of stops) {
    if (!isJsonObject(stop)) return null;
    if (
      typeof stop.service_key !== "string" ||
      typeof stop.stop_index !== "number" ||
      !Number.isInteger(stop.stop_index) ||
      typeof stop.station_key !== "string" ||
      !isNullableString(stop.station_name) ||
      !isNullableString(stop.tiploc) ||
      !isNullableString(stop.scheduled_arrival_ts) ||
      !isNullableString(stop.expected_arrival_ts) ||
      !isNullableString(stop.actual_arrival_ts) ||
      !isNullableString(stop.scheduled_departure_ts) ||
      !isNullableString(stop.expected_departure_ts) ||
      !isNullableString(stop.actual_departure_ts) ||
      !isNullableString(stop.arrival_type) ||
      !isNullableString(stop.arrival_source) ||
      !isNullableString(stop.arrival_source_instance) ||
      !isNullableString(stop.departure_type) ||
      !isNullableString(stop.departure_source) ||
      !isNullableString(stop.departure_source_instance) ||
      !isNullableString(stop.platform) ||
      !isNullableNumber(stop.platform_is_hidden) ||
      !isNullableString(stop.path) ||
      !isNullableString(stop.line) ||
      !isNullableString(stop.activities) ||
      !isNullableNumber(stop.is_pass) ||
      !isNullableNumber(stop.is_operational) ||
      !isNullableString(stop.stop_cancel_reason) ||
      !isNullableString(stop.stop_delay_reason) ||
      !isNullableString(stop.stop_status) ||
      typeof stop.updated_at !== "string"
    ) {
      return null;
    }

    parsedStops.push({
      service_key: stop.service_key,
      stop_index: stop.stop_index,
      station_key: stop.station_key,
      station_name: stop.station_name,
      tiploc: stop.tiploc,
      scheduled_arrival_ts: stop.scheduled_arrival_ts,
      expected_arrival_ts: stop.expected_arrival_ts,
      actual_arrival_ts: stop.actual_arrival_ts,
      scheduled_departure_ts: stop.scheduled_departure_ts,
      expected_departure_ts: stop.expected_departure_ts,
      actual_departure_ts: stop.actual_departure_ts,
      arrival_type: stop.arrival_type,
      arrival_source: stop.arrival_source,
      arrival_source_instance: stop.arrival_source_instance,
      departure_type: stop.departure_type,
      departure_source: stop.departure_source,
      departure_source_instance: stop.departure_source_instance,
      platform: stop.platform,
      platform_is_hidden: stop.platform_is_hidden,
      path: stop.path,
      line: stop.line,
      activities: stop.activities,
      is_pass: stop.is_pass,
      is_operational: stop.is_operational,
      stop_cancel_reason: stop.stop_cancel_reason,
      stop_delay_reason: stop.stop_delay_reason,
      stop_status: stop.stop_status,
      updated_at: stop.updated_at,
    });
  }

  return parsedStops;
}

function parseServiceSnapshotSummary(value: unknown): ServiceSnapshotSummary | null {
  if (!isJsonObject(value)) return null;
  if (
    typeof value.calling_point_count !== "number" ||
    !Number.isInteger(value.calling_point_count) ||
    value.calling_point_count < 0 ||
    !isNullableNonNegativeInteger(value.scheduled_duration_minutes) ||
    !isNullableNonNegativeInteger(value.expected_duration_minutes) ||
    !isNullableNumber(value.delay_minutes)
  ) {
    return null;
  }

  return {
    calling_point_count: value.calling_point_count,
    scheduled_duration_minutes: value.scheduled_duration_minutes,
    expected_duration_minutes: value.expected_duration_minutes,
    delay_minutes: value.delay_minutes,
  };
}

function parseServiceSnapshotFormations(formations: unknown[]): ServiceSnapshotFormation[] | null {
  const parsedFormations: ServiceSnapshotFormation[] = [];
  for (const formation of formations) {
    if (!isJsonObject(formation)) return null;
    if (
      typeof formation.service_key !== "string" ||
      typeof formation.formation_index !== "number" ||
      !Number.isInteger(formation.formation_index) ||
      !isNullableString(formation.tiploc) ||
      !isNullableString(formation.loading_category_code) ||
      !isNullableString(formation.loading_category_name) ||
      !isNullableString(formation.loading_category_colour) ||
      !isNullableString(formation.loading_category_image) ||
      !isNullableNumber(formation.loading_percentage) ||
      !isNullableString(formation.source) ||
      !isNullableString(formation.source_instance) ||
      typeof formation.updated_at !== "string" ||
      !Array.isArray(formation.coaches)
    ) {
      return null;
    }

    const coaches = parseServiceSnapshotCoaches(formation.coaches);
    if (!coaches) return null;

    parsedFormations.push({
      service_key: formation.service_key,
      formation_index: formation.formation_index,
      tiploc: formation.tiploc,
      loading_category_code: formation.loading_category_code,
      loading_category_name: formation.loading_category_name,
      loading_category_colour: formation.loading_category_colour,
      loading_category_image: formation.loading_category_image,
      loading_percentage: formation.loading_percentage,
      source: formation.source,
      source_instance: formation.source_instance,
      updated_at: formation.updated_at,
      coaches,
    });
  }

  return parsedFormations;
}

function parseServiceSnapshotCoaches(coaches: unknown[]): ServiceSnapshotCoach[] | null {
  const parsedCoaches: ServiceSnapshotCoach[] = [];
  for (const coach of coaches) {
    if (!isJsonObject(coach)) return null;
    if (
      typeof coach.service_key !== "string" ||
      typeof coach.formation_index !== "number" ||
      !Number.isInteger(coach.formation_index) ||
      typeof coach.coach_index !== "number" ||
      !Number.isInteger(coach.coach_index) ||
      !isNullableString(coach.tiploc) ||
      !isNullableString(coach.coach_number) ||
      !isNullableString(coach.coach_class) ||
      !isNullableString(coach.toilet_status) ||
      !isNullableString(coach.toilet_value) ||
      !isNullableNumber(coach.loading) ||
      !isNullableNumber(coach.loading_specified) ||
      typeof coach.updated_at !== "string"
    ) {
      return null;
    }

    parsedCoaches.push({
      service_key: coach.service_key,
      formation_index: coach.formation_index,
      coach_index: coach.coach_index,
      tiploc: coach.tiploc,
      coach_number: coach.coach_number,
      coach_class: coach.coach_class,
      toilet_status: coach.toilet_status,
      toilet_value: coach.toilet_value,
      loading: coach.loading,
      loading_specified: coach.loading_specified,
      updated_at: coach.updated_at,
    });
  }

  return parsedCoaches;
}

function parseServiceSnapshotMovements(movements: unknown[]): ServiceSnapshotMovement[] | null {
  const parsedMovements: ServiceSnapshotMovement[] = [];
  for (const movement of movements) {
    if (!isJsonObject(movement)) return null;
    if (
      typeof movement.train_run_key !== "string" ||
      typeof movement.movement_index !== "number" ||
      !Number.isInteger(movement.movement_index) ||
      !isNullableString(movement.service_key) ||
      !isNullableString(movement.train_id) ||
      !isNullableString(movement.train_uid) ||
      !isNullableString(movement.toc) ||
      !isNullableString(movement.train_service_code) ||
      !isNullableString(movement.stanox) ||
      !isNullableString(movement.reporting_stanox) ||
      !isNullableString(movement.platform) ||
      !isNullableString(movement.path) ||
      !isNullableString(movement.line) ||
      !isNullableString(movement.planned_event_type) ||
      !isNullableString(movement.event_type) ||
      !isNullableString(movement.planned_ts) ||
      !isNullableString(movement.gbtt_ts) ||
      !isNullableString(movement.actual_ts) ||
      !isNullableNumber(movement.timetable_variation_minutes) ||
      !isNullableString(movement.variation_status) ||
      !isNullableNumber(movement.auto_expected) ||
      typeof movement.updated_at !== "string"
    ) {
      return null;
    }

    parsedMovements.push({
      train_run_key: movement.train_run_key,
      movement_index: movement.movement_index,
      service_key: movement.service_key,
      train_id: movement.train_id,
      train_uid: movement.train_uid,
      toc: movement.toc,
      train_service_code: movement.train_service_code,
      stanox: movement.stanox,
      reporting_stanox: movement.reporting_stanox,
      platform: movement.platform,
      path: movement.path,
      line: movement.line,
      planned_event_type: movement.planned_event_type,
      event_type: movement.event_type,
      planned_ts: movement.planned_ts,
      gbtt_ts: movement.gbtt_ts,
      actual_ts: movement.actual_ts,
      timetable_variation_minutes: movement.timetable_variation_minutes,
      variation_status: movement.variation_status,
      auto_expected: movement.auto_expected,
      updated_at: movement.updated_at,
    });
  }

  return parsedMovements;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
}
