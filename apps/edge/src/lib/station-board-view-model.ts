import type { StationBoardResponse } from "@zawa/domain/api";

import { boardStatusTone, formatBoardStatus } from "./format";
import type { IconName } from "./icon-names";
import { serviceMode, serviceModeIcon } from "./service-detail-view-model";

type BoardRow = StationBoardResponse["rows"][number];

export type StationBoardRowView = {
  boardStatus: string;
  icon: IconName;
  placeName: string | null;
  platformLabel: string;
  tone: "good" | "warn" | "bad" | "neutral";
};

export function stationBoardRowView(
  row: BoardRow,
  boardType: StationBoardResponse["boardType"],
): StationBoardRowView {
  const mode = serviceMode(row);
  const boardStatus = formatBoardStatus({
    expected: row.expected_ts,
    scheduled: row.scheduled_ts,
    status: row.status,
  });

  return {
    boardStatus,
    icon: serviceModeIcon(mode),
    placeName:
      boardType === "arrivals" ? (row.origin_name ?? row.destination_name) : row.destination_name,
    platformLabel:
      mode === "bus" && row.platform?.toLowerCase() === "bus" ? "Bus" : (row.platform ?? "TBC"),
    tone: boardStatusTone({
      expected: row.expected_ts,
      scheduled: row.scheduled_ts,
      status: row.status,
    }),
  };
}
