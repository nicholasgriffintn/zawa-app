import type { RailEvent } from "@zawa/domain/events";
import { searchReferenceStations } from "@zawa/db/queries/reference-data";
import { stationBoardProjectionEvent } from "@zawa/rdm/projection-events";
import { getRdmStationBoard, type RdmServiceEnv } from "@zawa/rdm/services";
import { nowIso } from "@zawa/shared/time";
import { positiveIntegerValue } from "@zawa/shared/values";
import { isValidBoardCursor } from "../lib/board-cursor";
import { currentStationBoard } from "../lib/board-window";
import { enrichStationBoardResponse } from "../lib/operational-context";
import { withStationBoardOntology, withStationListOntology } from "../lib/ontology";
import { decodeStationPathKey } from "../lib/station-keys";

const MAX_STATION_RESULTS = 20;
const DEFAULT_BOARD_LIMIT = 8;
const MAX_BOARD_LIMIT = 50;

type StationRoutesEnv = RdmServiceEnv & {
  DB: D1Database;
  RAIL_EVENTS_QUEUE: Queue<RailEvent>;
};

export async function handleStationRoutes(
  request: Request,
  env: StationRoutesEnv,
  ctx?: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (url.pathname === "/api/stations") {
    const query = url.searchParams.get("q") ?? "";
    const stations = await searchReferenceStations(env.DB, query, MAX_STATION_RESULTS);
    return Response.json(await withStationListOntology(env.DB, { stations }));
  }

  const departuresMatch = url.pathname.match(/^\/api\/stations\/([^/]+)\/departures$/);
  if (departuresMatch) {
    const stationKey = decodeStationPathKey(departuresMatch[1]);
    if (!stationKey) return Response.json({ error: "Invalid station key" }, { status: 400 });
    const boardPage = readBoardPage(url);
    if (!boardPage.ok) return Response.json({ error: boardPage.error }, { status: 400 });
    const board = await getRdmStationBoard(env, stationKey, "departures", boardPage);
    const currentBoard = isCurrentBoardRequest(boardPage)
      ? currentStationBoard(board, nowIso())
      : board;
    const enrichedBoard = await enrichStationBoardResponse(env.DB, currentBoard);
    if (isCurrentBoardRequest(boardPage)) {
      queueBoardProjection(env, enrichedBoard, ctx);
    }
    return Response.json(await withStationBoardOntology(env.DB, enrichedBoard));
  }

  const arrivalsMatch = url.pathname.match(/^\/api\/stations\/([^/]+)\/arrivals$/);
  if (arrivalsMatch) {
    const stationKey = decodeStationPathKey(arrivalsMatch[1]);
    if (!stationKey) return Response.json({ error: "Invalid station key" }, { status: 400 });
    const boardPage = readBoardPage(url);
    if (!boardPage.ok) return Response.json({ error: boardPage.error }, { status: 400 });
    const board = await getRdmStationBoard(env, stationKey, "arrivals", boardPage);
    const currentBoard = isCurrentBoardRequest(boardPage)
      ? currentStationBoard(board, nowIso())
      : board;
    const enrichedBoard = await enrichStationBoardResponse(env.DB, currentBoard);
    if (isCurrentBoardRequest(boardPage)) {
      queueBoardProjection(env, enrichedBoard, ctx);
    }
    return Response.json(await withStationBoardOntology(env.DB, enrichedBoard));
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

function queueBoardProjection(
  env: StationRoutesEnv,
  board: Awaited<ReturnType<typeof getRdmStationBoard>>,
  ctx?: ExecutionContext,
): void {
  const projection = stationBoardProjectionEvent(board, new Date().toISOString()).then((event) =>
    env.RAIL_EVENTS_QUEUE.send(event),
  );
  if (ctx) {
    ctx.waitUntil(projection);
    return;
  }

  void projection;
}

type BoardPageReadResult =
  | { ok: true; cursor: string | null; limit: number }
  | { ok: false; error: string };

function readBoardPage(url: URL): BoardPageReadResult {
  const cursor = url.searchParams.get("cursor");
  if (cursor !== null && !isValidBoardCursor(cursor)) {
    return { ok: false, error: "Invalid cursor" };
  }

  return {
    ok: true,
    cursor,
    limit: readLimit(url.searchParams.get("limit")),
  };
}

function isCurrentBoardRequest(boardPage: Extract<BoardPageReadResult, { ok: true }>): boolean {
  return boardPage.cursor === null;
}

function readLimit(value: string | null): number {
  if (!value) return DEFAULT_BOARD_LIMIT;
  return Math.min(MAX_BOARD_LIMIT, positiveIntegerValue(value, DEFAULT_BOARD_LIMIT));
}
