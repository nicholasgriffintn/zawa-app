import type { ServiceResponse, StationBoardResponse } from "@zawa/domain/api";
import { toTrainRunKey } from "@zawa/domain/keys";
import { railClockTimeToIso } from "@zawa/domain/time";
import { dateTimeToIso, nowIso } from "@zawa/shared/time";
import {
  booleanValue,
  isRecord,
  numberValue,
  stringOrNull,
  stringValue,
} from "@zawa/shared/values";

import { buildServiceSummary } from "./summary";

export type RdmBoardType = "departures" | "arrivals";

interface RdmServiceLocation {
  locationName?: string;
  crs?: string;
  tiploc?: string;
  via?: string;
}

interface RdmCallingPoint {
  locationName?: string;
  crs?: string;
  tiploc?: string;
  st?: string;
  et?: string;
  at?: string;
  sta?: string;
  eta?: string;
  ata?: string;
  arrivalType?: string;
  arrivalSource?: string;
  arrivalSourceInstance?: string;
  std?: string;
  etd?: string;
  atd?: string;
  departureType?: string;
  departureSource?: string;
  departureSourceInstance?: string;
  isCancelled?: boolean;
  isOperational?: boolean;
  isPass?: boolean;
  platform?: string;
  platformIsHidden?: boolean;
  path?: string;
  line?: string;
  activities?: string;
  cancelReason?: string;
  delayReason?: string;
}

interface RdmCallingPointGroup {
  callingPoint?: RdmCallingPoint[];
}

interface RdmServiceItem {
  previousCallingPoints?: RdmCallingPointGroup[];
  subsequentCallingPoints?: RdmCallingPointGroup[];
  locations?: RdmCallingPoint[];
  formation?: RdmFormation | RdmFormation[];
  origin?: RdmServiceLocation[];
  destination?: RdmServiceLocation[];
  currentOrigins?: RdmServiceLocation[];
  currentDestinations?: RdmServiceLocation[];
  rid?: string;
  uid?: string;
  trainid?: string;
  rsid?: string;
  sdd?: string;
  sta?: string;
  eta?: string;
  ata?: string;
  std?: string;
  etd?: string;
  atd?: string;
  arrivalType?: string;
  arrivalSource?: string;
  arrivalSourceInstance?: string;
  departureType?: string;
  departureSource?: string;
  departureSourceInstance?: string;
  platform?: string;
  platformIsHidden?: boolean;
  operator?: string;
  operatorCode?: string;
  isCancelled?: boolean;
  cancelReason?: string;
  delayReason?: string;
  serviceID?: string;
  serviceType?: string;
  category?: string;
  activities?: string;
  length?: number;
  isPassengerService?: boolean;
  isCharter?: boolean;
  isReverseFormation?: boolean;
  detachFront?: boolean;
}

interface RdmStationBoard {
  trainServices?: RdmServiceItem[];
  busServices?: RdmServiceItem[];
  ferryServices?: RdmServiceItem[];
  generatedAt?: string;
  locationName?: string;
  crs?: string;
}

interface RdmServiceDetails extends RdmServiceItem {
  generatedAt?: string;
  locationName?: string;
  crs?: string;
}

interface RdmLoadingCategory {
  code?: string;
  colour?: string;
  image?: string;
  value?: string;
}

interface RdmServiceLoading {
  loadingCategory?: RdmLoadingCategory;
  loadingPercentage?: number;
}

interface RdmCoach {
  coachClass?: string;
  toiletStatus?: string;
  toiletValue?: string;
  loading?: number;
  loadingSpecified?: boolean;
  number?: string;
}

interface RdmFormation {
  tiploc?: string;
  loadingCategory?: RdmLoadingCategory;
  serviceLoading?: RdmServiceLoading;
  coaches?: RdmCoach[];
  source?: string;
  sourceInstance?: string;
}

export function mapRdmBoard(
  stationKey: string,
  boardType: RdmBoardType,
  data: unknown,
  limit: number,
  timeOffset: number,
): StationBoardResponse {
  const board = parseRdmStationBoard(data);
  const serviceDate = serviceDateFromGeneratedAt(board.generatedAt);
  const updatedAt = dateTimeToIso(board.generatedAt) ?? nowIso();
  const rows = boardServices(board)
    .filter(({ service }) => hasBoardTime(service, boardType))
    .slice(0, limit)
    .map(({ service, serviceType }) => {
      const scheduled = boardType === "arrivals" ? service.sta : service.std;
      const expected =
        boardType === "arrivals" ? (service.ata ?? service.eta) : (service.atd ?? service.etd);
      return {
        station_key: stationKey,
        board_type: boardType,
        service_key:
          service.serviceID ??
          service.rsid ??
          `${stationKey}:${scheduled ?? expected ?? "unknown"}`,
        scheduled_ts: railClockTimeToIso(scheduled, serviceDate),
        expected_ts: expectedToIso(expected, scheduled, serviceDate),
        platform: stringOrNull(service.platform),
        origin_name: firstLocationName(service.origin ?? service.currentOrigins),
        destination_name: firstLocationName(service.destination ?? service.currentDestinations),
        via_name: null,
        service_type: stringOrNull(service.serviceType) ?? serviceType,
        operator_code: stringOrNull(service.operatorCode),
        status: serviceStatus(service),
        updated_at: updatedAt,
      };
    });

  return {
    stationKey,
    stationName: stringOrNull(board.locationName),
    boardType,
    rows,
    profile: null,
    notices: [],
    incidents: [],
    previousCursor: timeOffset > -120 ? String(Math.max(timeOffset - 60, -120)) : null,
    nextCursor:
      rows.length === limit && timeOffset < 119 ? String(Math.min(timeOffset + 60, 119)) : null,
  };
}

export function mapRdmServiceDetails(serviceKey: string, data: unknown): ServiceResponse {
  const details = parseRdmServiceDetails(data);
  const serviceDate = serviceDateFromDetails(details);
  const callingPoints = serviceCallingPoints(details);
  const updatedAt = dateTimeToIso(details.generatedAt) ?? nowIso();
  const originName =
    firstLocationName(details.origin ?? details.currentOrigins) ??
    callingPoints[0]?.locationName ??
    null;
  const destinationName =
    firstLocationName(details.destination ?? details.currentDestinations) ??
    callingPoints[callingPoints.length - 1]?.locationName ??
    null;

  const service: ServiceResponse["service"] = {
    service_key: serviceKey,
    train_run_key: details.trainid
      ? (toTrainRunKey({ trainId: details.trainid, date: serviceDate }) ?? null)
      : (details.rsid ?? details.rid ?? null),
    rid: details.rid ?? null,
    uid: details.uid ?? null,
    train_id: details.trainid ?? null,
    rsid: details.rsid ?? null,
    operator_code: stringOrNull(details.operatorCode),
    origin_name: originName,
    destination_name: destinationName,
    service_type: stringOrNull(details.serviceType),
    category: stringOrNull(details.category),
    activities: stringOrNull(details.activities),
    service_length: details.length ?? null,
    is_passenger_service: booleanToInteger(details.isPassengerService),
    is_charter: booleanToInteger(details.isCharter),
    is_reverse_formation: booleanToInteger(details.isReverseFormation),
    detach_front: booleanToInteger(details.detachFront),
    scheduled_start_ts: rdmTimeToIso(
      details.std ?? details.sta ?? callingPoints[0]?.std ?? callingPoints[0]?.st,
      serviceDate,
    ),
    expected_start_ts: expectedToIso(
      details.atd ?? details.etd ?? details.ata ?? details.eta,
      details.std ?? details.sta,
      serviceDate,
    ),
    status: serviceStatus(details),
    delay_minutes: null,
    cancellation_reason: stringOrNull(details.cancelReason ?? details.delayReason),
    last_event_id: `rdm-service:${serviceKey}:${updatedAt}`,
    updated_at: updatedAt,
  };

  const stops = callingPoints.map<ServiceResponse["stops"][number]>((point, index) => ({
    service_key: serviceKey,
    stop_index: index,
    station_key: stringOrNull(point.crs) ?? `STOP${index + 1}`,
    station_name: stringOrNull(point.locationName),
    tiploc: stringOrNull(point.tiploc),
    scheduled_arrival_ts: rdmTimeToIso(point.sta ?? point.st, serviceDate),
    expected_arrival_ts: expectedToIso(
      point.ata ?? point.eta ?? point.at ?? point.et,
      point.sta ?? point.st,
      serviceDate,
    ),
    actual_arrival_ts: rdmTimeToIso(point.ata ?? point.at, serviceDate),
    scheduled_departure_ts: rdmTimeToIso(point.std ?? point.st, serviceDate),
    expected_departure_ts: expectedToIso(
      point.atd ?? point.etd ?? point.at ?? point.et,
      point.std ?? point.st,
      serviceDate,
    ),
    actual_departure_ts: rdmTimeToIso(point.atd ?? point.at, serviceDate),
    arrival_type: stringOrNull(point.arrivalType),
    arrival_source: stringOrNull(point.arrivalSource),
    arrival_source_instance: stringOrNull(point.arrivalSourceInstance),
    departure_type: stringOrNull(point.departureType),
    departure_source: stringOrNull(point.departureSource),
    departure_source_instance: stringOrNull(point.departureSourceInstance),
    platform: stringOrNull(point.platform),
    platform_is_hidden: booleanToInteger(point.platformIsHidden),
    path: stringOrNull(point.path),
    line: stringOrNull(point.line),
    activities: stringOrNull(point.activities),
    is_pass: booleanToInteger(point.isPass),
    is_operational: booleanToInteger(point.isOperational),
    stop_cancel_reason: stringOrNull(point.cancelReason),
    stop_delay_reason: stringOrNull(point.delayReason),
    stop_status: point.isCancelled ? "service.cancelled" : service.status,
    updated_at: updatedAt,
  }));

  return {
    service,
    stops,
    summary: buildServiceSummary(service, stops),
    formations: mapFormations(serviceKey, details.formation, updatedAt),
    movements: [],
    incidents: [],
    stationProfiles: [],
  };
}

function boardServices(data: RdmStationBoard): Array<{
  service: RdmServiceItem;
  serviceType: string;
}> {
  return [
    ...(data.trainServices ?? []).map((service) => ({ service, serviceType: "train" })),
    ...(data.busServices ?? []).map((service) => ({ service, serviceType: "bus" })),
    ...(data.ferryServices ?? []).map((service) => ({ service, serviceType: "ferry" })),
  ];
}

function parseRdmStationBoard(value: unknown): RdmStationBoard {
  const record = isRecord(value) ? value : null;
  if (!record) throw new Error("Invalid RDM station board response");
  return {
    trainServices: arrayOfServiceItems(record.trainServices),
    busServices: arrayOfServiceItems(record.busServices),
    ferryServices: arrayOfServiceItems(record.ferryServices),
    generatedAt: stringValue(record.generatedAt),
    locationName: stringValue(record.locationName),
    crs: stringValue(record.crs),
  };
}

function parseRdmServiceDetails(value: unknown): RdmServiceDetails {
  const item = serviceItem(value);
  const record = isRecord(value) ? value : null;
  if (!item || !record) throw new Error("Invalid RDM service detail response");
  return {
    ...item,
    generatedAt: stringValue(record.generatedAt),
    locationName: stringValue(record.locationName),
    crs: stringValue(record.crs),
  };
}

function arrayOfServiceItems(value: unknown): RdmServiceItem[] {
  return Array.isArray(value) ? value.flatMap((item) => serviceItem(item) ?? []) : [];
}

function serviceItem(value: unknown): RdmServiceItem | null {
  const record = isRecord(value) ? value : null;
  if (!record) return null;
  return {
    previousCallingPoints: callingPointGroups(record.previousCallingPoints),
    subsequentCallingPoints: callingPointGroups(record.subsequentCallingPoints),
    locations: callingPoints(record.locations),
    formation: formationValue(record.formation),
    origin: locations(record.origin),
    destination: locations(record.destination),
    currentOrigins: locations(record.currentOrigins),
    currentDestinations: locations(record.currentDestinations),
    rid: stringValue(record.rid),
    uid: stringValue(record.uid),
    trainid: stringValue(record.trainid),
    rsid: stringValue(record.rsid),
    sdd: stringValue(record.sdd),
    sta: stringValue(record.sta),
    eta: stringValue(record.eta),
    ata: stringValue(record.ata),
    std: stringValue(record.std),
    etd: stringValue(record.etd),
    atd: stringValue(record.atd),
    arrivalType: stringValue(record.arrivalType),
    arrivalSource: stringValue(record.arrivalSource),
    arrivalSourceInstance: stringValue(record.arrivalSourceInstance),
    departureType: stringValue(record.departureType),
    departureSource: stringValue(record.departureSource),
    departureSourceInstance: stringValue(record.departureSourceInstance),
    platform: stringValue(record.platform),
    platformIsHidden: booleanValue(record.platformIsHidden),
    operator: stringValue(record.operator),
    operatorCode: stringValue(record.operatorCode),
    isCancelled: booleanValue(record.isCancelled),
    cancelReason: reasonText(record.cancelReason),
    delayReason: reasonText(record.delayReason),
    serviceID: stringValue(record.serviceID),
    serviceType: stringValue(record.serviceType),
    category: stringValue(record.category),
    activities: stringValue(record.activities),
    length: integerValue(record.length),
    isPassengerService: booleanValue(record.isPassengerService),
    isCharter: booleanValue(record.isCharter),
    isReverseFormation: booleanValue(record.isReverseFormation),
    detachFront: booleanValue(record.detachFront),
  };
}

function callingPointGroups(value: unknown): RdmCallingPointGroup[] {
  if (!Array.isArray(value)) return [];
  return value.map((group) => ({
    callingPoint: callingPoints(isRecord(group) ? group.callingPoint : undefined),
  }));
}

function callingPoints(value: unknown): RdmCallingPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    const record = isRecord(point) ? point : null;
    if (!record) return [];
    return [
      {
        locationName: stringValue(record.locationName),
        crs: stringValue(record.crs),
        tiploc: stringValue(record.tiploc),
        st: stringValue(record.st),
        et: stringValue(record.et),
        at: stringValue(record.at),
        sta: stringValue(record.sta),
        eta: stringValue(record.eta),
        ata: stringValue(record.ata),
        arrivalType: stringValue(record.arrivalType),
        arrivalSource: stringValue(record.arrivalSource),
        arrivalSourceInstance: stringValue(record.arrivalSourceInstance),
        std: stringValue(record.std),
        etd: stringValue(record.etd),
        atd: stringValue(record.atd),
        departureType: stringValue(record.departureType),
        departureSource: stringValue(record.departureSource),
        departureSourceInstance: stringValue(record.departureSourceInstance),
        isCancelled: booleanValue(record.isCancelled),
        isOperational: booleanValue(record.isOperational),
        isPass: booleanValue(record.isPass),
        platform: stringValue(record.platform),
        platformIsHidden: booleanValue(record.platformIsHidden),
        path: stringValue(record.path),
        line: stringValue(record.line),
        activities: stringValue(record.activities),
        cancelReason: reasonText(record.cancelReason),
        delayReason: reasonText(record.delayReason),
      },
    ];
  });
}

function locations(value: unknown): RdmServiceLocation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((location) => {
    const record = isRecord(location) ? location : null;
    if (!record) return [];
    return [
      {
        locationName: stringValue(record.locationName),
        crs: stringValue(record.crs),
        tiploc: stringValue(record.tiploc),
        via: stringValue(record.via),
      },
    ];
  });
}

function hasBoardTime(service: RdmServiceItem, boardType: RdmBoardType): boolean {
  return boardType === "arrivals"
    ? Boolean(service.sta || service.eta || service.ata)
    : Boolean(service.std || service.etd || service.atd);
}

function serviceStatus(service: RdmServiceItem): string {
  if (service.isCancelled) return "service.cancelled";
  if (service.ata || service.atd) return "service.updated";
  if (service.eta && service.eta !== "On time" && service.eta !== service.sta)
    return "service.updated";
  if (service.etd && service.etd !== "On time" && service.etd !== service.std)
    return "service.updated";
  return "service.activated";
}

function callingPointsFromGroups(groups: RdmCallingPointGroup[] | undefined): RdmCallingPoint[] {
  return groups?.flatMap((group) => group.callingPoint ?? []) ?? [];
}

function currentCallingPoint(data: RdmServiceDetails): RdmCallingPoint | null {
  if (!data.locationName && !data.crs) return null;
  return {
    locationName: data.locationName,
    crs: data.crs,
    st: data.std ?? data.sta,
    et: data.etd ?? data.eta,
    at: data.atd ?? data.ata,
    sta: data.sta,
    eta: data.eta,
    ata: data.ata,
    arrivalType: data.arrivalType,
    arrivalSource: data.arrivalSource,
    arrivalSourceInstance: data.arrivalSourceInstance,
    std: data.std,
    etd: data.etd,
    atd: data.atd,
    departureType: data.departureType,
    departureSource: data.departureSource,
    departureSourceInstance: data.departureSourceInstance,
    isCancelled: data.isCancelled,
    platform: data.platform,
    platformIsHidden: data.platformIsHidden,
    activities: data.activities,
    cancelReason: data.cancelReason,
    delayReason: data.delayReason,
  };
}

function expectedToIso(
  expected: string | undefined,
  scheduled: string | undefined,
  serviceDate: string,
): string | null {
  if (!expected || expected === "On time" || expected === "No report") {
    return rdmTimeToIso(scheduled, serviceDate);
  }
  if (expected === "Delayed") return null;
  return rdmTimeToIso(expected, serviceDate);
}

function serviceDateFromGeneratedAt(value: string | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function serviceDateFromDetails(details: RdmServiceDetails): string {
  const sdd = dateTimeToIso(details.sdd);
  if (sdd) return sdd.slice(0, 10);
  return serviceDateFromGeneratedAt(details.generatedAt);
}

function firstLocationName(locations: RdmServiceLocation[] | undefined): string | null {
  return stringOrNull(locations?.[0]?.locationName);
}

function serviceCallingPoints(details: RdmServiceDetails): RdmCallingPoint[] {
  if (details.locations?.length) return details.locations;

  return [
    ...callingPointsFromGroups(details.previousCallingPoints),
    currentCallingPoint(details),
    ...callingPointsFromGroups(details.subsequentCallingPoints),
  ].filter((point): point is RdmCallingPoint => point !== null);
}

function rdmTimeToIso(value: string | undefined, serviceDate: string): string | null {
  return dateTimeToIso(value) ?? railClockTimeToIso(value, serviceDate);
}

function mapFormations(
  serviceKey: string,
  value: RdmFormation | RdmFormation[] | undefined,
  updatedAt: string,
): ServiceResponse["formations"] {
  const formations = Array.isArray(value) ? value : value ? [value] : [];

  return formations.map((formation, formationIndex) => {
    const loadingCategory = formation.serviceLoading?.loadingCategory ?? formation.loadingCategory;
    const loadingPercentage = formation.serviceLoading?.loadingPercentage ?? null;

    return {
      service_key: serviceKey,
      formation_index: formationIndex,
      tiploc: stringOrNull(formation.tiploc),
      loading_category_code: stringOrNull(loadingCategory?.code),
      loading_category_name: stringOrNull(loadingCategory?.value),
      loading_category_colour: stringOrNull(loadingCategory?.colour),
      loading_category_image: stringOrNull(loadingCategory?.image),
      loading_percentage: loadingPercentage,
      source: stringOrNull(formation.source),
      source_instance: stringOrNull(formation.sourceInstance),
      updated_at: updatedAt,
      coaches: (formation.coaches ?? []).map((coach, coachIndex) => ({
        service_key: serviceKey,
        formation_index: formationIndex,
        coach_index: coachIndex,
        tiploc: stringOrNull(formation.tiploc),
        coach_number: stringOrNull(coach.number),
        coach_class: stringOrNull(coach.coachClass),
        toilet_status: stringOrNull(coach.toiletStatus),
        toilet_value: stringOrNull(coach.toiletValue),
        loading: coach.loading ?? null,
        loading_specified: booleanToInteger(coach.loadingSpecified),
        updated_at: updatedAt,
      })),
    };
  });
}

function formationValue(value: unknown): RdmFormation | RdmFormation[] | undefined {
  if (Array.isArray(value)) return value.flatMap((item) => formation(item) ?? []);
  return formation(value);
}

function formation(value: unknown): RdmFormation | undefined {
  if (!isRecord(value)) return undefined;
  return {
    tiploc: stringValue(value.tiploc),
    loadingCategory: loadingCategory(value.loadingCategory),
    serviceLoading: serviceLoading(value.serviceLoading),
    coaches: coaches(value.coaches),
    source: stringValue(value.source),
    sourceInstance: stringValue(value.sourceInstance),
  };
}

function serviceLoading(value: unknown): RdmServiceLoading | undefined {
  if (!isRecord(value)) return undefined;
  return {
    loadingCategory: loadingCategory(value.loadingCategory),
    loadingPercentage: integerValue(value.loadingPercentage),
  };
}

function loadingCategory(value: unknown): RdmLoadingCategory | undefined {
  if (!isRecord(value)) return undefined;
  return {
    code: stringValue(value.code),
    colour: stringValue(value.colour),
    image: stringValue(value.image),
    value: stringValue(value.Value) ?? stringValue(value.value),
  };
}

function coaches(value: unknown): RdmCoach[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const toilet = isRecord(item.toilet) ? item.toilet : null;
    return [
      {
        coachClass: stringValue(item.coachClass),
        toiletStatus: toilet ? stringValue(toilet.status) : undefined,
        toiletValue: toilet ? (stringValue(toilet.Value) ?? stringValue(toilet.value)) : undefined,
        loading: integerValue(item.loading),
        loadingSpecified: booleanValue(item.loadingSpecified),
        number: stringValue(item.number),
      },
    ];
  });
}

function reasonText(value: unknown): string | undefined {
  if (isRecord(value)) {
    return stringValue(value.Value) ?? stringValue(value.value);
  }

  return stringValue(value);
}

function integerValue(value: unknown): number | undefined {
  const number = numberValue(value) ?? Number(stringValue(value));
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
}

function booleanToInteger(value: boolean | undefined): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}
