import type { ServiceStopRow } from "@zawa/db/queries/service-stops";
import type { ServiceRow } from "@zawa/db/queries/services";
import type { StationBoardCurrentWrite } from "@zawa/db/queries/stations";
import type { RailEvent } from "@zawa/domain/events";
import { railClockTimeToIso } from "@zawa/domain/time";
import { isRecord, stringOrNull } from "@zawa/shared/values";

interface ScheduleLocation {
  crs: string;
  locationName: string | null;
  platform: string | null;
  plannedArrival: string | null;
  plannedDeparture: string | null;
  expectedArrival: string | null;
  expectedDeparture: string | null;
  actualArrival: string | null;
  actualDeparture: string | null;
}

export interface ScheduleProjection {
  service: ServiceRow;
  stops: ServiceStopRow[];
  boards: ScheduleStationBoardWrite[];
}

export interface ScheduleStationBoardWrite extends StationBoardCurrentWrite {
  origin_name: string | null;
  via_name: string | null;
  operator_code: string | null;
}

export function scheduleProjectionFromEvent(event: RailEvent): ScheduleProjection | null {
  if (!event.serviceKey || event.type !== "rdm.realtime.schedule.updated") return null;

  const serviceKey = event.serviceKey;
  const locations = parseScheduleLocations(event.payload.locations);
  if (locations.length === 0) return null;

  const serviceDate = stringOrNull(event.payload.ssd);
  const origin = locations[0];
  const destination = locations[locations.length - 1];
  const operatorCode = stringOrNull(event.payload.toc);
  const scheduledStart =
    railClockTimeToIso(origin.plannedDeparture, serviceDate) ??
    railClockTimeToIso(origin.plannedArrival, serviceDate);
  const boards = locations.flatMap((location) =>
    stationBoardWritesFromLocation(
      event,
      location,
      origin.locationName,
      destination.locationName,
      operatorCode,
      serviceDate,
    ),
  );

  return {
    service: {
      service_key: event.serviceKey,
      train_run_key: event.trainRunKey ?? null,
      operator_code: operatorCode,
      origin_name: origin.locationName,
      destination_name: destination.locationName,
      scheduled_start_ts: scheduledStart,
      expected_start_ts: null,
      status: event.type,
      delay_minutes: null,
      cancellation_reason: null,
      last_event_id: event.id,
      updated_at: event.ingestedAt,
    },
    stops: locations.map((location, index) => ({
      service_key: serviceKey,
      stop_index: index,
      station_key: location.crs,
      station_name: location.locationName,
      scheduled_arrival_ts: railClockTimeToIso(location.plannedArrival, serviceDate),
      expected_arrival_ts:
        railClockTimeToIso(location.actualArrival, serviceDate) ??
        railClockTimeToIso(location.expectedArrival, serviceDate),
      scheduled_departure_ts: railClockTimeToIso(location.plannedDeparture, serviceDate),
      expected_departure_ts:
        railClockTimeToIso(location.actualDeparture, serviceDate) ??
        railClockTimeToIso(location.expectedDeparture, serviceDate),
      platform: location.platform,
      stop_status: event.type,
      updated_at: event.ingestedAt,
    })),
    boards,
  };
}

function stationBoardWritesFromLocation(
  event: RailEvent,
  location: ScheduleLocation,
  originName: string | null,
  destinationName: string | null,
  operatorCode: string | null,
  serviceDate: string | null,
): ScheduleStationBoardWrite[] {
  if (!event.serviceKey) return [];

  const base = {
    station_key: location.crs,
    service_key: event.serviceKey,
    platform: location.platform,
    origin_name: originName,
    destination_name: destinationName,
    via_name: null,
    operator_code: operatorCode,
    status: event.type,
    updated_at: event.ingestedAt,
  };
  const arrival = {
    scheduled_ts: railClockTimeToIso(location.plannedArrival, serviceDate),
    expected_ts:
      railClockTimeToIso(location.actualArrival, serviceDate) ??
      railClockTimeToIso(location.expectedArrival, serviceDate),
  };
  const departure = {
    scheduled_ts: railClockTimeToIso(location.plannedDeparture, serviceDate),
    expected_ts:
      railClockTimeToIso(location.actualDeparture, serviceDate) ??
      railClockTimeToIso(location.expectedDeparture, serviceDate),
  };
  const writes: ScheduleStationBoardWrite[] = [];

  if (arrival.scheduled_ts || arrival.expected_ts) {
    writes.push({ ...base, board_type: "arrivals", ...arrival });
  }

  if (departure.scheduled_ts || departure.expected_ts) {
    writes.push({ ...base, board_type: "departures", ...departure });
  }

  return writes;
}

function parseScheduleLocations(value: unknown): ScheduleLocation[] {
  if (!Array.isArray(value)) return [];

  const locations: ScheduleLocation[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;

    const crs = stringOrNull(item.crs);
    if (!crs) continue;

    locations.push({
      crs,
      locationName: stringOrNull(item.locationName),
      platform: stringOrNull(item.platform),
      plannedArrival: stringOrNull(item.plannedArrival),
      plannedDeparture: stringOrNull(item.plannedDeparture),
      expectedArrival: stringOrNull(item.expectedArrival),
      expectedDeparture: stringOrNull(item.expectedDeparture),
      actualArrival: stringOrNull(item.actualArrival),
      actualDeparture: stringOrNull(item.actualDeparture),
    });
  }

  return locations;
}
