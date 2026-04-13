import { useMemo, useState } from "react";

import type { DashboardResponse, StationListResponse } from "@zawa/domain/api";

import { useFavouriteStations } from "../hooks/useFavouriteStations";
import { boardStatusTone, formatBoardStatus, formatTime } from "../lib/format";
import {
  filterDashboardServices,
  homeCollectionHeadingId,
  nextDeparturesEmptyState,
  stationIndexEmptyState,
  type HomeLoadState,
} from "../lib/home-dashboard-view-model";
import { dashboardTravelAlerts } from "../lib/travel-alerts";
import { HomeStationSearch } from "./HomeStationSearch";
import { MetricCard, MetricGrid } from "./MetricGrid";
import { OntologySummary } from "./OntologySummary";
import { PageLayout } from "./PageLayout";
import { StatusBadge } from "./StatusBadge";
import { SurfacePanel } from "./SurfacePanel";
import { TravelAlertCards } from "./TravelAlerts";

import "./HomeDashboard.scss";

type Dashboard = DashboardResponse;
type StationSuggestion = StationListResponse["stations"][number];
type DashboardService = DashboardResponse["nextServices"][number];

export function HomeDashboard({
  dashboard,
  stationSuggestions,
  loadState,
}: {
  dashboard: Dashboard | null;
  stationSuggestions: StationSuggestion[];
  loadState: HomeLoadState;
}) {
  const { favourites } = useFavouriteStations();
  const popularStations =
    dashboard?.popularStations.filter((station) => station.service_count > 0) ?? [];
  const stationSearchSuggestions = popularStations.length ? popularStations : stationSuggestions;

  return (
    <PageLayout>
      <HomeStationSearch favourites={favourites} initialStations={stationSearchSuggestions} />

      <MetricGrid label="Rail summary">
        <MetricCard
          label="Live services"
          value={(dashboard?.metrics.visible_service_count ?? 0).toLocaleString("en-GB")}
          detail="shown on station boards"
        />
        <MetricCard
          label="Delayed"
          value={(dashboard?.metrics.delayed_service_count ?? 0).toLocaleString("en-GB")}
          detail="currently visible"
          tone={(dashboard?.metrics.delayed_service_count ?? 0) > 0 ? "warn" : "good"}
        />
        <MetricCard
          label="Travel alerts"
          value={(dashboard?.metrics.active_incident_count ?? 0).toLocaleString("en-GB")}
          detail="active now"
          tone={(dashboard?.metrics.active_incident_count ?? 0) > 0 ? "warn" : "good"}
        />
        <MetricCard
          label="Stations"
          value={(dashboard?.metrics.station_count ?? 0).toLocaleString("en-GB")}
          detail="available to search"
        />
      </MetricGrid>

      <section className="home-main-grid">
        <NextDeparturesPanel dashboard={dashboard} loadState={loadState} />
        <TravelAlertsPanel dashboard={dashboard} loadState={loadState} />
      </section>

      <section className="home-station-grid">
        <StationCollection
          title="Saved stations"
          label="Quick access"
          emptyState={{
            title: "No saved stations",
            body: "Saved stations will appear here after you add them from a station board.",
          }}
          stations={favourites.map((station) => ({
            station_key: station.key,
            station_name: station.displayName ?? station.name,
            service_count: 0,
            next_scheduled_ts: null,
            last_updated_at: null,
          }))}
        />
        <StationCollection
          title={popularStations.length ? "Busy stations" : "Station index"}
          label={popularStations.length ? "Active now" : "Browse"}
          emptyState={stationIndexEmptyState(loadState)}
          stations={(popularStations.length ? popularStations : stationSuggestions).slice(0, 8)}
          showServiceCounts
        />
      </section>

      <OntologySummary
        graph={dashboard?.ontology}
        title="Dashboard graph"
        eyebrow="Ontology"
        compact
      />
    </PageLayout>
  );
}

function NextDeparturesPanel({
  dashboard,
  loadState,
}: {
  dashboard: Dashboard | null;
  loadState: HomeLoadState;
}) {
  const [serviceQuery, setServiceQuery] = useState("");
  const filteredServices = useMemo(() => {
    if (!dashboard) return [];

    return filterDashboardServices(dashboard.nextServices, serviceQuery);
  }, [dashboard, serviceQuery]);
  const emptyState = nextDeparturesEmptyState({
    hasDashboard: Boolean(dashboard),
    loadState,
    query: serviceQuery,
  });

  return (
    <SurfacePanel aria-labelledby="home-departures-heading">
      <div className="home-panel-heading">
        <div>
          <p className="section-label">Leaving soon</p>
          <h2 id="home-departures-heading">Next departures</h2>
        </div>
        <label className="home-service-filter">
          <span>Find within list</span>
          <input
            type="search"
            value={serviceQuery}
            onChange={(event) => setServiceQuery(event.currentTarget.value)}
            placeholder="Destination, station, platform..."
          />
        </label>
      </div>

      {filteredServices.length ? (
        <div className="home-service-list">
          {filteredServices.slice(0, 10).map((service) => (
            <ServiceRow key={`${service.station_key}:${service.service_key}`} service={service} />
          ))}
        </div>
      ) : (
        <EmptyState title={emptyState.title} body={emptyState.body} />
      )}
    </SurfacePanel>
  );
}

function ServiceRow({ service }: { service: DashboardService }) {
  const tone = boardStatusTone({
    expected: service.expected_ts,
    scheduled: service.scheduled_ts,
    status: service.status,
  });
  const status = formatBoardStatus({
    expected: service.expected_ts,
    scheduled: service.scheduled_ts,
    status: service.status,
  });

  return (
    <a className="home-service-row" href={`/services/${encodeURIComponent(service.service_key)}`}>
      <time>{formatTime(service.expected_ts ?? service.scheduled_ts)}</time>
      <div>
        <strong>{service.destination_name ?? service.operator_code ?? "Service"}</strong>
        <span>
          {service.station_name ?? service.station_key}
          {service.platform ? ` · Platform ${service.platform}` : ""}
        </span>
      </div>
      <StatusBadge label={status} status={service.status} tone={tone} />
    </a>
  );
}

function TravelAlertsPanel({
  dashboard,
  loadState,
}: {
  dashboard: Dashboard | null;
  loadState: HomeLoadState;
}) {
  const alerts = dashboardTravelAlerts(dashboard?.incidents ?? []).slice(0, 5);

  return (
    <SurfacePanel aria-labelledby="home-alerts-heading">
      <div className="home-panel-heading">
        <div>
          <p className="section-label">Today</p>
          <h2 id="home-alerts-heading">Travel alerts</h2>
        </div>
      </div>

      {alerts.length ? (
        <TravelAlertCards alerts={alerts} />
      ) : (
        <EmptyState
          title={loadState === "error" ? "Alerts unavailable" : "No current travel alerts"}
          body="Active disruption notices will appear here."
        />
      )}
    </SurfacePanel>
  );
}

function StationCollection({
  title,
  label,
  emptyState,
  stations,
  showServiceCounts = false,
}: {
  title: string;
  label: string;
  emptyState: { title: string; body: string };
  stations: StationSuggestion[];
  showServiceCounts?: boolean;
}) {
  const headingId = homeCollectionHeadingId(title);

  return (
    <SurfacePanel aria-labelledby={headingId}>
      <div className="home-panel-heading">
        <div>
          <p className="section-label">{label}</p>
          <h2 id={headingId}>{title}</h2>
        </div>
      </div>

      {stations.length ? (
        <div className="home-station-list">
          {stations.map((station) => (
            <StationCard
              key={station.station_key}
              station={station}
              showServiceCounts={showServiceCounts}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={emptyState.title} body={emptyState.body} />
      )}
    </SurfacePanel>
  );
}

function StationCard({
  station,
  showServiceCounts,
}: {
  station: StationSuggestion;
  showServiceCounts: boolean;
}) {
  return (
    <a className="home-station-card" href={`/stations/${station.station_key}`}>
      <strong>{station.station_key}</strong>
      <span>{station.station_name ?? station.station_key}</span>
      {showServiceCounts && station.service_count ? (
        <small>
          {station.service_count} visible {station.service_count === 1 ? "service" : "services"}
        </small>
      ) : null}
    </a>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="home-empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
