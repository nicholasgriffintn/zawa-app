import type { StationBoardResponse } from "@zawa/domain/api";
import type { StationBoardMessage } from "@zawa/realtime/messages";

import { currentBoardSince } from "./board-window";

type BoardRows = StationBoardResponse["rows"];
type BoardRow = BoardRows[number];
type StationPatchMessage = Extract<StationBoardMessage, { type: "station.board.patch" }>;

export function sortBoardRows(rows: BoardRows): BoardRows {
  return [...rows].sort((a, b) => boardRowSortTime(a).localeCompare(boardRowSortTime(b)));
}

export function currentBoardRows(rows: BoardRows, nowIso: string): BoardRows {
  const since = currentBoardSince(nowIso);
  return rows.filter((row) => boardRowCurrentTime(row) >= since);
}

export function mergeBoardRows(current: BoardRows, snapshotRows: BoardRows): BoardRows {
  const rows = new Map(current.map((row) => [row.service_key, row]));
  for (const snapshotRow of snapshotRows) {
    const existing = rows.get(snapshotRow.service_key);
    if (!existing || snapshotRow.updated_at >= existing.updated_at) {
      rows.set(snapshotRow.service_key, snapshotRow);
    }
  }

  return sortBoardRows([...rows.values()]);
}

export function mergeCurrentBoardRows(
  current: BoardRows,
  snapshotRows: BoardRows,
  nowIso: string,
): BoardRows {
  return currentBoardRows(mergeBoardRows(current, currentBoardRows(snapshotRows, nowIso)), nowIso);
}

export function upsertCurrentBoardRow(
  current: BoardRows,
  stationKey: string,
  boardType: StationBoardResponse["boardType"],
  msg: StationPatchMessage,
  nowIso: string,
): BoardRows {
  const next = upsertBoardRow(current, stationKey, boardType, msg);
  return currentBoardRows(next, nowIso);
}

function upsertBoardRow(
  current: BoardRows,
  stationKey: string,
  boardType: StationBoardResponse["boardType"],
  msg: StationPatchMessage,
): BoardRows {
  const idx = current.findIndex((row) => row.service_key === msg.serviceKey);
  if (idx === -1) {
    return sortBoardRows([
      ...current,
      {
        station_key: stationKey,
        board_type: boardType,
        service_key: msg.serviceKey,
        scheduled_ts: msg.patch.scheduled_ts ?? null,
        expected_ts: msg.patch.expected_ts ?? null,
        origin_name: msg.patch.origin_name ?? null,
        destination_name: msg.patch.destination_name ?? null,
        via_name: msg.patch.via_name ?? null,
        service_type: msg.patch.service_type ?? null,
        operator_code: msg.patch.operator_code ?? null,
        platform: msg.patch.platform ?? null,
        status: msg.patch.status ?? "service.updated",
        updated_at: msg.patch.updated_at ?? new Date().toISOString(),
      },
    ]);
  }

  const next = [...current];
  const existing = next[idx];
  if (msg.patch.updated_at && msg.patch.updated_at < existing.updated_at) {
    return current;
  }

  next[idx] = {
    ...existing,
    scheduled_ts: msg.patch.scheduled_ts ?? existing.scheduled_ts,
    expected_ts: msg.patch.expected_ts ?? existing.expected_ts,
    platform: msg.patch.platform ?? existing.platform,
    origin_name: msg.patch.origin_name ?? existing.origin_name,
    destination_name: msg.patch.destination_name ?? existing.destination_name,
    via_name: msg.patch.via_name ?? existing.via_name,
    service_type: msg.patch.service_type ?? existing.service_type,
    operator_code: msg.patch.operator_code ?? existing.operator_code,
    status: msg.patch.status ?? existing.status,
    updated_at: msg.patch.updated_at ?? existing.updated_at,
  };

  return sortBoardRows(next);
}

function boardRowSortTime(row: BoardRow): string {
  return row.scheduled_ts ?? row.expected_ts ?? row.updated_at;
}

function boardRowCurrentTime(row: BoardRow): string {
  return row.expected_ts ?? row.scheduled_ts ?? row.updated_at;
}
