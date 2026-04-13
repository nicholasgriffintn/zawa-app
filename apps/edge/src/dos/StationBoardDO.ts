import { DurableObject } from "cloudflare:workers";
import { parseStationBoardMessage } from "@zawa/realtime/messages";
import { decodePathSegment } from "@zawa/shared/http";

import { withStationBoardOntology } from "../lib/ontology";
import { getStationBoardSnapshot } from "../lib/snapshots";
import type { Env } from "../types/env";

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
    const snapshot = await withStationBoardOntology(
      this.env.DB,
      await getStationBoardSnapshot(this.env.DB, stationKey, boardType),
    );
    try {
      ws.send(
        JSON.stringify({
          type: "station.board.snapshot",
          stationKey,
          boardType,
          rows: snapshot.rows,
          nextCursor: snapshot.nextCursor,
          ontology: snapshot.ontology,
          sentAt: new Date().toISOString(),
        }),
      );
    } catch {
      this.sessions.delete(ws);
    }
  }
}
