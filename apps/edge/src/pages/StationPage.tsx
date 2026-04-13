import { useEffect, useState } from "react";

import { AppShell } from "../components/AppShell";
import { Icon } from "../components/Icon";
import { OntologySummary } from "../components/OntologySummary";
import { StationBoard } from "../components/StationBoard";
import { StationOverviewPanel } from "../components/StationOverviewPanel";
import { StationServiceDetailPanel } from "../components/StationServiceDetailPanel";
import { type BoardType } from "../lib/api";
import { boardStatusTone, formatBoardStatus } from "../lib/format";
import { useServiceDetails } from "../hooks/useServiceDetails";
import { useStationBoard } from "../hooks/useStationBoard";

import "../components/PanelSurface.scss";
import "./StationPage.scss";

export function StationPage({ stationKey }: { stationKey: string }) {
  const [boardType, setBoardType] = useState<BoardType>(() => initialBoardType());
  const [selectedServiceKey, setSelectedServiceKey] = useState<string | null>(null);
  const {
    stationName: projectedStationName,
    notices,
    incidents,
    ontology,
    profile,
    rows,
    loading,
    error,
    connected,
    lastUpdatedAt,
    hasEarlierRows,
    loadingEarlier,
    loadEarlier,
    hasLaterRows,
    loadingLater,
    loadLater,
  } = useStationBoard(stationKey, boardType);
  const stationName = projectedStationName;
  const stationDisplayKey = stationKey;
  const nextTrain = rows[0];
  const selectedTrain = rows.find((row) => row.service_key === selectedServiceKey);
  const selectedService = useServiceDetails(selectedTrain?.service_key);
  const boardStatus = selectedTrain
    ? formatBoardStatus({
        expected: selectedTrain.expected_ts,
        scheduled: selectedTrain.scheduled_ts,
        status: selectedTrain.status,
      })
    : null;
  const boardTone = selectedTrain
    ? boardStatusTone({
        expected: selectedTrain.expected_ts,
        scheduled: selectedTrain.scheduled_ts,
        status: selectedTrain.status,
      })
    : "neutral";

  useEffect(() => {
    setSelectedServiceKey(null);
  }, [boardType, stationKey]);

  const handleBoardTypeChange = (nextBoardType: BoardType) => {
    setBoardType(nextBoardType);
    const url = new URL(window.location.href);
    if (nextBoardType === "arrivals") {
      url.searchParams.set("board", "arrivals");
    } else {
      url.searchParams.delete("board");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <AppShell activeStationKey={stationKey} connected={connected} lastUpdatedAt={lastUpdatedAt}>
      <main className={selectedTrain ? "dashboard-grid has-detail" : "dashboard-grid board-only"}>
        <StationOverviewPanel
          stationKey={stationKey}
          stationName={stationName ?? stationKey}
          stationDisplayKey={stationDisplayKey}
          boardType={boardType}
          rows={rows}
          connected={connected}
          lastUpdatedAt={lastUpdatedAt}
          nextTrain={nextTrain}
          notices={notices}
          incidents={incidents}
          profile={profile}
          onBoardTypeChange={handleBoardTypeChange}
        />

        <section id="station-board" className="board-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {(stationName ?? stationKey).toUpperCase()} ({stationDisplayKey}){" "}
                {boardType.toUpperCase()}
              </h2>
            </div>
          </div>
          <StationBoard
            rows={rows}
            boardType={boardType}
            loading={loading}
            selectedServiceKey={selectedServiceKey}
            hasEarlierRows={hasEarlierRows}
            loadingEarlier={loadingEarlier}
            onLoadEarlier={loadEarlier}
            hasLaterRows={hasLaterRows}
            loadingLater={loadingLater}
            onLoadLater={loadLater}
            onSelectService={(row) => setSelectedServiceKey(row.service_key)}
          />
          {!loading && !error && rows.length === 0 ? (
            <div className="lower-state-grid single">
              <div className="state-card">
                <p className="section-label">No services shown</p>
                <div className="state-icon">
                  <Icon name="train" />
                </div>
                <strong>No {boardType} are available for this station right now</strong>
                <span>Try the other board, search for another station, or check back shortly.</span>
              </div>
            </div>
          ) : null}
          {error ? (
            <div className="lower-state-grid single">
              <div className="state-card error-card">
                <p className="section-label">Connection status</p>
                <div className="state-icon">
                  <Icon name="wifi-off" />
                </div>
                <strong>We could not load this board</strong>
                <span>{error}</span>
              </div>
            </div>
          ) : null}
          <OntologySummary
            graph={ontology}
            title={`${stationDisplayKey} graph`}
            eyebrow="Ontology"
            compact
          />
        </section>

        {selectedTrain ? (
          <StationServiceDetailPanel
            stationName={stationName ?? stationKey}
            nextTrain={selectedTrain}
            boardStatus={boardStatus}
            boardTone={boardTone}
            boardType={boardType}
            nextService={selectedService}
            onClose={() => setSelectedServiceKey(null)}
          />
        ) : null}
      </main>
    </AppShell>
  );
}

function initialBoardType(): BoardType {
  return new URLSearchParams(window.location.search).get("board") === "arrivals"
    ? "arrivals"
    : "departures";
}
