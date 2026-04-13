import type { StationListResponse } from "@zawa/domain/api";
import { isRecord, stringValue } from "@zawa/shared/values";

import { fetchRdmJson } from "./rdm-http";

export interface RdmReferenceEnv {
  RDM_REFERENCE_STATION_LIST_URL: string;
  RDM_REFERENCE_DATA_API_KEY: string;
}

interface CachedStations {
  expiresAt: number;
  stations: StationListResponse["stations"];
}

let stationCache: CachedStations | null = null;
const STATION_CACHE_MS = 15 * 60 * 1_000;

export async function searchRdmStations(
  env: RdmReferenceEnv,
  query: string,
  limit: number,
): Promise<StationListResponse["stations"]> {
  const stations = await getRdmStations(env);
  const normalised = query.trim().toUpperCase();
  if (!normalised) return stations.slice(0, limit);

  return stations
    .filter((station) => {
      return (
        station.station_key.includes(normalised) ||
        station.station_name?.toUpperCase().includes(normalised)
      );
    })
    .slice(0, limit);
}

async function getRdmStations(env: RdmReferenceEnv): Promise<StationListResponse["stations"]> {
  if (stationCache && stationCache.expiresAt > Date.now()) return stationCache.stations;

  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_REFERENCE_DATA_API_KEY,
    template: env.RDM_REFERENCE_STATION_LIST_URL,
    path: { currentVersion: "1" },
  });
  const stations = parseStationList(data);
  stationCache = { stations, expiresAt: Date.now() + STATION_CACHE_MS };
  return stations;
}

function parseStationList(value: unknown): StationListResponse["stations"] {
  const record = isRecord(value) ? value : null;
  const stationList = record?.StationList;
  if (!Array.isArray(stationList)) throw new Error("Invalid RDM station list response");

  return stationList.flatMap((station) => {
    const item = isRecord(station) ? station : null;
    const stationKey = stringValue(item?.crs);
    if (!stationKey) return [];
    return [
      {
        station_key: stationKey.toUpperCase(),
        station_name: stringValue(item?.Value) ?? null,
        service_count: 0,
        next_scheduled_ts: null,
        last_updated_at: null,
      },
    ];
  });
}
