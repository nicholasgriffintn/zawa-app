import type { ServiceResponse } from "@zawa/domain/api";
import { minutesBetweenIso } from "@zawa/shared/time";
import { nonNegativeOrNull, stringOrNull } from "@zawa/shared/values";

type Service = ServiceResponse["service"];
type Stop = ServiceResponse["stops"][number];
type Summary = ServiceResponse["summary"];

export function buildServiceSummary(service: Service, stops: Stop[]): Summary {
  const scheduledStart =
    firstKnownTime(stops, "scheduled_departure_ts", "scheduled_arrival_ts") ??
    service.scheduled_start_ts;
  const scheduledEnd = lastKnownTime(stops, "scheduled_arrival_ts", "scheduled_departure_ts");
  const expectedStart =
    firstKnownTime(stops, "expected_departure_ts", "expected_arrival_ts") ??
    service.expected_start_ts;
  const expectedEnd = lastKnownTime(stops, "expected_arrival_ts", "expected_departure_ts");

  return {
    calling_point_count: stops.length,
    scheduled_duration_minutes: nonNegativeOrNull(minutesBetweenIso(scheduledStart, scheduledEnd)),
    expected_duration_minutes: nonNegativeOrNull(minutesBetweenIso(expectedStart, expectedEnd)),
    delay_minutes:
      service.delay_minutes ??
      minutesBetweenIso(service.scheduled_start_ts, service.expected_start_ts),
  };
}

function firstKnownTime(
  stopRows: Stop[],
  preferred: keyof Stop,
  secondary: keyof Stop,
): string | null {
  for (const stop of stopRows) {
    const value = stringOrNull(stop[preferred]) ?? stringOrNull(stop[secondary]);
    if (value) return value;
  }

  return null;
}

function lastKnownTime(
  stopRows: Stop[],
  preferred: keyof Stop,
  secondary: keyof Stop,
): string | null {
  for (const stop of [...stopRows].reverse()) {
    const value = stringOrNull(stop[preferred]) ?? stringOrNull(stop[secondary]);
    if (value) return value;
  }

  return null;
}
