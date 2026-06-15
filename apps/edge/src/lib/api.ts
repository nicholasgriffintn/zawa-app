import {
  parseServiceResponse,
  parseStationBoardResponse,
  parseStationListResponse,
  parseDashboardResponse,
  parseOntologyThingPageResponse,
  parseOntologyTriplePageResponse,
  parseOntologyQualityViolationPageResponse,
  parseSearchResponse,
  type DashboardResponse,
  type OntologyGraphResponse,
  type OntologyQualityViolationPageResponse,
  type OntologyThingPageResponse,
  type OntologyTriplePageResponse,
  type SearchResponse,
  type ServiceResponse,
  type StationBoardResponse,
  type StationListResponse,
} from "@zawa/domain/api";
import type { OntologyCatalog } from "@zawa/ontology";

export type BoardType = "departures" | "arrivals";
export type StationContextResponse = Pick<
  StationBoardResponse,
  "stationKey" | "stationName" | "profile" | "notices" | "incidents" | "ontology"
>;

export async function getStations(query = ""): Promise<StationListResponse> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());

  const res = await fetch(`/api/stations${params.size ? `?${params}` : ""}`);
  if (!res.ok) throw new Error("Station search is unavailable right now");
  const data = await res.json();
  return parseStationListResponse(data);
}

export async function getSearchResults(query: string, limit = 8): Promise<SearchResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.trim()) params.set("q", query.trim());

  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) throw new Error("Search is unavailable right now");
  return parseSearchResponse(await res.json());
}

export async function getStationBoard(
  stationKey: string,
  boardType: BoardType = "departures",
  options: { cursor?: string | null; limit?: number } = {},
): Promise<StationBoardResponse> {
  const params = new URLSearchParams();
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.limit) params.set("limit", String(options.limit));

  const res = await fetch(
    `/api/stations/${encodeURIComponent(stationKey)}/${boardType}${params.size ? `?${params}` : ""}`,
  );
  if (!res.ok) throw new Error("This station board is unavailable right now");
  const data = await res.json();
  return parseStationBoardResponse(data);
}

export async function getStationContext(stationKey: string): Promise<StationContextResponse> {
  const res = await fetch(`/api/stations/${encodeURIComponent(stationKey)}/context`);
  if (!res.ok) throw new Error("This station is unavailable right now");
  const data = parseStationBoardResponse(await res.json());
  return {
    stationKey: data.stationKey,
    stationName: data.stationName,
    profile: data.profile,
    notices: data.notices,
    incidents: data.incidents,
    ontology: data.ontology,
  };
}

export async function getService(serviceKey: string): Promise<ServiceResponse> {
  const res = await fetch(`/api/services/${encodeURIComponent(serviceKey)}`);
  if (!res.ok) throw new Error("This service is unavailable right now");
  const data = await res.json();
  return parseServiceResponse(data);
}

export async function getDashboard(): Promise<DashboardResponse> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("The dashboard is unavailable right now");
  const data = await res.json();
  return parseDashboardResponse(data);
}

export async function getOntologyCatalog(): Promise<OntologyCatalog> {
  const res = await fetch("/api/ontologies");
  if (!res.ok) throw new Error("The ontology catalogue is unavailable right now");
  return res.json();
}

export async function getOntologyThingGraph(thingId: string): Promise<OntologyGraphResponse> {
  const res = await fetch(`/api/ontologies/things/${encodeURIComponent(thingId)}`);
  if (!res.ok) throw new Error("The ontology graph is unavailable right now");
  return res.json();
}

export async function getOntologyThingPage(options: {
  limit: number;
  offset: number;
  query?: string;
  thingType?: string;
  classId?: string;
}): Promise<OntologyThingPageResponse> {
  const params = new URLSearchParams({
    limit: String(options.limit),
    offset: String(options.offset),
  });
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.thingType?.trim()) params.set("thingType", options.thingType.trim());
  if (options.classId?.trim()) params.set("classId", options.classId.trim());
  const res = await fetch(`/api/ontologies/things?${params}`);
  if (!res.ok) throw new Error("Ontology things are unavailable right now");
  return parseOntologyThingPageResponse(await res.json());
}

export async function getOntologyTriplePage(options: {
  limit: number;
  offset: number;
  query?: string;
  predicateId?: string;
  subjectThingId?: string;
  objectThingId?: string;
}): Promise<OntologyTriplePageResponse> {
  const params = new URLSearchParams({
    limit: String(options.limit),
    offset: String(options.offset),
  });
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.predicateId?.trim()) params.set("predicateId", options.predicateId.trim());
  if (options.subjectThingId?.trim()) {
    params.set("subjectThingId", options.subjectThingId.trim());
  }
  if (options.objectThingId?.trim()) params.set("objectThingId", options.objectThingId.trim());
  const res = await fetch(`/api/ontologies/triples?${params}`);
  if (!res.ok) throw new Error("Ontology triples are unavailable right now");
  return parseOntologyTriplePageResponse(await res.json());
}

export async function getOntologyQualityViolationPage(options: {
  limit: number;
  offset: number;
  query?: string;
  severity?: "error" | "warning";
  kind?: string;
}): Promise<OntologyQualityViolationPageResponse> {
  const params = new URLSearchParams({
    limit: String(options.limit),
    offset: String(options.offset),
  });
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.severity) params.set("severity", options.severity);
  if (options.kind?.trim()) params.set("kind", options.kind.trim());
  const res = await fetch(`/api/ontologies/quality?${params}`);
  if (!res.ok) throw new Error("Ontology quality results are unavailable right now");
  return parseOntologyQualityViolationPageResponse(await res.json());
}
