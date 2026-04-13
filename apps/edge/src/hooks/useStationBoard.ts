import { useCallback, useEffect, useMemo, useState } from "react";
import type { StationBoardResponse } from "@zawa/domain/api";

import { type BoardType, getStationBoard } from "../lib/api";
import {
  currentBoardRows,
  mergeBoardRows,
  mergeCurrentBoardRows,
  upsertCurrentBoardRow,
} from "../lib/board-rows";
import { connectStationBoard } from "../lib/ws";

type BoardRows = StationBoardResponse["rows"];

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
  const boardKey = `${stationKey}:${boardType}`;
  const [rows, setRows] = useState<BoardRows>([]);
  const [stationName, setStationName] = useState<string | null>(null);
  const [profile, setProfile] = useState<StationBoardResponse["profile"]>(null);
  const [notices, setNotices] = useState<StationBoardResponse["notices"]>([]);
  const [incidents, setIncidents] = useState<StationBoardResponse["incidents"]>([]);
  const [ontology, setOntology] = useState<StationBoardResponse["ontology"]>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [previousCursor, setPreviousCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadingLater, setLoadingLater] = useState(false);
  const [loadedBoardKey, setLoadedBoardKey] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const openSocket = () => {
      ws = connectStationBoard(
        stationKey,
        boardType,
        (msg) => {
          if (msg.boardType !== boardType) return;

          if (msg.type === "station.board.snapshot") {
            setRows((current) =>
              mergeCurrentBoardRows(current, msg.rows, new Date().toISOString()),
            );
            setNextCursor(msg.nextCursor);
            setOntology(msg.ontology);
            return;
          }

          if (msg.type === "station.board.remove") {
            setRows((current) => current.filter((row) => row.service_key !== msg.serviceKey));
            return;
          }

          setRows((current) =>
            upsertCurrentBoardRow(current, stationKey, boardType, msg, new Date().toISOString()),
          );
        },
        (isConnected) => {
          setConnected(isConnected);
          if (!isConnected && !cancelled) {
            reconnectTimer = setTimeout(openSocket, 2_500);
          }
        },
      );
    };

    setLoading(true);
    setError(null);
    setConnected(false);
    setPreviousCursor(null);
    setNextCursor(null);
    setLoadingEarlier(false);
    setLoadingLater(false);
    setStationName(null);
    setProfile(null);
    setNotices([]);
    setIncidents([]);
    setOntology(undefined);
    setLoadedBoardKey(null);

    void (async () => {
      try {
        const data = await getStationBoard(stationKey, boardType);
        if (cancelled) return;

        setStationName(data.stationName);
        setProfile(data.profile);
        setNotices(data.notices);
        setIncidents(data.incidents);
        setOntology(data.ontology);
        setRows(currentBoardRows(data.rows, new Date().toISOString()));
        setPreviousCursor(data.previousCursor);
        setNextCursor(data.nextCursor);
        setLoadedBoardKey(boardKey);
        setLoading(false);
        openSocket();
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : "Failed to load station board");
        setStationName(null);
        setProfile(null);
        setNotices([]);
        setIncidents([]);
        setOntology(undefined);
        setRows([]);
        setPreviousCursor(null);
        setNextCursor(null);
        setLoadedBoardKey(null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [boardKey, stationKey, boardType]);

  const loadEarlier = useCallback(() => {
    if (!previousCursor || loadingEarlier) return;

    setLoadingEarlier(true);
    setError(null);

    void getStationBoard(stationKey, boardType, { cursor: previousCursor })
      .then((data) => {
        setRows((current) => mergeBoardRows(current, data.rows));
        setStationName((current) => current ?? data.stationName);
        setProfile((current) => current ?? data.profile);
        setNotices(data.notices);
        setIncidents(data.incidents);
        setOntology(data.ontology);
        setPreviousCursor(data.previousCursor);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load earlier services");
      })
      .finally(() => setLoadingEarlier(false));
  }, [boardType, loadingEarlier, previousCursor, stationKey]);

  const loadLater = useCallback(() => {
    if (!nextCursor || loadingLater) return;

    setLoadingLater(true);
    setError(null);

    void getStationBoard(stationKey, boardType, { cursor: nextCursor })
      .then((data) => {
        setRows((current) =>
          mergeBoardRows(current, currentBoardRows(data.rows, new Date().toISOString())),
        );
        setStationName((current) => current ?? data.stationName);
        setProfile((current) => current ?? data.profile);
        setNotices(data.notices);
        setIncidents(data.incidents);
        setOntology(data.ontology);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load later services");
      })
      .finally(() => setLoadingLater(false));
  }, [boardType, loadingLater, nextCursor, stationKey]);

  const stateMatchesBoard = loadedBoardKey === boardKey;
  const visibleRows = stateMatchesBoard ? rows : [];
  const visibleStationName = stateMatchesBoard ? stationName : null;
  const visibleProfile = stateMatchesBoard ? profile : null;
  const visibleNotices = stateMatchesBoard ? notices : [];
  const visibleIncidents = stateMatchesBoard ? incidents : [];
  const visibleOntology = stateMatchesBoard ? ontology : undefined;
  const visiblePreviousCursor = stateMatchesBoard ? previousCursor : null;
  const visibleNextCursor = stateMatchesBoard ? nextCursor : null;

  const lastUpdatedAt = useMemo(() => {
    return visibleRows.reduce<string | null>((latest, row) => {
      if (!latest) return row.updated_at;
      return row.updated_at > latest ? row.updated_at : latest;
    }, null);
  }, [visibleRows]);

  return {
    stationName: visibleStationName,
    profile: visibleProfile,
    notices: visibleNotices,
    incidents: visibleIncidents,
    ontology: visibleOntology,
    rows: visibleRows,
    loading,
    error,
    connected,
    lastUpdatedAt,
    hasEarlierRows: visiblePreviousCursor !== null,
    loadingEarlier,
    loadEarlier,
    hasLaterRows: visibleNextCursor !== null,
    loadingLater,
    loadLater,
  };
}
