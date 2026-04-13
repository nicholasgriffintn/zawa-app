import { isJsonObject } from "@zawa/shared/json";

const FAVOURITE_STATIONS_KEY = "zawa:favourite-stations";
const FAVOURITES_CHANGED_EVENT = "zawa:favourites-changed";

export interface FavouriteStation {
  key: string;
  name: string;
  displayName?: string;
  displayKey?: string;
}

export function getFavouriteStations(): FavouriteStation[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(FAVOURITE_STATIONS_KEY);
    if (!value) return [];

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isFavouriteStation);
  } catch {
    return [];
  }
}

export function saveFavouriteStation(station: FavouriteStation): void {
  const favourites = getFavouriteStations();
  const next = [station, ...favourites.filter((candidate) => candidate.key !== station.key)];
  writeFavouriteStations(next);
}

export function removeFavouriteStation(stationKey: string): void {
  writeFavouriteStations(getFavouriteStations().filter((station) => station.key !== stationKey));
}

export function isFavouriteStationKey(stationKey: string): boolean {
  return getFavouriteStations().some((station) => station.key === stationKey);
}

export function favouriteStationsChangedEventName(): string {
  return FAVOURITES_CHANGED_EVENT;
}

export function quickLinksFromFavourites(): FavouriteStation[] {
  return getFavouriteStations();
}

function writeFavouriteStations(stations: FavouriteStation[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(FAVOURITE_STATIONS_KEY, JSON.stringify(stations));
    window.dispatchEvent(new CustomEvent(FAVOURITES_CHANGED_EVENT));
  } catch {
    // Storage can be disabled or quota-limited; keep the UI usable without persistence.
  }
}

function isFavouriteStation(value: unknown): value is FavouriteStation {
  if (!isJsonObject(value)) return false;

  const candidate = value;
  return (
    typeof candidate.key === "string" &&
    candidate.key.trim().length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    (candidate.displayName === undefined || typeof candidate.displayName === "string") &&
    (candidate.displayKey === undefined || typeof candidate.displayKey === "string")
  );
}
