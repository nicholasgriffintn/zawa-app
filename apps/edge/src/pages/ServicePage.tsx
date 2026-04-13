import { AppShell } from "../components/AppShell";
import { DetailState } from "../components/DetailState";
import { FullServiceDetail, ServiceDetailSidebar } from "../components/ServiceDetails";
import { Icon } from "../components/Icon";
import { OntologySummary } from "../components/OntologySummary";
import { ServicePageLoading } from "../components/ServicePageLoading";
import { useServiceDetails } from "../hooks/useServiceDetails";

import "../components/DetailPanel.scss";
import "../components/PanelSurface.scss";
import "./ServicePage.scss";

export function ServicePage({ serviceKey }: { serviceKey: string }) {
  const {
    service,
    stops,
    summary,
    formations,
    movements,
    incidents,
    stationProfiles,
    ontology,
    loading,
    error,
    connected,
    lastUpdatedAt,
  } = useServiceDetails(serviceKey);

  if (loading) {
    return (
      <AppShell>
        <ServicePageLoading />
      </AppShell>
    );
  }

  if (error || !service) {
    return (
      <AppShell>
        <main className="single-panel service-state-panel">
          <DetailState
            icon="alert-circle"
            title="We could not load this service"
            body={error ?? "This service may have finished or changed identifier."}
          />
          <a className="primary-link" href="/">
            Open another station
            <Icon name="chevron-right" />
          </a>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell connected={connected} lastUpdatedAt={lastUpdatedAt}>
      <main className="service-grid service-page-grid">
        <section className="board-panel service-page-main">
          <FullServiceDetail
            service={service}
            stops={stops}
            summary={summary}
            formations={formations}
            movements={movements}
            stationProfiles={stationProfiles}
          />
        </section>
        <aside className="detail-panel service-page-actions">
          <div className="detail-topline">
            <a href="/">
              <Icon name="arrow-left" />
              Back to stations
            </a>
            <span>Service details</span>
          </div>
          <ServiceDetailSidebar
            service={service}
            summary={summary}
            formations={formations}
            incidents={incidents}
            connected={connected}
            lastUpdatedAt={lastUpdatedAt}
          />
          <OntologySummary graph={ontology} title="Service graph" compact />
        </aside>
      </main>
    </AppShell>
  );
}
