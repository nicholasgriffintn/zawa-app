import type { StationBoardResponse } from "@zawa/domain/api";

import { formatTime } from "../lib/format";
import { stationBoardRowView } from "../lib/station-board-view-model";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";

import "./StationBoard.scss";

export function StationBoard({
  rows,
  boardType,
  loading,
  selectedServiceKey,
  hasEarlierRows,
  loadingEarlier,
  onLoadEarlier,
  hasLaterRows,
  loadingLater,
  onLoadLater,
  onSelectService,
}: {
  rows: StationBoardResponse["rows"];
  boardType: StationBoardResponse["boardType"];
  loading?: boolean;
  selectedServiceKey?: string | null;
  hasEarlierRows?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
  hasLaterRows?: boolean;
  loadingLater?: boolean;
  onLoadLater?: () => void;
  onSelectService?: (row: StationBoardResponse["rows"][number]) => void;
}) {
  const boardLabel = boardType === "arrivals" ? "arrivals" : "departures";
  const placeColumnLabel = boardType === "arrivals" ? "Origin" : "Destination";

  return (
    <div className="board-frame">
      {hasEarlierRows ? (
        <button
          className="load-later"
          type="button"
          onClick={onLoadEarlier}
          disabled={loadingEarlier}
          aria-label={
            loadingEarlier ? `Loading earlier ${boardLabel}` : `Load earlier ${boardLabel}`
          }
        >
          <Icon name="chevron-up" />
          <span className="pagination-full">
            {loadingEarlier ? `Loading earlier ${boardLabel}` : `Load earlier ${boardLabel}`}
          </span>
          <span className="pagination-short">{loadingEarlier ? "Loading" : "Earlier"}</span>
          <Icon name="clock" />
        </button>
      ) : null}
      <table className="board-table">
        <colgroup>
          <col className="time-column" />
          <col className="expected-column" />
          <col />
          <col className="platform-column" />
          <col className="status-column" />
          <col className="service-column" />
        </colgroup>
        <thead>
          <tr>
            <th>Time</th>
            <th>Expected</th>
            <th>{placeColumnLabel}</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Service</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowView = stationBoardRowView(row, boardType);

            return (
              <tr
                key={row.service_key}
                className={row.service_key === selectedServiceKey ? "selected-row" : undefined}
                tabIndex={0}
                aria-current={row.service_key === selectedServiceKey ? "true" : undefined}
                onClick={() => onSelectService?.(row)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectService?.(row);
                  }
                }}
              >
                <td>{formatTime(row.scheduled_ts)}</td>
                <td className={rowView.tone === "warn" ? "expected-late" : "expected-on-time"}>
                  {formatTime(row.expected_ts)}
                </td>
                <td>
                  <button
                    className="table-service-trigger"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectService?.(row);
                    }}
                  >
                    <Icon name={rowView.icon} />
                    {rowView.placeName ?? row.operator_code ?? "Service"}
                  </button>
                  {row.via_name ? <span>via {row.via_name}</span> : null}
                </td>
                <td>
                  <span className="platform">{rowView.platformLabel}</span>
                </td>
                <td>
                  <StatusBadge
                    label={rowView.boardStatus}
                    status={row.status}
                    tone={rowView.tone}
                  />
                </td>
                <td>
                  <button
                    className="service-link"
                    type="button"
                    aria-label={`Show ${rowView.placeName ?? row.service_key} service details`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectService?.(row);
                    }}
                  >
                    <span>Details</span>
                    <Icon name="chevron-right" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {loading ? <div className="board-inline-state">Loading live board...</div> : null}
      {hasLaterRows ? (
        <button
          className="load-later"
          type="button"
          onClick={onLoadLater}
          disabled={loadingLater}
          aria-label={loadingLater ? "Loading later services" : `Load later ${boardLabel}`}
        >
          <Icon name="clock" />
          <span className="pagination-full">
            {loadingLater ? "Loading later services" : `Load later ${boardLabel}`}
          </span>
          <span className="pagination-short">{loadingLater ? "Loading" : "Later"}</span>
          <Icon name="chevron-down" />
        </button>
      ) : null}
    </div>
  );
}
