import {
  isRecord,
  recordArray,
  stringOrNumberValue,
  stringValue,
  valueArray,
} from "@zawa/shared/values";

import { fetchRdmJson, fetchRdmText } from "./http";
import { parseRdmXml } from "./xml";

export interface RdmKnowledgebaseEnv {
  RDM_STATIONS_TOC_URL: string;
  RDM_STATION_BY_CRS_URL: string;
  RDM_DISRUPTION_LIST_URL: string;
  RDM_NSI_URL: string;
  RDM_NSI_TOC_URL: string;
  RDM_INCIDENTS_URL: string;
  RDM_STATIONS_API_KEY: string;
  RDM_DISRUPTIONS_API_KEY: string;
  RDM_NSI_API_KEY: string;
  RDM_INCIDENTS_API_KEY: string;
}

export interface RdmStationProfile {
  station_key: string;
  station_name: string;
  sixteen_character_name: string | null;
  national_location_code: string | null;
  station_operator: string | null;
  latitude: number | null;
  longitude: number | null;
  changed_at: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  address_line_4: string | null;
  postcode: string | null;
  staffing_level: string | null;
  cctv_available: boolean | null;
  cis_modes: string[];
  customer_help_points_available: boolean | null;
  ticket_office_available: boolean | null;
  ticket_machine_available: boolean | null;
  oyster_issued: boolean | null;
  oyster_topup_ticket_machine: boolean | null;
  oyster_accepted: boolean | null;
  smartcard_issued: boolean | null;
  smartcard_topup_ticket_office: boolean | null;
  smartcard_topup_ticket_machine: boolean | null;
  smartcard_validator: boolean | null;
  seated_area_available: boolean | null;
  waiting_room_available: boolean | null;
  toilets_available: boolean | null;
  wifi_available: boolean | null;
  induction_loop: boolean | null;
  accessible_ticket_machines: boolean | null;
  ramp_for_train_access: boolean | null;
  accessible_taxis_available: boolean | null;
  national_key_toilets_available: boolean | null;
  step_free_access_coverage: string | null;
  impaired_mobility_set_down_available: boolean | null;
  cycle_storage_spaces: number | null;
  car_park_spaces: number | null;
  accessible_car_park_spaces: number | null;
  rail_replacement_map_url: string | null;
}

export interface RdmOperatorStatus {
  toc_code: string;
  toc_name: string | null;
  status: string;
  status_description: string | null;
  status_image: string | null;
  twitter_account: string | null;
  additional_info: string | null;
  disruptions: RdmOperatorDisruption[];
}

export interface RdmOperatorDisruption {
  disruption_id: string;
  detail: string | null;
  url: string | null;
}

export interface RdmIncident {
  incident_id: string;
  version: string | null;
  planned: boolean | null;
  priority: number | null;
  summary: string | null;
  description_html: string | null;
  start_at: string | null;
  end_at: string | null;
  routes_affected_html: string | null;
  info_link_url: string | null;
  info_link_label: string | null;
  operators: Array<{ operator_code: string; operator_name: string | null }>;
}

export interface RdmStationDisruptionGroup {
  station_key: string;
  generated_at: string | null;
  disruptions: RdmStationDisruption[];
}

export interface RdmStationDisruption {
  disruption_id: string;
  category: string | null;
  severity: string | null;
  description: string | null;
  message_html: string | null;
  is_suppressed: boolean;
}

export async function fetchRdmStationProfile(
  env: RdmKnowledgebaseEnv,
  stationKey: string,
): Promise<RdmStationProfile> {
  const xml = await fetchRdmText({
    apiKey: env.RDM_STATIONS_API_KEY,
    template: env.RDM_STATION_BY_CRS_URL,
    path: { CRS: stationKey },
  });
  return parseStationProfile(parseRdmXml(xml));
}

export async function fetchRdmStationsForToc(
  env: RdmKnowledgebaseEnv,
  tocCode: string,
): Promise<RdmStationProfile[]> {
  const xml = await fetchRdmText({
    apiKey: env.RDM_STATIONS_API_KEY,
    template: env.RDM_STATIONS_TOC_URL,
    path: { TOC: tocCode },
  });
  const data = parseRdmXml(xml);
  const root = isRecord(data) ? data.StationList : null;
  const record = isRecord(root) ? root : null;
  return valueArray(record?.Station).flatMap((station) => {
    return isRecord(station) ? [stationProfileFromRecord(station)] : [];
  });
}

export async function fetchRdmNationalServiceIndicator(
  env: RdmKnowledgebaseEnv,
  tocCode?: string,
): Promise<RdmOperatorStatus[]> {
  const xml = await fetchRdmText({
    apiKey: env.RDM_NSI_API_KEY,
    template: tocCode ? env.RDM_NSI_TOC_URL : env.RDM_NSI_URL,
    path: tocCode ? { TOC: tocCode } : {},
  });
  const data = parseRdmXml(xml);
  const root = isRecord(data) ? data.NSI : null;
  const record = isRecord(root) ? root : null;
  return valueArray(record?.TOC).flatMap((toc) => {
    return isRecord(toc) ? [operatorStatusFromRecord(toc)] : [];
  });
}

export async function fetchRdmIncidents(env: RdmKnowledgebaseEnv): Promise<RdmIncident[]> {
  const xml = await fetchRdmText({
    apiKey: env.RDM_INCIDENTS_API_KEY,
    template: env.RDM_INCIDENTS_URL,
    path: {},
  });
  const data = parseRdmXml(xml);
  const root = isRecord(data) ? data.Incidents : null;
  const record = isRecord(root) ? root : null;
  return valueArray(record?.PtIncident).flatMap((incident) => {
    return isRecord(incident) ? [incidentFromRecord(incident)] : [];
  });
}

export async function fetchRdmDisruptionList(
  env: RdmKnowledgebaseEnv,
  stationKeys: string[],
): Promise<RdmStationDisruptionGroup[]> {
  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_DISRUPTIONS_API_KEY,
    template: env.RDM_DISRUPTION_LIST_URL,
    path: { CRSList: stationKeys.join(",") },
  });
  return recordArray(data).flatMap((group) => {
    const stationKey = stringValue(group.crs);
    if (!stationKey) return [];
    return [
      {
        station_key: stationKey.toUpperCase(),
        generated_at: stringValue(group.generatedAt) ?? null,
        disruptions: recordArray(group.disruptions).flatMap((item) => {
          const disruptionId = stringOrNumberValue(item.id);
          if (!disruptionId) return [];
          return [
            {
              disruption_id: disruptionId,
              category: stringValue(item.category) ?? null,
              severity: stringValue(item.severity) ?? null,
              description: stringValue(item.description) ?? null,
              message_html: stringValue(item.xhtmlMessage) ?? null,
              is_suppressed: item.isSuppressed === true,
            },
          ];
        }),
      },
    ];
  });
}

function parseStationProfile(value: unknown): RdmStationProfile {
  const root = isRecord(value) ? value["StationV4.0"] : null;
  if (!isRecord(root)) throw new Error("Invalid RDM station profile response");
  return stationProfileFromRecord(root);
}

function stationProfileFromRecord(station: Record<string, unknown>): RdmStationProfile {
  const stationKey = stringValue(station.CrsCode);
  const stationName = stringValue(station.Name);
  if (!stationKey || !stationName) throw new Error("Invalid RDM station profile");

  const alternativeIds = isRecord(station.AlternativeIdentifiers)
    ? station.AlternativeIdentifiers
    : null;
  const address = stationAddress(station);
  const changeHistory = isRecord(station.ChangeHistory) ? station.ChangeHistory : null;
  const staffing = isRecord(station.Staffing) ? station.Staffing : null;
  const informationSystems = isRecord(station.InformationSystems)
    ? station.InformationSystems
    : null;
  const fares = isRecord(station.Fares) ? station.Fares : null;
  const stationFacilities = isRecord(station.StationFacilities) ? station.StationFacilities : null;
  const accessibility = isRecord(station.Accessibility) ? station.Accessibility : null;
  const interchange = isRecord(station.Interchange) ? station.Interchange : null;
  const smartcardTopup = isRecord(fares?.SmartcardTopup) ? fares.SmartcardTopup : null;
  const oysterTopup = isRecord(fares?.OystercardTopup) ? fares.OystercardTopup : null;
  const cycleStorage = isRecord(interchange?.CycleStorage) ? interchange.CycleStorage : null;
  const carPark = firstRecord(interchange?.CarPark);

  return {
    station_key: stationKey.toUpperCase(),
    station_name: stationName,
    sixteen_character_name: stringValue(station.SixteenCharacterName) ?? null,
    national_location_code: stringValue(alternativeIds?.NationalLocationCode) ?? null,
    station_operator: stringValue(station.StationOperator) ?? null,
    latitude: numberFromXml(station.Latitude),
    longitude: numberFromXml(station.Longitude),
    changed_at: stringValue(changeHistory?.LastChangedDate) ?? null,
    address_line_1: address.lines[0] ?? null,
    address_line_2: address.lines[1] ?? null,
    address_line_3: address.lines[2] ?? null,
    address_line_4: address.lines[3] ?? null,
    postcode: address.postcode,
    staffing_level: stringValue(staffing?.StaffingLevel) ?? null,
    cctv_available: availableFrom(staffing?.ClosedCircuitTelevision),
    cis_modes: valueArray(informationSystems?.CIS).flatMap((mode) => {
      const value = stringValue(mode);
      return value ? [value] : [];
    }),
    customer_help_points_available: availableFrom(informationSystems?.CustomerHelpPoints),
    ticket_office_available: availableFrom(fares?.TicketOffice),
    ticket_machine_available: availableFrom(fares?.TicketMachine),
    oyster_issued: booleanFromXml(fares?.OystercardIssued),
    oyster_topup_ticket_machine: booleanFromXml(oysterTopup?.TicketMachine),
    oyster_accepted: booleanFromXml(fares?.UseOystercard),
    smartcard_issued: booleanFromXml(fares?.SmartcardIssued),
    smartcard_topup_ticket_office: booleanFromXml(smartcardTopup?.TicketOffice),
    smartcard_topup_ticket_machine: booleanFromXml(smartcardTopup?.TicketMachine),
    smartcard_validator: booleanFromXml(fares?.SmartcardValidator),
    seated_area_available: availableFrom(stationFacilities?.SeatedArea),
    waiting_room_available: availableFrom(stationFacilities?.WaitingRoom),
    toilets_available: availableFrom(stationFacilities?.Toilets),
    wifi_available: availableFrom(stationFacilities?.WiFi),
    induction_loop: booleanFromXml(accessibility?.InductionLoop),
    accessible_ticket_machines: availableFrom(accessibility?.AccessibleTicketMachines),
    ramp_for_train_access: availableFrom(accessibility?.RampForTrainAccess),
    accessible_taxis_available: availableFrom(accessibility?.AccessibleTaxis),
    national_key_toilets_available: availableFrom(accessibility?.NationalKeyToilets),
    step_free_access_coverage:
      stringValue(
        isRecord(accessibility?.StepFreeAccess) ? accessibility.StepFreeAccess.Coverage : null,
      ) ?? null,
    impaired_mobility_set_down_available: availableFrom(accessibility?.ImpairedMobilitySetDown),
    cycle_storage_spaces: numberFromXml(cycleStorage?.Spaces),
    car_park_spaces: numberFromXml(carPark?.Spaces),
    accessible_car_park_spaces: numberFromXml(carPark?.NumberAccessibleSpaces),
    rail_replacement_map_url:
      stringValue(
        isRecord(interchange?.RailReplacementServices)
          ? interchange.RailReplacementServices.RailReplacementMap
          : null,
      ) ?? null,
  };
}

function stationAddress(station: Record<string, unknown>): {
  lines: string[];
  postcode: string | null;
} {
  const address = isRecord(station.Address) ? station.Address : null;
  const postalAddress = isRecord(address?.PostalAddress) ? address.PostalAddress : null;
  const lineAddress = isRecord(postalAddress?.A_5LineAddress) ? postalAddress.A_5LineAddress : null;
  return {
    lines: valueArray(lineAddress?.Line).flatMap((line) => {
      const value = stringValue(line);
      return value ? [value] : [];
    }),
    postcode: stringValue(lineAddress?.PostCode) ?? null,
  };
}

function operatorStatusFromRecord(toc: Record<string, unknown>): RdmOperatorStatus {
  const tocCode = stringValue(toc.TocCode);
  if (!tocCode) throw new Error("Invalid RDM NSI TOC record");

  return {
    toc_code: tocCode,
    toc_name: stringValue(toc.TocName) ?? null,
    status: stringValue(toc.Status) ?? "Unknown",
    status_description: stringValue(toc.StatusDescription) ?? null,
    status_image: stringValue(toc.StatusImage) ?? null,
    twitter_account: stringValue(toc.TwitterAccount) ?? null,
    additional_info: stringValue(toc.AdditionalInfo) ?? null,
    disruptions: valueArray(toc.ServiceGroup).flatMap((group) => {
      if (!isRecord(group)) return [];
      const disruptionId = stringValue(group.CurrentDisruption);
      if (!disruptionId) return [];
      return [
        {
          disruption_id: disruptionId,
          detail: stringValue(group.CustomDetail) ?? null,
          url: stringValue(group.CustomURL) ?? null,
        },
      ];
    }),
  };
}

function incidentFromRecord(incident: Record<string, unknown>): RdmIncident {
  const incidentId = stringValue(incident.IncidentNumber) ?? stringValue(incident.ParticipantRef);
  if (!incidentId) throw new Error("Invalid RDM incident record");

  const validityPeriod = isRecord(incident.ValidityPeriod) ? incident.ValidityPeriod : null;
  const affects = isRecord(incident.Affects) ? incident.Affects : null;
  const operators = isRecord(affects?.Operators) ? affects.Operators : null;
  const infoLinks = isRecord(incident.InfoLinks) ? incident.InfoLinks : null;
  const infoLink = firstRecord(infoLinks?.InfoLink);

  return {
    incident_id: incidentId,
    version: stringOrNumberValue(incident.Version) ?? null,
    planned: booleanFromXml(incident.Planned),
    priority: numberFromXml(incident.IncidentPriority),
    summary: stringValue(incident.Summary) ?? null,
    description_html: stringValue(incident.Description) ?? null,
    start_at: stringValue(validityPeriod?.StartTime) ?? null,
    end_at: stringValue(validityPeriod?.EndTime) ?? null,
    routes_affected_html: stringValue(affects?.RoutesAffected) ?? null,
    info_link_url: stringValue(infoLink?.Uri) ?? null,
    info_link_label: stringValue(infoLink?.Label) ?? null,
    operators: valueArray(operators?.AffectedOperator).flatMap((operator) => {
      if (!isRecord(operator)) return [];
      const operatorCode = stringValue(operator.OperatorRef);
      if (!operatorCode) return [];
      return [
        { operator_code: operatorCode, operator_name: stringValue(operator.OperatorName) ?? null },
      ];
    }),
  };
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  return recordArray(value)[0] ?? null;
}

function availableFrom(value: unknown): boolean | null {
  if (typeof value === "boolean" || typeof value === "string") return booleanFromXml(value);
  if (!isRecord(value)) return null;
  return booleanFromXml(value.Available);
}

function booleanFromXml(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const text = stringValue(value)?.toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  return null;
}

function numberFromXml(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
