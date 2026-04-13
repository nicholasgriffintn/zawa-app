import { createRailOntologySdk } from "@zawa/ontology";
import { positiveIntegerValue } from "@zawa/shared/values";

interface SearchRoutesEnv {
  DB: D1Database;
}

const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 20;

export async function handleSearchRoutes(
  request: Request,
  env: SearchRoutesEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  if (url.pathname !== "/api/search") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    positiveIntegerValue(url.searchParams.get("limit"), DEFAULT_SEARCH_LIMIT),
    MAX_SEARCH_LIMIT,
  );

  return Response.json(await createRailOntologySdk(env.DB).search({ query, limit }));
}
