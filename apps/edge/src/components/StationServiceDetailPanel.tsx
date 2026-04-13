import type { StationBoardResponse } from "@zawa/domain/api";

import type { ServiceDetailsState } from "../hooks/useServiceDetails";
import type { BoardType } from "../lib/api";
import { BoardServiceDetail } from "./ServiceDetails";
import { Icon } from "./Icon";
import { OntologySummary } from "./OntologySummary";

import "./DetailPanel.scss";

type BoardRow = StationBoardResponse["rows"][number];

export function StationServiceDetailPanel({
  stationName,
  nextTrain,
  boardStatus,
  boardTone,
  boardType,
  nextService,
  onClose,
}: {
  stationName: string;
  nextTrain: BoardRow;
  boardStatus: string | null;
  boardTone: "good" | "warn" | "bad" | "neutral";
  boardType: BoardType;
  nextService: ServiceDetailsState;
  onClose: () => void;
}) {
  return (
    <aside className="detail-panel">
      <div className="detail-topline">
        <button type="button" onClick={onClose}>
          <Icon name="arrow-left" />
          Back to board
        </button>
        <span>Service details</span>
      </div>
      <BoardServiceDetail
        stationName={stationName}
        nextTrain={nextTrain}
        boardStatus={boardStatus}
        boardTone={boardTone}
        boardType={boardType}
        nextService={nextService}
      />
      <a className="primary-link" href={`/services/${encodeURIComponent(nextTrain.service_key)}`}>
        View full service information
        <Icon name="chevron-right" />
      </a>
      <OntologySummary graph={nextService.ontology} title="Selected service graph" compact />
    </aside>
  );
}
