import type { StationBoardResponse } from "@zawa/domain/api";

import { useFavouriteStations } from "../hooks/useFavouriteStations";
import type { BoardType } from "../lib/api";
import { formatBoardStatus, formatDateTime, formatTime } from "../lib/format";
import {
  stationBoardStatusSummary,
  stationDisruptionSummary,
  stationLocationLabel,
  stationNextServiceSummary,
  stationOverviewFacts,
} from "../lib/station-overview";
import { stationTravelAlerts } from "../lib/travel-alerts";
import { Icon } from "./Icon";
import { TravelAlertButton } from "./TravelAlerts";

import "./StationOverviewPanel.scss";

type BoardRow = StationBoardResponse["rows"][number];

export function StationOverviewPanel({
  stationKey,
  stationName,
  stationDisplayKey,
  boardType,
  rows,
  connected,
  lastUpdatedAt,
  nextTrain,
  notices,
  incidents,
  profile,
  onBoardTypeChange,
}: {
  stationKey: string;
  stationName: string;
  stationDisplayKey: string;
  boardType: BoardType;
  rows: StationBoardResponse["rows"];
  connected: boolean;
  lastUpdatedAt: string | null;
  nextTrain: BoardRow | undefined;
  notices: StationBoardResponse["notices"];
  incidents: StationBoardResponse["incidents"];
  profile: StationBoardResponse["profile"];
  onBoardTypeChange: (boardType: BoardType) => void;
}) {
  const visibleServices = rows.length;
  const { isFavourite, remove, save } = useFavouriteStations();
  const stationIsFavourite = isFavourite(stationKey);
  const nextMovementLabel = boardType === "arrivals" ? "Next arrival" : "Next departure";
  const nextPlaceName =
    boardType === "arrivals"
      ? (nextTrain?.origin_name ?? nextTrain?.destination_name)
      : nextTrain?.destination_name;
  const nextServiceSummaryText = nextTrain ? stationNextServiceSummary(nextTrain) : null;
  const nextTrainStatus = nextTrain
    ? formatBoardStatus({
        expected: nextTrain.expected_ts,
        scheduled: nextTrain.scheduled_ts,
        status: nextTrain.status,
      })
    : null;
  const liveStatusSummary = stationBoardStatusSummary(rows);
  const stationAlerts = stationTravelAlerts({ notices, incidents });
  const disruptionSummary = stationDisruptionSummary(rows, stationAlerts.length);
  const stationFacts = stationOverviewFacts(profile);
  const stationLocation = stationLocationLabel(profile);

  return (
    <aside className="side-panel">
      <p className="section-label">Current overview</p>
      <div className="station-overview-heading">
        <h1>
          {stationName} <span>({stationDisplayKey})</span>
        </h1>
        <button
          className={stationIsFavourite ? "save-station-button saved" : "save-station-button"}
          type="button"
          aria-label={
            stationIsFavourite ? `Remove ${stationName} from favourites` : `Save ${stationName}`
          }
          onClick={() => {
            if (stationIsFavourite) {
              remove(stationKey);
              return;
            }

            save({
              key: stationKey,
              name: stationName,
              displayName: stationName,
              displayKey: stationDisplayKey,
            });
          }}
        >
          <Icon name="star" />
          <span>{stationIsFavourite ? "Saved" : "Save"}</span>
        </button>
      </div>
      <p className="muted">{stationLocation}</p>
      {stationFacts.length ? (
        <dl className="station-overview-facts" aria-label="Station facilities">
          {stationFacts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="segmented-control" aria-label="Board type">
        <button
          className={boardType === "departures" ? "active" : ""}
          type="button"
          aria-pressed={boardType === "departures"}
          onClick={() => onBoardTypeChange("departures")}
        >
          Departures
        </button>
        <button
          className={boardType === "arrivals" ? "active" : ""}
          type="button"
          aria-pressed={boardType === "arrivals"}
          onClick={() => onBoardTypeChange("arrivals")}
        >
          Arrivals
        </button>
      </div>
      <div className="overview-section">
        <p className="overview-title">Board health</p>
        <div className="health-row">
          <span className={connected ? "health-icon good" : "health-icon warn"} aria-hidden="true">
            <Icon name={connected ? "check" : "alert"} />
          </span>
          <div>
            <strong>{connected ? "Live updates connected" : "Reconnecting to live updates"}</strong>
            <span>
              {connected
                ? "Times and platforms will update automatically"
                : "The current board remains visible while we reconnect"}
            </span>
          </div>
        </div>
      </div>
      <dl className="metric-list board-metrics">
        <div className="metric-large">
          <dt>Visible services</dt>
          <dd>{visibleServices}</dd>
          <small>{boardType}</small>
        </div>
        <div>
          <dt>{nextMovementLabel}</dt>
          <dd>
            <strong>{formatTime(nextTrain?.expected_ts ?? nextTrain?.scheduled_ts)}</strong>
            {nextPlaceName ? <span>{nextPlaceName}</span> : null}
          </dd>
          {nextServiceSummaryText ? <small>{nextServiceSummaryText}</small> : null}
        </div>
      </dl>
      <div className="overview-section">
        <p className="overview-title">Disruptions</p>
        <div className="health-row">
          <span className={`health-icon ${disruptionSummary.tone}`} aria-hidden="true">
            <Icon name={disruptionSummary.tone === "good" ? "check" : "alert"} />
          </span>
          <div>
            <strong>{disruptionSummary.title}</strong>
            <span>{disruptionSummary.description}</span>
          </div>
        </div>
        <TravelAlertButton alerts={stationAlerts} label="Station alerts" />
      </div>
      <div className="line-summary">
        <p className="overview-title">Live status summary</p>
        {liveStatusSummary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong className={`signal ${item.tone}`}>{item.value}</strong>
          </div>
        ))}
      </div>
      <p className="panel-timestamp">
        Last update <strong>{formatDateTime(lastUpdatedAt)}</strong>
        {nextTrainStatus ? <span>{nextTrainStatus}</span> : null}
      </p>
    </aside>
  );
}
