import type { ServiceResponse, StationBoardResponse } from "@zawa/domain/api";

import type { BoardType } from "./api";
import { formatDateTime, formatDelay, formatDuration, formatTime } from "./format";
import type { IconName } from "./icon-names";

type BoardRow = StationBoardResponse["rows"][number];
type Service = ServiceResponse["service"];
type ServiceStop = ServiceResponse["stops"][number];
type ServiceFormation = ServiceResponse["formations"][number];
type ServiceCoach = ServiceFormation["coaches"][number];
type ServiceMovement = ServiceResponse["movements"][number];
type StationProfile = ServiceResponse["stationProfiles"][number];
type ServiceSummary = ServiceResponse["summary"] | null;
type ServiceModeSource = { service_type?: string | null } | null | undefined;

export type ServiceStat = { label: string; value: string; icon: IconName };
export type ServiceFact = ServiceStat & { tone?: "good" | "warn" };
export type ServiceMode = "bus" | "train" | "service";
export type ServiceDisruptionNotice = {
  title: string;
  body: string;
  tone: "warn" | "bad";
};

export function serviceMode(service: ServiceModeSource): ServiceMode {
  const type = service?.service_type?.trim().toLowerCase();
  if (type === "bus") return "bus";
  if (type === "train") return "train";
  return "service";
}

export function serviceModeLabel(mode: ServiceMode): string {
  if (mode === "bus") return "Bus";
  if (mode === "train") return "Train";
  return "Service";
}

export function serviceTypeLabel(serviceType: string | null | undefined): string | null {
  return serviceType ? formatServiceType(serviceType) : null;
}

export function serviceModeNoun(mode: ServiceMode): string {
  if (mode === "bus") return "bus";
  if (mode === "train") return "train";
  return "service";
}

export function serviceModeIcon(mode: ServiceMode): IconName {
  if (mode === "bus") return "bus";
  if (mode === "train") return "train";
  return "route";
}

export function boardServiceHeadline(
  stationName: string,
  nextTrain: BoardRow,
  boardType: BoardType,
): string {
  if (boardType === "arrivals") {
    return nextTrain.origin_name ? `${nextTrain.origin_name} → ${stationName}` : stationName;
  }

  return nextTrain.destination_name
    ? `${stationName} → ${nextTrain.destination_name}`
    : stationName;
}

export function serviceHeadline(originName: string | null, destinationName: string | null): string {
  if (originName && destinationName) return `${originName} to ${destinationName}`;
  return originName ?? destinationName ?? "Service details";
}

export function serviceStats(
  summary: ServiceSummary,
  service: Service | null,
  nextTrain?: BoardRow,
): ServiceStat[] {
  const stats: ServiceStat[] = [];
  const mode = serviceMode(service);

  if (
    summary?.expected_duration_minutes !== null &&
    summary?.expected_duration_minutes !== undefined
  ) {
    stats.push({
      label: "Duration",
      value: formatDuration(summary.expected_duration_minutes),
      icon: "clock",
    });
  }

  if (summary?.calling_point_count) {
    stats.push({
      label: mode === "bus" ? "Stops" : "Calling points",
      value: String(summary.calling_point_count),
      icon: "route",
    });
  }

  const operatorCode = service?.operator_code ?? nextTrain?.operator_code ?? null;
  if (operatorCode) {
    stats.push({
      label: "Operator",
      value: operatorCode,
      icon: serviceModeIcon(mode),
    });
  }

  return stats;
}

export function serviceFacts({
  service,
  connected,
  lastUpdatedAt,
}: {
  service: Service | null;
  connected?: boolean;
  lastUpdatedAt?: string | null;
}): ServiceFact[] {
  const facts: ServiceFact[] = [];

  if (connected !== undefined) {
    facts.push({
      label: "Live updates",
      value: connected ? "Receiving updates" : "Reconnecting",
      icon: "signal",
      tone: connected ? "good" : "warn",
    });
  }

  if (service?.service_type) {
    facts.push({
      label: "Service type",
      value: formatServiceType(service.service_type),
      icon: serviceModeIcon(serviceMode(service)),
    });
  }

  if (service?.category) {
    facts.push({
      label: "Category",
      value: formatServiceType(service.category),
      icon: "route",
    });
  }

  if (service?.activities) {
    facts.push({
      label: "Activities",
      value: service.activities,
      icon: "signal",
    });
  }

  if (service?.train_run_key) {
    facts.push({
      label: "Train run",
      value: service.train_run_key,
      icon: "train",
    });
  }

  if (service?.rid) {
    facts.push({
      label: "RID",
      value: service.rid,
      icon: "signal",
    });
  }

  if (service?.uid) {
    facts.push({
      label: "UID",
      value: service.uid,
      icon: "signal",
    });
  }

  if (service?.rsid) {
    facts.push({
      label: "RSID",
      value: service.rsid,
      icon: "signal",
    });
  }

  if (service?.train_id) {
    facts.push({
      label: "Train ID",
      value: service.train_id,
      icon: "train",
    });
  }

  if (service?.service_length && service.service_length > 0) {
    facts.push({
      label: "Vehicle length",
      value: String(service.service_length),
      icon: serviceModeIcon(serviceMode(service)),
    });
  }

  const passengerService = yesNoFact(service?.is_passenger_service);
  if (passengerService) {
    facts.push({
      label: "Passenger service",
      value: passengerService,
      icon: "users",
    });
  }

  const charterService = yesNoFact(service?.is_charter);
  if (charterService) {
    facts.push({
      label: "Charter",
      value: charterService,
      icon: "star",
    });
  }

  if (lastUpdatedAt) {
    facts.push({
      label: "Updated",
      value: formatDateTime(lastUpdatedAt),
      icon: "clock",
    });
  }

  return facts;
}

export function serviceDisruptionNotice(
  service: Service | null,
  stops: ServiceStop[],
  summary: ServiceSummary,
): ServiceDisruptionNotice | null {
  if (service?.cancellation_reason) {
    const cancelled = isCancellationStatus(service.status);
    return {
      title: cancelled ? "Cancellation reason" : "Delay reason",
      body: service.cancellation_reason,
      tone: cancelled ? "bad" : "warn",
    };
  }

  const stopWithCancellation = stops.find((stop) => stop.stop_cancel_reason);
  if (stopWithCancellation?.stop_cancel_reason) {
    return {
      title: "Cancellation reason",
      body: stopReasonBody(stopWithCancellation, stopWithCancellation.stop_cancel_reason),
      tone: "bad",
    };
  }

  const stopWithDelay = stops.find((stop) => stop.stop_delay_reason);
  if (stopWithDelay?.stop_delay_reason) {
    return {
      title: "Delay reason",
      body: stopReasonBody(stopWithDelay, stopWithDelay.stop_delay_reason),
      tone: "warn",
    };
  }

  if (summary?.delay_minutes && summary.delay_minutes > 0) {
    return {
      title: "Delay",
      body: `${formatDelay(summary.delay_minutes)} delay. No reason has been supplied yet.`,
      tone: "warn",
    };
  }

  return null;
}

export function routeStopDetails(stop: ServiceStop, mode: ServiceMode = "service"): string[] {
  return [
    stop.is_pass === 1 ? "Passes" : null,
    stop.stop_cancel_reason ? `Cancelled: ${stop.stop_cancel_reason}` : null,
    stop.platform ? serviceStopPlatformDetail(stop.platform, mode) : null,
    stop.path ? `Path ${stop.path}` : null,
    stop.line ? `Line ${stop.line}` : null,
    stop.actual_arrival_ts ? `Arr ${formatTime(stop.actual_arrival_ts)} actual` : null,
    !stop.actual_arrival_ts && stop.expected_arrival_ts
      ? `Arr ${formatTime(stop.expected_arrival_ts)}`
      : null,
    stop.actual_departure_ts ? `Dep ${formatTime(stop.actual_departure_ts)} actual` : null,
    !stop.actual_departure_ts && stop.expected_departure_ts
      ? `Dep ${formatTime(stop.expected_departure_ts)}`
      : null,
    stop.arrival_source ? `Arr source ${stop.arrival_source}` : null,
    stop.departure_source ? `Dep source ${stop.departure_source}` : null,
  ].filter((part): part is string => Boolean(part));
}

export function serviceRouteStopState(stop: ServiceStop, now = new Date()): "passed" | "future" {
  if (stop.actual_departure_ts || stop.actual_arrival_ts) return "passed";

  const expected =
    stop.expected_departure_ts ??
    stop.expected_arrival_ts ??
    stop.scheduled_departure_ts ??
    stop.scheduled_arrival_ts;
  if (!expected) return "future";

  const expectedDate = new Date(expected);
  if (Number.isNaN(expectedDate.getTime())) return "future";

  return expectedDate.getTime() < now.getTime() ? "passed" : "future";
}

export function isServiceRouteStopCancelled(stop: ServiceStop): boolean {
  if (stop.stop_cancel_reason) return true;
  return (stop.stop_status ?? "").toLowerCase().includes("cancel");
}

export function formationCoachCount(formations: ServiceFormation[]): number {
  return formations.reduce((count, formation) => count + formation.coaches.length, 0);
}

export function firstFormationLoading(formations: ServiceFormation[]): string | null {
  for (const formation of formations) {
    if (formation.loading_category_name) return formation.loading_category_name;
    if (formation.loading_percentage !== null) return `${formation.loading_percentage}% loading`;
  }

  return null;
}

export function formationClassSummary(formations: ServiceFormation[]): string | null {
  const classes = Array.from(
    new Set(
      formations.flatMap((formation) =>
        formation.coaches.flatMap((coach) => (coach.coach_class ? [coach.coach_class] : [])),
      ),
    ),
  );

  return classes.join(" + ") || null;
}

export function formationCoachLabel(coach: ServiceCoach): string {
  return coach.coach_number ? `Coach ${coach.coach_number}` : `Coach ${coach.coach_index + 1}`;
}

export function formationCoachDetails(coach: ServiceCoach): string {
  return (
    [
      coach.coach_class,
      coach.loading !== null && coach.loading !== undefined ? `Loading ${coach.loading}` : null,
      coach.toilet_status ? `Toilet ${coach.toilet_status}` : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · ") || "Details not supplied"
  );
}

export function shouldShowTrainFormation(
  formations: ServiceFormation[],
  mode: ServiceMode,
): boolean {
  return mode !== "bus" && formationCoachCount(formations) > 0;
}

export function serviceRouteTiming(
  stops: ServiceResponse["stops"],
  service: Service,
): string | null {
  const first = stops[0]?.expected_departure_ts ?? stops[0]?.expected_arrival_ts;
  const last = stops.at(-1)?.expected_arrival_ts ?? stops.at(-1)?.expected_departure_ts;
  const start = first ?? service.expected_start_ts ?? service.scheduled_start_ts;
  if (!start && !last) return null;
  return [start ? `Starts ${formatTime(start)}` : null, last ? `Arrives ${formatTime(last)}` : null]
    .filter(Boolean)
    .join(" · ");
}

export function movementEvidenceDetails(movement: ServiceMovement): string[] {
  return [
    movement.stanox ? `STANOX ${movement.stanox}` : null,
    movement.platform ? `Platform ${movement.platform}` : null,
    movement.path ? `Path ${movement.path}` : null,
    movement.line ? `Line ${movement.line}` : null,
    movement.variation_status,
  ].filter((part): part is string => Boolean(part));
}

function isCancellationStatus(status: string): boolean {
  return status.toLowerCase().includes("cancel");
}

function formatServiceType(value: string): string {
  return value
    .trim()
    .replaceAll(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function yesNoFact(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value === 1 ? "Yes" : "No";
}

function serviceStopPlatformDetail(platform: string, mode: ServiceMode): string {
  if (mode === "bus") {
    return platform.toLowerCase() === "bus" ? "Bus pickup point" : `Bus stand ${platform}`;
  }

  return `Platform ${platform}`;
}

function stopReasonBody(stop: ServiceStop, reason: string): string {
  const station = stop.station_name ?? stop.station_key;
  return station ? `${station}: ${reason}` : reason;
}

export function usefulStationProfiles(profiles: StationProfile[]): StationProfile[] {
  return profiles.filter((profile) => stationProfileFacts(profile).length > 0).slice(0, 6);
}

export function stationProfileFacts(
  profile: StationProfile,
): Array<{ label: string; value: string }> {
  return [
    profile.step_free_access_coverage
      ? { label: "Step-free", value: profile.step_free_access_coverage }
      : null,
    profile.staffing_level ? { label: "Staffing", value: profile.staffing_level } : null,
    profile.ticket_office_available === 1 || profile.ticket_machine_available === 1
      ? {
          label: "Tickets",
          value: [
            profile.ticket_office_available === 1 ? "Office" : null,
            profile.ticket_machine_available === 1 ? "Machines" : null,
          ]
            .filter((part): part is string => Boolean(part))
            .join(" + "),
        }
      : null,
    profile.toilets_available === 1 ? { label: "Toilets", value: "Available" } : null,
    profile.cycle_storage_spaces
      ? { label: "Cycle spaces", value: String(profile.cycle_storage_spaces) }
      : null,
    profile.car_park_spaces ? { label: "Parking", value: String(profile.car_park_spaces) } : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
}
