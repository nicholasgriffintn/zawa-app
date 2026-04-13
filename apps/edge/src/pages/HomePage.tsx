import { useEffect, useState } from "react";

import type { DashboardResponse, StationListResponse } from "@zawa/domain/api";

import { AppShell } from "../components/AppShell";
import { HomeDashboard } from "../components/HomeDashboard";
import { getDashboard, getStations } from "../lib/api";

export function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [stationSuggestions, setStationSuggestions] = useState<StationListResponse["stations"]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all([getDashboard(), getStations("")])
      .then(([dashboardData, stationData]) => {
        if (cancelled) return;
        setDashboard(dashboardData);
        setStationSuggestions(stationData.stations.slice(0, 12));
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setDashboard(null);
        setStationSuggestions([]);
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell connected={!!dashboard} lastUpdatedAt={dashboard?.metrics.last_updated_at ?? null}>
      <HomeDashboard
        dashboard={dashboard}
        stationSuggestions={stationSuggestions}
        loadState={loadState}
      />
    </AppShell>
  );
}
