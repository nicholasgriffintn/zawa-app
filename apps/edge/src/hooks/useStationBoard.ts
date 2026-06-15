import { useCallback, useEffect, useMemo, useState } from "react";
import type { StationBoardResponse } from "@zawa/domain/api";

import {
  type BoardType,
  type StationContextResponse,
  getStationBoard,
  getStationContext,
} from "../lib/api";
import { currentBoardRows, mergeBoardRows, upsertCurrentBoardRow } from "../lib/board-rows";
import { connectStationBoard } from "../lib/ws";

type BoardRows = StationBoardResponse["rows"];
const stationContextRequests = new Map<string, Promise<StationContextResponse>>();

interface BoardCache {
  rows: BoardRows;
  previousCursor: string | null;
  nextCursor: string | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  lastReceivedAt: string | null;
}

export interface StationBoardState {
  stationName: string | null;
  profile: StationBoardResponse["profile"];
  notices: StationBoardResponse["notices"];
  incidents: StationBoardResponse["incidents"];
  ontology: StationBoardResponse["ontology"];
  rows: BoardRows;
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdatedAt: string | null;
  hasEarlierRows: boolean;
  loadingEarlier: boolean;
  loadEarlier: () => void;
  hasLaterRows: boolean;
  loadingLater: boolean;
  loadLater: () => void;
}

export function useStationBoard(stationKey: string, boardType: BoardType): StationBoardState {
  const [boards, setBoards] = useState<Record<BoardType, BoardCache>>(createEmptyBoards);
  const [stationName, setStationName] = useState<string | null>(null);
  const [profile, setProfile] = useState<StationBoardResponse["profile"]>(null);
  const [notices, setNotices] = useState<StationBoardResponse["notices"]>([]);
  const [incidents, setIncidents] = useState<StationBoardResponse["incidents"]>([]);
  const [ontology, setOntology] = useState<StationBoardResponse["ontology"]>(undefined);
  const [contextError, setContextError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadingLater, setLoadingLater] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setBoards(createEmptyBoards());
    setStationName(null);
    setProfile(null);
    setNotices([]);
    setIncidents([]);
    setOntology(undefined);
    setContextError(null);

    void cachedStationContext(stationKey)
      .then((context) => {
        if (cancelled) return;
        setStationName(context.stationName);
        setProfile(context.profile);
        setNotices(context.notices);
        setIncidents(context.incidents);
        setOntology(context.ontology);
      })
      .catch((err) => {
        if (cancelled) return;
        setContextError(err instanceof Error ? err.message : "Failed to load station context");
      });

    return () => {
      cancelled = true;
    };
  }, [stationKey]);

  useEffect(() => {
    let ws: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let receivedSnapshot = false;

    const openSocket = () => {
      setBoards((current) => ({
        ...current,
        [boardType]: {
          ...current[boardType],
          loading: !current[boardType].loaded,
          error: null,
        },
      }));

      ws = connectStationBoard(
        stationKey,
        boardType,
        (msg) => {
          if (cancelled || msg.stationKey !== stationKey || msg.boardType !== boardType) return;

          if (msg.type === "station.board.snapshot") {
            receivedSnapshot = true;
            setBoards((current) => ({
              ...current,
              [boardType]: {
                rows: currentBoardRows(msg.rows, new Date().toISOString()),
                previousCursor: msg.previousCursor,
                nextCursor: msg.nextCursor,
                loading: false,
                loaded: true,
                error: null,
                lastReceivedAt: msg.sentAt,
              },
            }));
            return;
          }

          if (msg.type === "station.board.remove") {
            setBoards((current) => ({
              ...current,
              [boardType]: {
                ...current[boardType],
                rows: current[boardType].rows.filter((row) => row.service_key !== msg.serviceKey),
                lastReceivedAt: msg.sentAt,
              },
            }));
            return;
          }

          setBoards((current) => ({
            ...current,
            [boardType]: {
              ...current[boardType],
              rows: upsertCurrentBoardRow(
                current[boardType].rows,
                stationKey,
                boardType,
                msg,
                new Date().toISOString(),
              ),
              lastReceivedAt: msg.sentAt,
            },
          }));
        },
        (isConnected) => {
          if (cancelled) return;

          setConnected(isConnected);
          if (!isConnected) {
            if (!receivedSnapshot) {
              setBoards((current) => ({
                ...current,
                [boardType]: {
                  ...current[boardType],
                  loading: false,
                  error: "Live station board updates are unavailable right now",
                },
              }));
            }
            reconnectTimer = setTimeout(openSocket, 2_500);
          }
        },
      );
    };

    setConnected(false);
    setLoadingEarlier(false);
    setLoadingLater(false);
    openSocket();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [stationKey, boardType]);

  const activeBoard = boards[boardType];

  const loadEarlier = useCallback(() => {
    if (!activeBoard.previousCursor || loadingEarlier) return;

    setLoadingEarlier(true);

    void getStationBoard(stationKey, boardType, { cursor: activeBoard.previousCursor })
      .then((data) => {
        setBoards((current) => ({
          ...current,
          [boardType]: {
            ...current[boardType],
            rows: mergeBoardRows(current[boardType].rows, data.rows),
            previousCursor: data.previousCursor,
            error: null,
            lastReceivedAt: new Date().toISOString(),
          },
        }));
      })
      .catch((err) => {
        setBoards((current) => ({
          ...current,
          [boardType]: {
            ...current[boardType],
            error: err instanceof Error ? err.message : "Failed to load earlier services",
          },
        }));
      })
      .finally(() => setLoadingEarlier(false));
  }, [activeBoard.previousCursor, boardType, loadingEarlier, stationKey]);

  const loadLater = useCallback(() => {
    if (!activeBoard.nextCursor || loadingLater) return;

    setLoadingLater(true);

    void getStationBoard(stationKey, boardType, { cursor: activeBoard.nextCursor })
      .then((data) => {
        setBoards((current) => ({
          ...current,
          [boardType]: {
            ...current[boardType],
            rows: mergeBoardRows(
              current[boardType].rows,
              currentBoardRows(data.rows, new Date().toISOString()),
            ),
            nextCursor: data.nextCursor,
            error: null,
            lastReceivedAt: new Date().toISOString(),
          },
        }));
      })
      .catch((err) => {
        setBoards((current) => ({
          ...current,
          [boardType]: {
            ...current[boardType],
            error: err instanceof Error ? err.message : "Failed to load later services",
          },
        }));
      })
      .finally(() => setLoadingLater(false));
  }, [activeBoard.nextCursor, boardType, loadingLater, stationKey]);

  const lastUpdatedAt = useMemo(() => {
    const latestRowUpdate = activeBoard.rows.reduce<string | null>((latest, row) => {
      if (!latest) return row.updated_at;
      return row.updated_at > latest ? row.updated_at : latest;
    }, null);
    return latestRowUpdate ?? activeBoard.lastReceivedAt;
  }, [activeBoard]);

  return {
    stationName,
    profile,
    notices,
    incidents,
    ontology,
    rows: activeBoard.rows,
    loading: activeBoard.loading,
    error: activeBoard.error ?? contextError,
    connected,
    lastUpdatedAt,
    hasEarlierRows: activeBoard.previousCursor !== null,
    loadingEarlier,
    loadEarlier,
    hasLaterRows: activeBoard.nextCursor !== null,
    loadingLater,
    loadLater,
  };
}

function createEmptyBoards(): Record<BoardType, BoardCache> {
  return {
    departures: createEmptyBoard(),
    arrivals: createEmptyBoard(),
  };
}

function createEmptyBoard(): BoardCache {
  return {
    rows: [],
    previousCursor: null,
    nextCursor: null,
    loading: true,
    loaded: false,
    error: null,
    lastReceivedAt: null,
  };
}

function cachedStationContext(stationKey: string): Promise<StationContextResponse> {
  const cached = stationContextRequests.get(stationKey);
  if (cached) return cached;

  const request = getStationContext(stationKey).catch((error) => {
    stationContextRequests.delete(stationKey);
    throw error;
  });
  stationContextRequests.set(stationKey, request);
  return request;
}
