import { StationBoardDO } from "./dos/StationBoardDO";
import { ServiceDO } from "./dos/ServiceDO";
import type { Env } from "./types/env";
import { handleHealthRoutes } from "./routes/health";
import { handleStationRoutes } from "./routes/stations";
import { handleServiceRoutes } from "./routes/services";
import { handleDashboardRoutes } from "./routes/dashboard";
import { handleOntologyRoutes } from "./routes/ontologies";
import { handleSearchRoutes } from "./routes/search";
import { handleWebSocketRoutes } from "./routes/ws";
import { fetchAppShell, isAppShellRouteRequest } from "./lib/app-shell-assets";

export { StationBoardDO, ServiceDO };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/health")) {
      return handleHealthRoutes(request, env);
    }
    if (url.pathname.startsWith("/api/stations")) {
      return handleStationRoutes(request, env, ctx);
    }
    if (url.pathname.startsWith("/api/services")) {
      return handleServiceRoutes(request, env, ctx);
    }
    if (url.pathname.startsWith("/api/dashboard")) {
      return handleDashboardRoutes(request, env);
    }
    if (url.pathname.startsWith("/api/search")) {
      return handleSearchRoutes(request, env);
    }
    if (url.pathname.startsWith("/api/ontologies")) {
      return handleOntologyRoutes(request, env);
    }
    if (url.pathname.startsWith("/ws")) {
      return handleWebSocketRoutes(request, env);
    }

    if (url.pathname.startsWith("/internal")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (isAppShellRouteRequest(request)) {
      return fetchAppShell(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
