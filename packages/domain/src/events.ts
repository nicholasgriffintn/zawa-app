export type RailSource = "rdm" | "trust" | "td";

export const railEventTypes = [
  "service.activated",
  "service.updated",
  "service.cancelled",
  "service.reinstated",
  "service.location.updated",
  "service.location.platform.changed",
  "service.terminated",
  "rdm.realtime.schedule.updated",
  "rdm.realtime.association.updated",
  "rdm.realtime.train.order.updated",
  "rdm.realtime.station.message.updated",
  "rdm.realtime.train.alert.updated",
  "rdm.realtime.tracking.id.corrected",
  "rdm.realtime.alarm.updated",
  "rdm.realtime.formation.updated",
  "rdm.realtime.loading.updated",
  "rdm.realtime.timetable.updated",
  "rdm.realtime.unknown",
  "rdm.station.board.refresh.requested",
  "rdm.board.snapshot",
  "rdm.service.snapshot",
  "ingest.heartbeat",
  "ingest.status",
] as const;

export type RailEventType = (typeof railEventTypes)[number];

export interface RailEvent<TPayload = Record<string, unknown>> {
  id: string;
  source: RailSource;
  topic: string;
  type: RailEventType;
  occurredAt: string;
  ingestedAt: string;
  serviceKey?: string;
  trainRunKey?: string;
  stationKey?: string;
  payloadVersion: number;
  payload: TPayload;
}
