import { Icon } from "./Icon";

import "./DetailPanel.scss";
import "./PanelSurface.scss";
import "./ServicePageLoading.scss";

export function ServicePageLoading() {
  return (
    <main className="service-grid service-page-grid service-loading-page" aria-busy="true">
      <section className="board-panel service-page-main">
        <section className="service-page-hero service-loading-hero">
          <div className="service-loading-tags" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="service-page-heading">
            <div>
              <p className="section-label">Service</p>
              <h1>Loading service details</h1>
              <p className="muted">Fetching the route, live status, and formation.</p>
            </div>
          </div>
          <dl className="service-stat-grid service-loading-stats" aria-hidden="true">
            <div>
              <dt>Duration</dt>
              <dd />
            </div>
            <div>
              <dt>Calling points</dt>
              <dd />
            </div>
            <div>
              <dt>Operator</dt>
              <dd />
            </div>
            <div>
              <dt>Coaches</dt>
              <dd />
            </div>
          </dl>
        </section>

        <section className="service-page-section service-loading-route">
          <p className="overview-title">Service route</p>
          <ol aria-hidden="true">
            {["", "", "", "", ""].map((_, index) => (
              <li key={index}>
                <span />
                <div>
                  <i />
                  <b />
                </div>
              </li>
            ))}
          </ol>
        </section>
      </section>

      <aside className="detail-panel service-page-actions">
        <div className="detail-topline">
          <a href="/">
            <Icon name="arrow-left" />
            Back to stations
          </a>
          <span>Service details</span>
        </div>
        <div className="service-loading-sidebar">
          <section>
            <p className="overview-title">Current status</p>
            <strong>Loading</strong>
            <span>Checking live service data</span>
          </section>
          <div aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </aside>
    </main>
  );
}
