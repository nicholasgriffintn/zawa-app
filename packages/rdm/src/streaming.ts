import type { RailEvent } from "@zawa/domain/events";
import { isRecord, stringValue } from "@zawa/shared/values";

import { buildRdmRawEventRows, type RdmRawEventWrite } from "./raw-events";
import { normaliseRdmRealtimeEnvelope } from "./realtime";
import { normaliseRdmTrainMovement } from "./train-movements";

export const RDM_REALTIME_FEED_NAME = "rdm-realtime";
export const RDM_TRAIN_MOVEMENTS_FEED_NAME = "rdm-train-movements";
export const RDM_REALTIME_SOURCE_KEY = "rdm.realtime";
export const RDM_TRAIN_MOVEMENTS_SOURCE_KEY = "rdm.train-movements";

export type RdmStreamingFeed = typeof RDM_REALTIME_FEED_NAME | typeof RDM_TRAIN_MOVEMENTS_FEED_NAME;

export interface RdmRawSourceEvent {
  sourceKey: string;
  receivedAt: string;
  payload: unknown;
  topic: string | null;
  occurredAt: string | null;
}

export interface RdmStreamingNormaliseResult {
  events: RailEvent[];
  ignored: boolean;
  reason?: string;
}

const RAW_SOURCE_EVENT_KEY = "rdmRawSourceEvent";

export async function normaliseRdmStreamingMessage(
  feed: RdmStreamingFeed,
  payload: unknown,
  receivedAt: string,
): Promise<RdmStreamingNormaliseResult> {
  if (feed === RDM_REALTIME_FEED_NAME) {
    const result = await normaliseRdmRealtimeEnvelope(payload, receivedAt);
    return {
      ...result,
      events: withRawSourceOnFirstEvent(result.events, {
        sourceKey: RDM_REALTIME_SOURCE_KEY,
        receivedAt,
        payload,
        topic: result.events[0]?.topic ?? RDM_REALTIME_FEED_NAME,
        occurredAt: result.events[0]?.occurredAt ?? null,
      }),
    };
  }

  const movements = Array.isArray(payload) ? payload : [payload];
  const events: RailEvent[] = [];
  const ignoredReasons: string[] = [];

  for (const movement of movements) {
    const result = await normaliseRdmTrainMovement(movement, receivedAt);
    if (result.event) {
      events.push(
        withRawSourceEvent(result.event, {
          sourceKey: RDM_TRAIN_MOVEMENTS_SOURCE_KEY,
          receivedAt,
          payload: movement,
          topic: result.event.topic,
          occurredAt: result.event.occurredAt,
        }),
      );
    }
    if (result.ignored && result.reason) ignoredReasons.push(result.reason);
  }

  return {
    events,
    ignored: events.length === 0 && ignoredReasons.length > 0,
    reason: ignoredReasons[0],
  };
}

export async function buildRdmRawEventRowsFromRailEvent(
  event: RailEvent,
): Promise<RdmRawEventWrite[]> {
  const raw = readRawSourceEvent(event);
  if (!raw) return [];

  return buildRdmRawEventRows(raw.sourceKey, raw.receivedAt, [
    {
      payload: raw.payload,
      topic: raw.topic,
      occurredAt: raw.occurredAt,
    },
  ]);
}

export function feedNameForRdmStreamingEvent(event: RailEvent): RdmStreamingFeed | null {
  const product = stringValue(event.payload.product);
  if (product === RDM_REALTIME_FEED_NAME) return RDM_REALTIME_FEED_NAME;
  if (product === RDM_TRAIN_MOVEMENTS_FEED_NAME) return RDM_TRAIN_MOVEMENTS_FEED_NAME;
  return null;
}

function withRawSourceOnFirstEvent(events: RailEvent[], raw: RdmRawSourceEvent): RailEvent[] {
  if (events.length === 0) return [];
  const [first, ...rest] = events;
  return [withRawSourceEvent(first, raw), ...rest];
}

function withRawSourceEvent(event: RailEvent, raw: RdmRawSourceEvent): RailEvent {
  return {
    ...event,
    payload: {
      ...event.payload,
      [RAW_SOURCE_EVENT_KEY]: raw,
    },
  };
}

function readRawSourceEvent(event: RailEvent): RdmRawSourceEvent | null {
  const raw = event.payload[RAW_SOURCE_EVENT_KEY];
  if (!isRecord(raw)) return null;

  const sourceKey = stringValue(raw.sourceKey);
  const receivedAt = stringValue(raw.receivedAt);
  if (!sourceKey || !receivedAt || !("payload" in raw)) return null;

  return {
    sourceKey,
    receivedAt,
    payload: raw.payload,
    topic: stringValue(raw.topic) ?? null,
    occurredAt: stringValue(raw.occurredAt) ?? null,
  };
}
