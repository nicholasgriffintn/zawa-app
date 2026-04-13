import { useEffect, useMemo, useRef, useState } from "react";
import type { ServiceResponse } from "@zawa/domain/api";

import { getService } from "../lib/api";
import { connectService } from "../lib/ws";

export interface ServiceDetailsState {
  service: ServiceResponse["service"] | null;
  stops: ServiceResponse["stops"];
  summary: ServiceResponse["summary"] | null;
  formations: ServiceResponse["formations"];
  movements: ServiceResponse["movements"];
  incidents: ServiceResponse["incidents"];
  stationProfiles: ServiceResponse["stationProfiles"];
  ontology: ServiceResponse["ontology"];
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdatedAt: string | null;
}

export function useServiceDetails(serviceKey: string | null | undefined): ServiceDetailsState {
  const [service, setService] = useState<ServiceResponse["service"] | null>(null);
  const [stops, setStops] = useState<ServiceResponse["stops"]>([]);
  const [summary, setSummary] = useState<ServiceResponse["summary"] | null>(null);
  const [formations, setFormations] = useState<ServiceResponse["formations"]>([]);
  const [movements, setMovements] = useState<ServiceResponse["movements"]>([]);
  const [incidents, setIncidents] = useState<ServiceResponse["incidents"]>([]);
  const [stationProfiles, setStationProfiles] = useState<ServiceResponse["stationProfiles"]>([]);
  const [ontology, setOntology] = useState<ServiceResponse["ontology"]>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const serviceUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    let ws: WebSocket | undefined;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setConnected(false);

    if (!serviceKey) {
      setService(null);
      setStops([]);
      setSummary(null);
      setFormations([]);
      setMovements([]);
      setIncidents([]);
      setStationProfiles([]);
      setOntology(undefined);
      serviceUpdatedAtRef.current = null;
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const applySnapshot = (data: ServiceResponse) => {
      if (serviceUpdatedAtRef.current && data.service.updated_at < serviceUpdatedAtRef.current) {
        return false;
      }

      serviceUpdatedAtRef.current = data.service.updated_at;
      setService(data.service);
      setStops(data.stops);
      setSummary(data.summary);
      setFormations(data.formations);
      setMovements(data.movements);
      setIncidents(data.incidents);
      setStationProfiles(data.stationProfiles);
      setOntology(data.ontology);
      setError(null);
      return true;
    };

    const loadSnapshot = async () => {
      const data = await getService(serviceKey);
      if (cancelled) return;
      applySnapshot(data);
    };

    void (async () => {
      try {
        await loadSnapshot();
        if (cancelled) return;

        setLoading(false);

        ws = connectService(
          serviceKey,
          (msg) => {
            if (msg.type === "service.snapshot") {
              if (
                serviceUpdatedAtRef.current &&
                msg.service.updated_at < serviceUpdatedAtRef.current
              ) {
                return;
              }

              serviceUpdatedAtRef.current = msg.service.updated_at;
              setService(msg.service);
              setStops(msg.stops);
              setSummary(msg.summary);
              setFormations(msg.formations);
              setMovements(msg.movements);
              setIncidents([]);
              setStationProfiles([]);
              setOntology(msg.ontology);
              void loadSnapshot().catch(() => undefined);
              return;
            }

            if (msg.type === "service.patch") {
              if (
                msg.patch.updated_at &&
                serviceUpdatedAtRef.current &&
                msg.patch.updated_at < serviceUpdatedAtRef.current
              ) {
                return;
              }

              if (msg.patch.updated_at) {
                serviceUpdatedAtRef.current = msg.patch.updated_at;
              }

              setService((current) => {
                if (!current) return current;

                const next = {
                  ...current,
                  status: msg.patch.status ?? current.status,
                  updated_at: msg.patch.updated_at ?? current.updated_at,
                };
                return next;
              });
              void loadSnapshot().catch(() => undefined);
            }
          },
          setConnected,
        );
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : "Failed to load service");
        setService(null);
        setStops([]);
        setSummary(null);
        setFormations([]);
        setMovements([]);
        setIncidents([]);
        setStationProfiles([]);
        setOntology(undefined);
        serviceUpdatedAtRef.current = null;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [serviceKey]);

  const lastUpdatedAt = useMemo(() => service?.updated_at ?? null, [service]);

  return {
    service,
    stops,
    summary,
    formations,
    movements,
    incidents,
    stationProfiles,
    ontology,
    loading,
    error,
    connected,
    lastUpdatedAt,
  };
}
