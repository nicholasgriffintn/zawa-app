import type { DashboardResponse, ServiceResponse, StationBoardResponse } from "@zawa/domain/api";

import { formatDateTime } from "./format";

type StationNotice = StationBoardResponse["notices"][number];
type ServiceIncident = ServiceResponse["incidents"][number];
type DashboardIncident = DashboardResponse["incidents"][number];

export interface TravelAlert {
  id: string;
  eyebrow: string | null;
  title: string;
  body: string | null;
  meta: string | null;
  href: string | null;
  hrefLabel: string | null;
}

export function stationTravelAlerts({
  notices,
  incidents,
}: {
  notices: StationNotice[];
  incidents?: ServiceIncident[];
}): TravelAlert[] {
  return [
    ...notices.map((notice) => ({
      id: `notice:${notice.id}`,
      eyebrow: notice.severity ?? null,
      title: notice.title ?? notice.category ?? "Station alert",
      body: notice.body,
      meta: formatAlertMeta([notice.severity, formatDateTime(notice.updated_at)]),
      href: null,
      hrefLabel: null,
    })),
    ...(incidents ?? []).map(serviceIncidentToAlert),
  ].filter((alert) => alert.title || alert.body);
}

export function serviceTravelAlerts(incidents: ServiceIncident[]): TravelAlert[] {
  return incidents.map(serviceIncidentToAlert);
}

export function dashboardTravelAlerts(incidents: DashboardIncident[]): TravelAlert[] {
  return incidents.map((incident) => ({
    id: `incident:${incident.incident_id}`,
    eyebrow: incident.priority === null ? null : `Priority ${incident.priority}`,
    title: incident.summary ?? "Travel alert",
    body:
      [incident.description, incident.routes_affected].filter(Boolean).join("\n\n") ||
      "No further detail has been supplied.",
    meta: formatAlertMeta([
      incident.operator_names,
      incident.end_at ? `Expected until ${formatDateTime(incident.end_at)}` : null,
      `Updated ${formatDateTime(incident.updated_at)}`,
    ]),
    href: incident.info_link_url,
    hrefLabel: incident.info_link_label,
  }));
}

function serviceIncidentToAlert(incident: ServiceIncident): TravelAlert {
  return {
    id: `incident:${incident.incident_id}`,
    eyebrow: incident.priority === null ? null : `Priority ${incident.priority}`,
    title: incident.summary ?? "Service alert",
    body: [incident.description, incident.routes_affected].filter(Boolean).join("\n\n") || null,
    meta: formatAlertMeta([
      incident.operator_name ?? incident.operator_code,
      formatDateTime(incident.updated_at),
    ]),
    href: incident.info_link_url,
    hrefLabel: incident.info_link_label,
  };
}

function formatAlertMeta(parts: Array<string | null | undefined>): string | null {
  const text = parts.filter(Boolean).join(" · ");
  return text || null;
}
