import {
  getActiveIncidentsForOperators,
  getActiveStationDisruptions,
  getStationMessages,
} from "@zawa/db/queries/operational-data";
import {
  getReferenceStationProfile,
  getReferenceStationProfiles,
} from "@zawa/db/queries/reference-data";
import type { D1DatabaseLike } from "@zawa/db/d1";
import type { ServiceResponse, StationBoardResponse } from "@zawa/domain/api";
import { htmlToPlainText } from "@zawa/shared/html";
import { nowIso } from "@zawa/shared/time";

import { filterIncidentsForService } from "./incident-relevance";

export async function enrichStationBoardResponse(
  db: D1DatabaseLike,
  board: StationBoardResponse,
): Promise<StationBoardResponse> {
  const [profile, disruptions, messages] = await Promise.all([
    getReferenceStationProfile(db, board.stationKey),
    getActiveStationDisruptions(db, board.stationKey),
    getStationMessages(db, board.stationKey),
  ]);

  return {
    ...board,
    stationName: board.stationName ?? profile?.station_name ?? null,
    profile,
    notices: [
      ...disruptions.map((disruption) => ({
        id: disruption.disruption_id,
        station_key: disruption.station_key,
        title: disruption.description,
        body: htmlToPlainText(disruption.message_html),
        category: disruption.category,
        severity: disruption.severity,
        updated_at: disruption.updated_at,
      })),
      ...messages.map((message) => ({
        id: message.message_hash,
        station_key: message.station_key,
        title: message.category,
        body: htmlToPlainText(message.message_html),
        category: message.category,
        severity: message.severity,
        updated_at: message.updated_at,
      })),
    ].filter((notice) => notice.title || notice.body),
    incidents: [],
  };
}

export async function enrichServiceResponse(
  db: D1DatabaseLike,
  snapshot: ServiceResponse,
): Promise<ServiceResponse> {
  const operatorCodes = snapshot.service.operator_code ? [snapshot.service.operator_code] : [];
  const stationKeys = snapshot.stops.map((stop) => stop.station_key);
  const [incidents, stationProfiles] = await Promise.all([
    getActiveIncidentsForOperators(db, operatorCodes, nowIso()),
    getReferenceStationProfiles(db, stationKeys),
  ]);
  const serviceIncidents = filterIncidentsForService({
    incidents: incidents.map((incident) => ({
      incident_id: incident.incident_id,
      planned: incident.planned,
      priority: incident.priority,
      summary: incident.summary,
      description: htmlToPlainText(incident.description_html),
      start_at: incident.start_at,
      end_at: incident.end_at,
      routes_affected: htmlToPlainText(incident.routes_affected_html),
      info_link_url: incident.info_link_url,
      info_link_label: incident.info_link_label,
      operator_code: incident.operator_code,
      operator_name: incident.operator_name,
      updated_at: incident.updated_at,
    })),
    service: snapshot.service,
    stops: snapshot.stops,
  });

  return {
    ...snapshot,
    incidents: serviceIncidents,
    stationProfiles,
  };
}
