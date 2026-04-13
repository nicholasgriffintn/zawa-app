import type { ServiceResponse, StationBoardResponse } from "@zawa/domain/api";
import type { RailEvent } from "@zawa/domain/events";
import { sha1Hex } from "@zawa/shared/hash";
import { dateTimeToIso, latestIso } from "@zawa/shared/time";

export type RdmStationBoardRefreshType = "arrivals" | "departures";

export async function stationBoardRefreshEvent(
  stationKey: string,
  boardType: RdmStationBoardRefreshType,
  nowIso: string,
  limit: number,
): Promise<RailEvent> {
  return {
    id: await sha1Hex(
      JSON.stringify({
        type: "rdm.station.board.refresh.requested",
        stationKey,
        boardType,
        queuedAt: nowIso,
      }),
    ),
    source: "rdm",
    topic: "rdm-station-board-refresh",
    type: "rdm.station.board.refresh.requested",
    occurredAt: nowIso,
    ingestedAt: nowIso,
    stationKey,
    payloadVersion: 1,
    payload: { boardType, limit },
  };
}

export async function stationBoardProjectionEvent(
  snapshot: StationBoardResponse,
  nowIso: string,
): Promise<RailEvent> {
  return {
    id: await sha1Hex(
      JSON.stringify({
        type: "rdm.board.snapshot",
        stationKey: snapshot.stationKey,
        boardType: snapshot.boardType,
        rows: snapshot.rows.map((row) => [row.service_key, row.updated_at, row.expected_ts]),
      }),
    ),
    source: "rdm",
    topic: "rdm-live-arrival-departure-board",
    type: "rdm.board.snapshot",
    occurredAt: latestIso(snapshot.rows, nowIso, (row) => dateTimeToIso(row.updated_at)),
    ingestedAt: nowIso,
    stationKey: snapshot.stationKey,
    payloadVersion: 1,
    payload: { snapshot },
  };
}

export async function serviceProjectionEvent(
  snapshot: ServiceResponse,
  nowIso: string,
): Promise<RailEvent> {
  return {
    id: await sha1Hex(
      JSON.stringify({
        type: "rdm.service.snapshot",
        serviceKey: snapshot.service.service_key,
        updatedAt: snapshot.service.updated_at,
        stops: snapshot.stops.map((stop) => [stop.stop_index, stop.station_key, stop.updated_at]),
      }),
    ),
    source: "rdm",
    topic: "rdm-service-details",
    type: "rdm.service.snapshot",
    occurredAt: dateTimeToIso(snapshot.service.updated_at) ?? nowIso,
    ingestedAt: nowIso,
    serviceKey: snapshot.service.service_key,
    trainRunKey: snapshot.service.train_run_key ?? undefined,
    payloadVersion: 1,
    payload: { snapshot },
  };
}
