import type { ServiceResponse } from "@zawa/domain/api";

type Incident = ServiceResponse["incidents"][number];
type Service = ServiceResponse["service"];
type Stop = ServiceResponse["stops"][number];

export function filterIncidentsForService({
  incidents,
  service,
  stops,
}: {
  incidents: Incident[];
  service: Service;
  stops: Stop[];
}): Incident[] {
  const routeTerms = routeSearchTerms(service, stops);
  if (routeTerms.length === 0) return incidents;

  return incidents.filter((incident) => incidentAppliesToService(incident, service, routeTerms));
}

function incidentAppliesToService(
  incident: Incident,
  service: Service,
  routeTerms: string[],
): boolean {
  const searchableText = normaliseSearchText([
    incident.summary,
    incident.description,
    incident.routes_affected,
    incident.operator_name,
    incident.operator_code,
  ]);

  if (!searchableText) return false;

  if (mentionsAllOperatorServices(searchableText, incident, service)) return true;

  return routeTerms.some((term) => searchableText.includes(term));
}

function routeSearchTerms(service: Service, stops: Stop[]): string[] {
  const terms = [
    service.origin_name,
    service.destination_name,
    ...stops.flatMap((stop) => [stop.station_name, stop.station_key]),
  ];

  return [...new Set(terms.map(normaliseTerm).filter((term): term is string => Boolean(term)))];
}

function mentionsAllOperatorServices(text: string, incident: Incident, service: Service): boolean {
  const operatorTerms = [incident.operator_name, service.operator_code, incident.operator_code]
    .map(normaliseTerm)
    .filter((term): term is string => Boolean(term));

  return operatorTerms.some(
    (operator) =>
      text.includes(`all ${operator} services`) || text.includes(`all ${operator} trains`),
  );
}

function normaliseSearchText(values: Array<string | null | undefined>): string {
  return values
    .map((value) => normaliseTerm(value))
    .filter(Boolean)
    .join(" ");
}

function normaliseTerm(value: string | null | undefined): string | null {
  const normalised = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return normalised && normalised.length > 1 ? normalised : null;
}
