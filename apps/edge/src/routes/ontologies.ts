import { createRailOntologySdk } from "@zawa/ontology";
import { decodePathSegment } from "@zawa/shared/http";
import { nonNegativeIntegerValue, positiveIntegerValue } from "@zawa/shared/values";

interface OntologyRoutesEnv {
  DB: D1Database;
}

export async function handleOntologyRoutes(
  request: Request,
  env: OntologyRoutesEnv,
): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  const sdk = createRailOntologySdk(env.DB);

  if (url.pathname === "/api/ontologies") {
    return Response.json(await sdk.getCatalog());
  }

  if (url.pathname === "/api/ontologies/things") {
    return Response.json(await sdk.getThingsPage(readPageOptions(url.searchParams)));
  }

  if (url.pathname === "/api/ontologies/triples") {
    return Response.json(await sdk.getTriplesPage(readPageOptions(url.searchParams)));
  }

  if (url.pathname === "/api/ontologies/quality") {
    return Response.json(await sdk.getQualityReport(readPageOptions(url.searchParams)));
  }

  const thingMatch = url.pathname.match(/^\/api\/ontologies\/things\/(.+)$/);
  if (thingMatch) {
    const thingId = decodePathSegment(thingMatch[1]);
    if (!thingId) return Response.json({ error: "Invalid thing id" }, { status: 400 });

    return Response.json(await sdk.getGraph([thingId], { includeInbound: true, tripleLimit: 120 }));
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

function readPageOptions(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
  query?: string;
  thingType?: string;
  classId?: string;
  predicateId?: string;
  subjectThingId?: string;
  objectThingId?: string;
  severity?: "error" | "warning";
  kind?: string;
} {
  const severity = readOptionalSearchParam(searchParams, "severity");

  return {
    limit: Math.min(positiveIntegerValue(searchParams.get("limit"), 25), 50),
    offset: nonNegativeIntegerValue(searchParams.get("offset"), 0),
    query: readOptionalSearchParam(searchParams, "q"),
    thingType: readOptionalSearchParam(searchParams, "thingType"),
    classId: readOptionalSearchParam(searchParams, "classId"),
    predicateId: readOptionalSearchParam(searchParams, "predicateId"),
    subjectThingId: readOptionalSearchParam(searchParams, "subjectThingId"),
    objectThingId: readOptionalSearchParam(searchParams, "objectThingId"),
    severity: severity === "error" || severity === "warning" ? severity : undefined,
    kind: readOptionalSearchParam(searchParams, "kind"),
  };
}

function readOptionalSearchParam(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key)?.trim();
  return value ? value : undefined;
}
