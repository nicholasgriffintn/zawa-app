import type { Env } from "../types/env";

const APP_ROUTE_PREFIXES = ["/stations/", "/services/", "/ontologies"] as const;

export function isAppShellRouteRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;

  const url = new URL(request.url);
  if (!APP_ROUTE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return false;

  const accept = request.headers.get("accept");
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

export function fetchAppShell(request: Request, env: Pick<Env, "ASSETS">): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";
  return env.ASSETS.fetch(new Request(url, request));
}
