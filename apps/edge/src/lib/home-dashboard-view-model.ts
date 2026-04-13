import type { DashboardResponse } from "@zawa/domain/api";
import { domSafeId } from "@zawa/shared/ids";

type DashboardService = DashboardResponse["nextServices"][number];

export type HomeLoadState = "loading" | "ready" | "error";

export type HomeEmptyState = {
  title: string;
  body: string;
};

export function filterDashboardServices(
  services: DashboardService[],
  query: string,
): DashboardService[] {
  const normalisedQuery = query.trim().toLowerCase();
  if (!normalisedQuery) return services;

  return services.filter((service) =>
    [
      service.station_key,
      service.station_name,
      service.destination_name,
      service.operator_code,
      service.platform,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalisedQuery)),
  );
}

export function homeCollectionHeadingId(title: string): string {
  return `${domSafeId(title)}-heading`;
}

export function nextDeparturesEmptyState({
  hasDashboard,
  loadState,
  query,
}: {
  hasDashboard: boolean;
  loadState: HomeLoadState;
  query: string;
}): HomeEmptyState {
  if (loadState === "error") {
    return {
      title: "Departures unavailable",
      body: "Live departures could not be loaded. Try a station board directly.",
    };
  }

  if (!hasDashboard || loadState === "loading") {
    return {
      title: "Departures are loading",
      body: "Live services will appear here once the dashboard has loaded.",
    };
  }

  if (query.trim()) {
    return {
      title: "No matching departures",
      body: "Try a different destination, station, platform, or operator.",
    };
  }

  return {
    title: "No live departures indexed yet",
    body: "Station boards will populate after rail data has been collected.",
  };
}

export function stationIndexEmptyState(loadState: HomeLoadState): HomeEmptyState {
  if (loadState === "error") {
    return {
      title: "Stations unavailable",
      body: "Station suggestions could not be loaded. Try searching by CRS code.",
    };
  }

  if (loadState === "loading") {
    return {
      title: "Stations are loading",
      body: "Search suggestions will appear once the station index has loaded.",
    };
  }

  return {
    title: "No stations indexed yet",
    body: "Search will populate after station data has been collected.",
  };
}
