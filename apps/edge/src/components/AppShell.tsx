import type { ReactNode } from "react";

import { formatDateTime } from "../lib/format";
import { StationSearch } from "./StationSearch";

import "./AppShell.scss";

export function AppShell({
  children,
  activeStationKey,
  connected,
  lastUpdatedAt,
}: {
  children: ReactNode;
  activeStationKey?: string;
  connected?: boolean;
  lastUpdatedAt?: string | null;
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Zawa home">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <strong>Zawa</strong>
            <small>Live station boards</small>
          </span>
        </a>
        <StationSearch activeStationKey={activeStationKey} />
        <div className="topbar-status">
          <div className={connected ? "live-dot connected" : "live-dot"}>
            <span aria-hidden="true" />
            <strong>{connected ? "Live" : "Checking"}</strong>
            <small>{connected ? "Receiving updates" : "Connecting to updates"}</small>
          </div>
          <div className="topbar-updated">
            <small>Last updated</small>
            <strong>{formatDateTime(lastUpdatedAt)}</strong>
          </div>
          <div className="signal-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </header>
      {children}
      <footer className="app-footer">
        <a href="https://raildata.org.uk" target="_blank" rel="noopener noreferrer">
          <img src="/NRE_Powered_logo.png" alt="Powered by National Rail Enquiries" />
        </a>
      </footer>
    </div>
  );
}
