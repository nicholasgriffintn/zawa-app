import { decodePathSegment } from "@zawa/shared/http";

const STATION_KEY_PATTERN = /^[A-Z0-9]{2,5}$/;

export function normaliseStationKey(value: string | null | undefined): string | null {
  const stationKey = value?.trim().toUpperCase();
  return stationKey && STATION_KEY_PATTERN.test(stationKey) ? stationKey : null;
}

export function decodeStationPathKey(value: string): string | null {
  return normaliseStationKey(decodePathSegment(value));
}
