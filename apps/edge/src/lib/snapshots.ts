import type { D1DatabaseLike } from "@zawa/db/d1";
import {
  getServiceFormationsCurrent,
  getServiceMovementsCurrent,
} from "@zawa/db/queries/service-formations";
import { getStationBoardPage, getStationName } from "@zawa/db/queries/stations";
import type { ServiceResponse, StationBoardResponse } from "@zawa/domain/api";
import { nowIso } from "@zawa/shared/time";

import { currentBoardSince } from "./board-window";
import { enrichServiceResponse, enrichStationBoardResponse } from "./operational-context";
import { buildServiceSummary } from "./service-summary";

const MAX_BOARD_ROWS = 50;

export async function getStationBoardSnapshot(
  db: D1DatabaseLike,
  stationKey: string,
  boardType: "departures" | "arrivals",
  options: { cursor?: string | null; limit?: number } = {},
): Promise<StationBoardResponse> {
  const page = await getStationBoardPage(
    db,
    stationKey,
    boardType,
    options.limit ?? MAX_BOARD_ROWS,
    options.cursor,
    currentBoardSince(nowIso()),
  );

  return enrichStationBoardResponse(db, {
    stationKey,
    stationName: await getStationName(db, stationKey),
    boardType,
    rows: page.rows,
    profile: null,
    notices: [],
    incidents: [],
    previousCursor: null,
    nextCursor: page.nextCursor,
  });
}

export async function getServiceSnapshot(
  db: D1DatabaseLike,
  serviceKey: string,
): Promise<ServiceResponse | null> {
  const service = await db
    .prepare(`
      SELECT *
      FROM service_journeys
      WHERE service_key = ?
    `)
    .bind(serviceKey)
    .first<ServiceResponse["service"]>();

  if (!service) return null;

  const [stops, formations, movements] = await Promise.all([
    db
      .prepare(`
        SELECT *
        FROM service_call_points
        WHERE service_key = ?
        ORDER BY stop_index ASC
      `)
      .bind(serviceKey)
      .all<ServiceResponse["stops"][number]>(),
    getServiceFormationsCurrent(db, serviceKey),
    getServiceMovementsCurrent(db, serviceKey, service.train_run_key),
  ]);

  return enrichServiceResponse(db, {
    service,
    stops: stops.results,
    summary: buildServiceSummary(service, stops.results),
    formations,
    movements,
    incidents: [],
    stationProfiles: [],
  });
}
