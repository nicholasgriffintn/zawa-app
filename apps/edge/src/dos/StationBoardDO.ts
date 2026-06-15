import { DurableObject } from "cloudflare:workers";
import { stationBoardProjectionEvent } from "@zawa/rdm/projection-events";
import { getRdmStationBoard } from "@zawa/rdm/services";
import { parseStationBoardMessage } from "@zawa/realtime/messages";
import type { StationBoardMessage } from "@zawa/realtime/messages";
import { decodePathSegment } from "@zawa/shared/http";
import { nowIso } from "@zawa/shared/time";

import { currentStationBoard } from "../lib/board-window";
import type { Env } from "../types/env";

const LIVE_BOARD_LIMIT = 50;

export class StationBoardDO extends DurableObject<Env> {
  private sessions = new Set<WebSocket>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/broadcast" && request.method === "POST") {
      const message = await request.json();
      const parsed = parseStationBoardMessage(JSON.stringify(message));
      if (!parsed) {
        return Response.json({ error: "Invalid station board message" }, { status: 400 });
      }
      await this.broadcast(parsed);
      return Response.json({ ok: true, recipients: this.sessions.size });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sessions.add(server);

    server.addEventListener("close", () => this.sessions.delete(server));
    await this.sendSnapshot(server, url);

    return new Response(null, { status: 101, webSocket: client });
  }

  async broadcast(message: unknown): Promise<void> {
    const text = JSON.stringify(message);
    for (const ws of this.sessions) {
      try {
        ws.send(text);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }

  private async sendSnapshot(ws: WebSocket, url: URL): Promise<void> {
    const match = url.pathname.match(/^\/ws\/stations\/([^/]+)$/);
    if (!match) return;

    const stationKey = decodePathSegment(match[1])?.toUpperCase();
    if (!stationKey) return;

    const boardType = url.searchParams.get("boardType") === "arrivals" ? "arrivals" : "departures";
    const liveBoard = await getRdmStationBoard(this.env, stationKey, boardType, {
      limit: LIVE_BOARD_LIMIT,
      cursor: null,
    });
    const currentBoard = currentStationBoard(liveBoard, nowIso());
    const message: StationBoardMessage = {
      type: "station.board.snapshot",
      stationKey,
      boardType,
      rows: currentBoard.rows,
      previousCursor: currentBoard.previousCursor,
      nextCursor: currentBoard.nextCursor,
      sentAt: new Date().toISOString(),
    };
    await this.broadcast(message);
    this.ctx.waitUntil(this.queueBoardProjection(currentBoard));
  }

  private async queueBoardProjection(
    board: Awaited<ReturnType<typeof getRdmStationBoard>>,
  ): Promise<void> {
    try {
      const event = await stationBoardProjectionEvent(board, new Date().toISOString());
      await this.env.RAIL_EVENTS_QUEUE.send(event);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "station_board_do.projection_queue_failed",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
