import { DurableObject } from "cloudflare:workers";
import { parseServiceMessage } from "@zawa/realtime/messages";
import { decodePathSegment } from "@zawa/shared/http";

import { withServiceOntology } from "../lib/ontology";
import { getServiceSnapshot } from "../lib/snapshots";
import type { Env } from "../types/env";

export class ServiceDO extends DurableObject<Env> {
  private sessions = new Set<WebSocket>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/broadcast" && request.method === "POST") {
      const message = await request.json();
      const parsed = parseServiceMessage(JSON.stringify(message));
      if (!parsed) {
        return Response.json({ error: "Invalid service message" }, { status: 400 });
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
    const match = url.pathname.match(/^\/ws\/services\/([^/]+)$/);
    if (!match) return;

    const serviceKey = decodePathSegment(match[1]);
    if (!serviceKey) return;

    const snapshot = await getServiceSnapshot(this.env.DB, serviceKey);
    if (!snapshot) return;
    const linkedSnapshot = await withServiceOntology(this.env.DB, snapshot);

    try {
      ws.send(
        JSON.stringify({
          type: "service.snapshot",
          serviceKey,
          service: linkedSnapshot.service,
          stops: linkedSnapshot.stops,
          summary: linkedSnapshot.summary,
          formations: linkedSnapshot.formations,
          movements: linkedSnapshot.movements,
          ontology: linkedSnapshot.ontology,
          sentAt: new Date().toISOString(),
        }),
      );
    } catch {
      this.sessions.delete(ws);
    }
  }
}
