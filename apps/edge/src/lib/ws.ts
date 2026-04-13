import {
  parseServiceMessage,
  parseStationBoardMessage,
  type ServiceMessage,
  type StationBoardMessage,
} from "@zawa/realtime/messages";

export function connectStationBoard(
  stationKey: string,
  boardType: "departures" | "arrivals",
  onMessage: (msg: StationBoardMessage) => void,
  onStateChange?: (connected: boolean) => void,
): WebSocket {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const params = new URLSearchParams({ boardType });
  const ws = new WebSocket(
    `${protocol}://${location.host}/ws/stations/${encodeURIComponent(stationKey)}?${params}`,
  );
  ws.addEventListener("message", (event) => {
    const parsed = parseStationBoardMessage(event.data);
    if (!parsed) {
      return;
    }

    onMessage(parsed);
  });
  ws.addEventListener("open", () => onStateChange?.(true));
  ws.addEventListener("close", () => onStateChange?.(false));
  ws.addEventListener("error", () => onStateChange?.(false));
  return ws;
}

export function connectService(
  serviceKey: string,
  onMessage: (msg: ServiceMessage) => void,
  onStateChange?: (connected: boolean) => void,
): WebSocket {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(
    `${protocol}://${location.host}/ws/services/${encodeURIComponent(serviceKey)}`,
  );
  ws.addEventListener("message", (event) => {
    const parsed = parseServiceMessage(event.data);
    if (!parsed) {
      return;
    }

    onMessage(parsed);
  });
  ws.addEventListener("open", () => onStateChange?.(true));
  ws.addEventListener("close", () => onStateChange?.(false));
  ws.addEventListener("error", () => onStateChange?.(false));
  return ws;
}
