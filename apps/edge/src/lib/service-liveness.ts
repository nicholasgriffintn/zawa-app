import type { ServiceResponse } from "@zawa/domain/api";

import { liveServiceSince } from "./board-window";

export function shouldFetchLiveService(snapshot: ServiceResponse, nowIso: string): boolean {
  const latest = latestServiceTime(snapshot);
  if (!latest) return snapshot.service.updated_at >= liveServiceSince(nowIso);
  return latest >= liveServiceSince(nowIso);
}

function latestServiceTime(snapshot: ServiceResponse): string | null {
  const values = [
    snapshot.service.expected_start_ts,
    snapshot.service.scheduled_start_ts,
    ...snapshot.stops.flatMap((stop) => [
      stop.expected_arrival_ts,
      stop.expected_departure_ts,
      stop.scheduled_arrival_ts,
      stop.scheduled_departure_ts,
    ]),
  ].filter((value): value is string => Boolean(value));

  return values.reduce<string | null>((latest, value) => {
    if (!latest || value > latest) return value;
    return latest;
  }, null);
}
