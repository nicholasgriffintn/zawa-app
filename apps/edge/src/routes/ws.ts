import { decodePathSegment } from "@zawa/shared/http";

interface WebSocketRoutesEnv {
  STATION_BOARD_DO: DurableObjectNamespaceLike;
  SERVICE_DO: DurableObjectNamespaceLike;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStubLike;
}

interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export async function handleWebSocketRoutes(
  request: Request,
  env: WebSocketRoutesEnv,
): Promise<Response> {
  const url = new URL(request.url);

  const stationMatch = url.pathname.match(/^\/ws\/stations\/([^/]+)$/);
  if (stationMatch) {
    const decoded = decodePathSegment(stationMatch[1]);
    if (!decoded) return Response.json({ error: "Invalid station key" }, { status: 400 });

    const stationKey = decoded.toUpperCase();
    const boardType = url.searchParams.get("boardType") === "arrivals" ? "arrivals" : "departures";
    const id = env.STATION_BOARD_DO.idFromName(`${boardType}:${stationKey}`);
    return env.STATION_BOARD_DO.get(id).fetch(request);
  }

  const serviceMatch = url.pathname.match(/^\/ws\/services\/([^/]+)$/);
  if (serviceMatch) {
    const serviceKey = decodePathSegment(serviceMatch[1]);
    if (!serviceKey) return Response.json({ error: "Invalid service key" }, { status: 400 });

    const id = env.SERVICE_DO.idFromName(serviceKey);
    return env.SERVICE_DO.get(id).fetch(request);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
