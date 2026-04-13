import type { RailEvent } from "@zawa/domain/events";
import type { ServiceResponse } from "@zawa/domain/api";
import { decodePathSegment } from "@zawa/shared/http";
import { nowIso } from "@zawa/shared/time";
import { RdmHttpError } from "@zawa/rdm/http";
import { serviceProjectionEvent } from "@zawa/rdm/projection-events";
import { getRdmServiceDetails, type RdmServiceEnv } from "@zawa/rdm/services";
import { enrichServiceResponse } from "../lib/operational-context";
import { withServiceOntology } from "../lib/ontology";
import { getServiceSnapshot } from "../lib/snapshots";
import { shouldFetchLiveService } from "../lib/service-liveness";

type ServiceRoutesEnv = RdmServiceEnv & {
  DB: D1Database;
  RAIL_EVENTS_QUEUE: Queue<RailEvent>;
};

export async function handleServiceRoutes(
  request: Request,
  env: ServiceRoutesEnv,
  ctx?: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const match = url.pathname.match(/^\/api\/services\/([^/]+)$/);
  if (!match) return Response.json({ error: "Not found" }, { status: 404 });

  const serviceKey = decodePathSegment(match[1]);
  if (!serviceKey) {
    return Response.json({ error: "Invalid service key" }, { status: 400 });
  }

  const localSnapshot = await getServiceSnapshot(env.DB, serviceKey);
  const requestedAt = nowIso();
  if (localSnapshot && !shouldFetchLiveService(localSnapshot, requestedAt)) {
    return Response.json(await withServiceOntology(env.DB, localSnapshot));
  }

  try {
    const snapshot = await enrichServiceResponse(
      env.DB,
      await getRdmServiceDetails(env, serviceKey),
    );
    queueServiceProjection(env, snapshot, ctx);
    return Response.json(await withServiceOntology(env.DB, snapshot));
  } catch (error) {
    if (isExpiredOrMissingRdmService(error)) {
      if (localSnapshot) return Response.json(await withServiceOntology(env.DB, localSnapshot));
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    throw error;
  }
}

function queueServiceProjection(
  env: ServiceRoutesEnv,
  snapshot: ServiceResponse,
  ctx?: ExecutionContext,
): void {
  const projection = serviceProjectionEvent(snapshot, new Date().toISOString()).then((event) =>
    env.RAIL_EVENTS_QUEUE.send(event),
  );
  if (ctx) {
    ctx.waitUntil(projection);
    return;
  }

  void projection;
}

function isExpiredOrMissingRdmService(error: unknown): boolean {
  return error instanceof RdmHttpError && (error.status === 400 || error.status === 404);
}
