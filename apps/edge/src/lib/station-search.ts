import type { StationListResponse } from "@zawa/domain/api";

import type { FavouriteStation } from "./favourites";
import type { BoardType } from "./api";
import { normaliseStationInput, resolveStationCodeInput } from "./stations";

type StationSuggestion = StationListResponse["stations"][number];
type StationSearchResult = Pick<StationSuggestion, "station_key" | "station_name">;
export type StationLookupResult = StationSearchResult & {
  last_updated_at?: string | null;
  next_scheduled_ts?: string | null;
  service_count?: number;
};

export function stationBoardHref(stationKey: string, boardType: BoardType = "departures"): string {
  const path = `/stations/${encodeURIComponent(stationKey)}`;
  return boardType === "arrivals" ? `${path}?board=arrivals` : path;
}

export function resolveStationSearchTarget({
  query,
  favourites,
  results,
  initialStations = [],
}: {
  query: string;
  favourites: FavouriteStation[];
  results: StationSearchResult[];
  initialStations?: StationSearchResult[];
}): string | null {
  const normalised = normaliseStationInput(query);
  if (!normalised) return null;

  const favourite = favourites.find((station) =>
    [station.key, station.name, station.displayName, station.displayKey]
      .filter((value): value is string => Boolean(value))
      .some((value) => normaliseStationInput(value) === normalised),
  );
  if (favourite) return favourite.key;

  const station = [...results, ...initialStations].find((candidate) =>
    [candidate.station_key, candidate.station_name]
      .filter((value): value is string => Boolean(value))
      .some((value) => normaliseStationInput(value) === normalised),
  );
  if (station) return station.station_key;

  return resolveStationCodeInput(query);
}

export function mergeStationSuggestions(
  favourites: FavouriteStation[],
  results: StationSuggestion[],
  initialStations: StationSuggestion[],
  query = "",
): StationSuggestion[] {
  const stations = new Map<string, StationSuggestion>();
  const normalisedQuery = normaliseStationInput(query);

  for (const favourite of favourites) {
    if (
      normalisedQuery &&
      !matchesStationSearchQuery(
        [favourite.key, favourite.name, favourite.displayName, favourite.displayKey],
        normalisedQuery,
      )
    ) {
      continue;
    }

    stations.set(favourite.key, {
      station_key: favourite.key,
      station_name: favourite.displayName ?? favourite.name,
      service_count: 0,
      next_scheduled_ts: null,
      last_updated_at: null,
    });
  }

  for (const station of [...results, ...initialStations]) {
    if (
      normalisedQuery &&
      !matchesStationSearchQuery([station.station_key, station.station_name], normalisedQuery)
    ) {
      continue;
    }

    if (!stations.has(station.station_key)) stations.set(station.station_key, station);
  }

  const codeSuggestion = stationCodeSummarySuggestion(query);
  if (codeSuggestion && !stations.has(codeSuggestion.station_key)) {
    stations.set(codeSuggestion.station_key, codeSuggestion);
  }

  return [...stations.values()];
}

function matchesStationSearchQuery(
  values: Array<string | null | undefined>,
  normalisedQuery: string,
): boolean {
  return values
    .filter((value): value is string => Boolean(value))
    .some((value) => normaliseStationInput(value).includes(normalisedQuery));
}

export function mergeStationLookupResults(
  query: string,
  results: StationLookupResult[],
): StationLookupResult[] {
  const stations = new Map<string, StationLookupResult>();

  for (const station of results) {
    stations.set(station.station_key, station);
  }

  const codeSuggestion = stationCodeLookupResult(query);
  if (codeSuggestion && !stations.has(codeSuggestion.station_key)) {
    stations.set(codeSuggestion.station_key, codeSuggestion);
  }

  return [...stations.values()];
}

function stationCodeLookupResult(query: string): StationLookupResult | null {
  const stationKey = resolveStationCodeInput(query);
  if (!stationKey) return null;

  return {
    station_key: stationKey,
    station_name: null,
    last_updated_at: null,
  };
}

function stationCodeSummarySuggestion(query: string): StationSuggestion | null {
  const stationKey = resolveStationCodeInput(query);
  if (!stationKey) return null;

  return {
    station_key: stationKey,
    station_name: null,
    service_count: 0,
    next_scheduled_ts: null,
    last_updated_at: null,
  };
}
