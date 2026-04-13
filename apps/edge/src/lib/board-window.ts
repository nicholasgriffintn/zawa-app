import type { StationBoardResponse } from "@zawa/domain/api";
import { addMinutesIso } from "@zawa/shared/time";

const CURRENT_BOARD_GRACE_MINUTES = 5;
const LIVE_SERVICE_GRACE_MINUTES = 5;

export function currentBoardSince(nowIso: string): string {
  return addMinutesIso(nowIso, -CURRENT_BOARD_GRACE_MINUTES);
}

export function liveServiceSince(nowIso: string): string {
  return addMinutesIso(nowIso, -LIVE_SERVICE_GRACE_MINUTES);
}

export function currentStationBoard(
  board: StationBoardResponse,
  nowIso: string,
): StationBoardResponse {
  const since = currentBoardSince(nowIso);
  return {
    ...board,
    rows: board.rows.filter(
      (row) => (row.expected_ts ?? row.scheduled_ts ?? row.updated_at) >= since,
    ),
  };
}
