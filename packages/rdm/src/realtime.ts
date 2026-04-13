import type { RailEvent, RailEventType } from "@zawa/domain/events";
import { toServiceKey, toStationKey, toTrainRunKey } from "@zawa/domain/keys";
import { sha1Hex } from "@zawa/shared/hash";
import { isJsonObject, parseJsonSafe } from "@zawa/shared/json";
import { dateTimeToIso, epochMillisToIso } from "@zawa/shared/time";
import { booleanValue, numberValue, stringValue } from "@zawa/shared/values";

interface RdmRealtimeEnvelope {
  destination?: {
    name?: string;
    destinationType?: string;
  };
  messageID?: string;
  messageType?: string;
  bytes?: string;
  text?: string;
  timestamp?: number;
  properties?: Record<string, unknown>;
}

interface RdmRealtimePayload {
  ts?: string;
  version?: string;
  uR?: RdmRealtimeRecord;
  sR?: RdmRealtimeRecord;
  FailureResp?: {
    code?: string;
    requestSource?: string;
    requestID?: string;
  };
}

interface RdmRealtimeRecord {
  TS?: RdmTrainStatus;
  schedule?: unknown;
  deactivatedSchedule?: unknown;
  association?: unknown;
  trainOrder?: unknown;
  OW?: unknown;
  trainAlert?: unknown;
  trackingID?: unknown;
  alarm?: unknown;
  scheduleFormations?: unknown;
  formationLoading?: unknown;
  timetableID?: unknown;
  updateOrigin?: string;
}

interface RdmTrainStatus {
  rid?: string;
  uid?: string;
  ssd?: string;
  toc?: string;
  isCancelled?: boolean;
  isReinstated?: boolean;
  lateCancelReason?: string;
  terminated?: unknown;
  Location?: unknown;
}

interface RdmLocation {
  crs?: string;
  tpl?: string;
  locationName?: string;
  name?: string;
  wta?: string;
  wtd?: string;
  wtp?: string;
  pta?: string;
  ptd?: string;
  arr?: RdmTiming;
  dep?: RdmTiming;
  pass?: RdmTiming;
  plat?: RdmPlatform;
  length?: number;
  isCancelled?: boolean;
}

interface RdmTiming {
  et?: string;
  at?: string;
  src?: string;
}

type RdmPlatform = string | { plat?: string; platform?: string; "": string };

export interface RdmRealtimeNormaliseResult {
  events: RailEvent[];
  ignored: boolean;
  reason?: string;
}

export async function normaliseRdmRealtimeEnvelope(
  value: unknown,
  nowIso: string,
): Promise<RdmRealtimeNormaliseResult> {
  const envelope = parseEnvelope(value);
  if (!envelope) return { events: [], ignored: true, reason: "Invalid RDM realtime envelope" };

  const payload = parsePayload(envelope);
  if (!payload) return { events: [], ignored: true, reason: "Invalid RDM realtime payload" };

  const topic = envelope.destination?.name?.trim() || "rdm-realtime";
  const occurredAt = dateTimeToIso(payload.ts) ?? epochMillisToIso(envelope.timestamp) ?? nowIso;

  if (payload.FailureResp) {
    return {
      events: [
        await buildEvent({
          envelope,
          topic,
          type: "ingest.status",
          occurredAt,
          ingestedAt: nowIso,
          payload: {
            product: "rdm-realtime",
            version: payload.version,
            statusCode: payload.FailureResp.code,
            requestSource: payload.FailureResp.requestSource,
            requestID: payload.FailureResp.requestID,
          },
        }),
      ],
      ignored: false,
    };
  }

  const record = payload.uR ?? payload.sR;
  const recordKind = payload.uR ? "update" : payload.sR ? "snapshot" : "unknown";
  if (!record) {
    return {
      events: [
        await buildEvent({
          envelope,
          topic,
          type: "rdm.realtime.unknown",
          occurredAt,
          ingestedAt: nowIso,
          payload: { product: "rdm-realtime", version: payload.version, recordKind },
        }),
      ],
      ignored: false,
    };
  }

  const events: RailEvent[] = [];
  if (record.TS) {
    events.push(
      ...(await normaliseTrainStatus({
        envelope,
        topic,
        payload,
        record,
        recordKind,
        occurredAt,
        ingestedAt: nowIso,
      })),
    );
  }

  for (const [key, type] of Object.entries(recordEventTypes)) {
    if (record[key as keyof RdmRealtimeRecord] === undefined) continue;
    events.push(
      await buildEvent({
        envelope,
        topic,
        type,
        occurredAt,
        ingestedAt: nowIso,
        payload: {
          product: "rdm-realtime",
          version: payload.version,
          recordKind,
          updateOrigin: record.updateOrigin,
          body: record[key as keyof RdmRealtimeRecord],
        },
      }),
    );
  }

  if (events.length) return { events, ignored: false };

  return {
    events: [
      await buildEvent({
        envelope,
        topic,
        type: "rdm.realtime.unknown",
        occurredAt,
        ingestedAt: nowIso,
        payload: {
          product: "rdm-realtime",
          version: payload.version,
          recordKind,
          updateOrigin: record.updateOrigin,
        },
      }),
    ],
    ignored: false,
  };
}

const recordEventTypes = {
  schedule: "rdm.realtime.schedule.updated",
  deactivatedSchedule: "rdm.realtime.schedule.updated",
  association: "rdm.realtime.association.updated",
  trainOrder: "rdm.realtime.train.order.updated",
  OW: "rdm.realtime.station.message.updated",
  trainAlert: "rdm.realtime.train.alert.updated",
  trackingID: "rdm.realtime.tracking.id.corrected",
  alarm: "rdm.realtime.alarm.updated",
  scheduleFormations: "rdm.realtime.formation.updated",
  formationLoading: "rdm.realtime.loading.updated",
  timetableID: "rdm.realtime.timetable.updated",
} as const satisfies Record<string, RailEventType>;

async function normaliseTrainStatus(options: {
  envelope: RdmRealtimeEnvelope;
  topic: string;
  payload: RdmRealtimePayload;
  record: RdmRealtimeRecord;
  recordKind: string;
  occurredAt: string;
  ingestedAt: string;
}): Promise<RailEvent[]> {
  const ts = options.record.TS;
  if (!ts) return [];

  const serviceKey = toServiceKey({
    rid: ts.rid,
    uid: ts.uid,
    serviceDate: ts.ssd,
    toc: ts.toc,
  });
  const trainRunKey = toTrainRunKey({
    trainId: ts.rid,
    date: ts.ssd ?? options.occurredAt.slice(0, 10),
  });
  const locations = parseLocations(ts.Location);

  if (!locations.length) {
    return [
      await buildEvent({
        envelope: options.envelope,
        topic: options.topic,
        type: serviceEventType(ts, null),
        occurredAt: options.occurredAt,
        ingestedAt: options.ingestedAt,
        serviceKey,
        trainRunKey,
        payload: {
          product: "rdm-realtime",
          version: options.payload.version,
          recordKind: options.recordKind,
          updateOrigin: options.record.updateOrigin,
          rid: ts.rid,
          uid: ts.uid,
          ssd: ts.ssd,
          toc: ts.toc,
        },
      }),
    ];
  }

  return Promise.all(
    locations.map((location, index) => {
      const stationKey = location.crs ? toStationKey(location.crs) : undefined;
      const type = serviceEventType(ts, location);
      return buildEvent({
        envelope: options.envelope,
        topic: options.topic,
        type,
        occurredAt: options.occurredAt,
        ingestedAt: options.ingestedAt,
        serviceKey,
        trainRunKey,
        stationKey,
        sequence: index,
        payload: {
          product: "rdm-realtime",
          version: options.payload.version,
          recordKind: options.recordKind,
          updateOrigin: options.record.updateOrigin,
          rid: ts.rid,
          uid: ts.uid,
          ssd: ts.ssd,
          toc: ts.toc,
          crs: location.crs,
          tpl: location.tpl,
          locationName: location.locationName ?? location.name,
          platform: platformValue(location.plat),
          serviceLength: location.length,
          plannedArrival: location.wta ?? location.pta,
          plannedDeparture: location.wtd ?? location.ptd ?? location.wtp,
          expectedArrival: location.arr?.et,
          expectedDeparture: location.dep?.et ?? location.pass?.et,
          actualArrival: location.arr?.at,
          actualDeparture: location.dep?.at ?? location.pass?.at,
          timingSource: location.arr?.src ?? location.dep?.src ?? location.pass?.src,
          locations: locations.map((item) => ({
            crs: item.crs,
            tpl: item.tpl,
            locationName: item.locationName ?? item.name,
            platform: platformValue(item.plat),
            serviceLength: item.length,
            plannedArrival: item.wta ?? item.pta,
            plannedDeparture: item.wtd ?? item.ptd ?? item.wtp,
            expectedArrival: item.arr?.et,
            expectedDeparture: item.dep?.et ?? item.pass?.et,
            actualArrival: item.arr?.at,
            actualDeparture: item.dep?.at ?? item.pass?.at,
          })),
        },
      });
    }),
  );
}

async function buildEvent(options: {
  envelope: RdmRealtimeEnvelope;
  topic: string;
  type: RailEventType;
  occurredAt: string;
  ingestedAt: string;
  serviceKey?: string;
  trainRunKey?: string;
  stationKey?: string;
  sequence?: number;
  payload: Record<string, unknown>;
}): Promise<RailEvent> {
  const idSeed = JSON.stringify({
    messageID: options.envelope.messageID,
    type: options.type,
    sequence: options.sequence ?? 0,
    payload: options.payload,
  });

  return {
    id: await sha1Hex(idSeed),
    source: "rdm",
    topic: options.topic,
    type: options.type,
    occurredAt: options.occurredAt,
    ingestedAt: options.ingestedAt,
    serviceKey: options.serviceKey,
    trainRunKey: options.trainRunKey,
    stationKey: options.stationKey,
    payloadVersion: 1,
    payload: options.payload,
  };
}

function parseEnvelope(value: unknown): RdmRealtimeEnvelope | null {
  if (!isJsonObject(value) || Array.isArray(value)) return null;

  const destination = isJsonObject(value.destination)
    ? {
        name: stringValue(value.destination.name),
        destinationType: stringValue(value.destination.destinationType),
      }
    : undefined;

  return {
    destination,
    messageID: stringValue(value.messageID),
    messageType: stringValue(value.messageType),
    bytes: stringValue(value.bytes),
    text: stringValue(value.text),
    timestamp: numberValue(value.timestamp),
    properties: isJsonObject(value.properties) ? value.properties : undefined,
  };
}

function parsePayload(envelope: RdmRealtimeEnvelope): RdmRealtimePayload | null {
  const parsed = parseJsonSafe(envelope.bytes ?? envelope.text);
  if (!isJsonObject(parsed) || Array.isArray(parsed)) return null;

  return {
    ts: stringValue(parsed.ts),
    version: stringValue(parsed.version),
    uR: realtimeRecord(parsed.uR),
    sR: realtimeRecord(parsed.sR),
    FailureResp: failureResponse(parsed.FailureResp),
  };
}

function realtimeRecord(value: unknown): RdmRealtimeRecord | undefined {
  if (!isJsonObject(value) || Array.isArray(value)) return undefined;

  return {
    TS: trainStatus(value.TS),
    schedule: value.schedule,
    deactivatedSchedule: value.deactivatedSchedule,
    association: value.association,
    trainOrder: value.trainOrder,
    OW: value.OW,
    trainAlert: value.trainAlert,
    trackingID: value.trackingID,
    alarm: value.alarm,
    scheduleFormations: value.scheduleFormations,
    formationLoading: value.formationLoading,
    timetableID: value.timetableID,
    updateOrigin: stringValue(value.updateOrigin),
  };
}

function trainStatus(value: unknown): RdmTrainStatus | undefined {
  if (!isJsonObject(value) || Array.isArray(value)) return undefined;
  return {
    rid: stringValue(value.rid),
    uid: stringValue(value.uid),
    ssd: stringValue(value.ssd),
    toc: stringValue(value.toc),
    isCancelled: booleanValue(value.isCancelled),
    isReinstated: booleanValue(value.isReinstated),
    lateCancelReason: stringValue(value.lateCancelReason),
    terminated: value.terminated,
    Location: value.Location,
  };
}

function failureResponse(value: unknown): RdmRealtimePayload["FailureResp"] {
  if (!isJsonObject(value) || Array.isArray(value)) return undefined;
  return {
    code: stringValue(value.code),
    requestSource: stringValue(value.requestSource),
    requestID: stringValue(value.requestID),
  };
}

function parseLocations(value: unknown): RdmLocation[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return items.flatMap((item) => {
    if (!isJsonObject(item) || Array.isArray(item)) return [];
    return [
      {
        crs: stringValue(item.crs),
        tpl: stringValue(item.tpl),
        locationName: stringValue(item.locationName),
        name: stringValue(item.name),
        wta: stringValue(item.wta),
        wtd: stringValue(item.wtd),
        wtp: stringValue(item.wtp),
        pta: stringValue(item.pta),
        ptd: stringValue(item.ptd),
        arr: timing(item.arr),
        dep: timing(item.dep),
        pass: timing(item.pass),
        plat: platform(item.plat),
        length: integerValue(item.length),
        isCancelled: booleanValue(item.isCancelled),
      },
    ];
  });
}

function timing(value: unknown): RdmTiming | undefined {
  if (!isJsonObject(value) || Array.isArray(value)) return undefined;
  return {
    et: stringValue(value.et),
    at: stringValue(value.at),
    src: stringValue(value.src),
  };
}

function platform(value: unknown): RdmPlatform | undefined {
  if (typeof value === "string") return value;
  if (!isJsonObject(value) || Array.isArray(value)) return undefined;
  return {
    "": stringValue(value[""]) ?? "",
    plat: stringValue(value.plat),
    platform: stringValue(value.platform),
  };
}

function platformValue(value: RdmPlatform | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  return value[""]?.trim() || value.plat?.trim() || value.platform?.trim() || undefined;
}

function serviceEventType(ts: RdmTrainStatus, location: RdmLocation | null): RailEventType {
  if (ts.isCancelled || location?.isCancelled || ts.lateCancelReason) return "service.cancelled";
  if (ts.isReinstated) return "service.reinstated";
  if (ts.terminated !== undefined) return "service.terminated";
  if (platformValue(location?.plat)) return "service.location.platform.changed";
  return location ? "service.location.updated" : "service.updated";
}

function integerValue(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(stringValue(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}
