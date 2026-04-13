import type { RailEvent, RailEventType } from "@zawa/domain/events";
import { toMovementServiceKey, toTrainRunKey } from "@zawa/domain/keys";
import { sha1Hex } from "@zawa/shared/hash";
import { isJsonObject } from "@zawa/shared/json";
import { epochMillisToIso } from "@zawa/shared/time";
import { stringValue } from "@zawa/shared/values";

interface RdmTrainMovementMessage {
  header?: {
    msg_type?: string;
    msg_queue_timestamp?: string;
    source_system_id?: string;
    original_data_source?: string;
  };
  body?: {
    train_id?: string;
    train_uid?: string;
    actual_timestamp?: string;
    gbtt_timestamp?: string;
    planned_timestamp?: string;
    planned_event_type?: string;
    event_type?: string;
    platform?: string;
    route?: string;
    line_ind?: string;
    loc_stanox?: string;
    reporting_stanox?: string;
    toc_id?: string;
    train_service_code?: string;
    timetable_variation?: string;
    variation_status?: string;
    train_terminated?: string;
    auto_expected?: string;
  };
}

export interface RdmTrainMovementNormaliseResult {
  event: RailEvent | null;
  ignored: boolean;
  reason?: string;
}

export async function normaliseRdmTrainMovement(
  value: unknown,
  nowIso: string,
): Promise<RdmTrainMovementNormaliseResult> {
  const message = parseMovementMessage(value);
  if (!message?.body?.train_id) {
    return { event: null, ignored: true, reason: "Invalid RDM train movement message" };
  }

  const occurredAt =
    epochMillisToIso(message.body.actual_timestamp) ??
    epochMillisToIso(message.header?.msg_queue_timestamp) ??
    nowIso;
  const serviceDate = occurredAt.slice(0, 10);
  const serviceKey = toMovementServiceKey({
    trainId: message.body.train_id,
    date: serviceDate,
  });
  const trainRunKey = toTrainRunKey({
    trainId: message.body.train_id,
    date: serviceDate,
  });
  const type = movementEventType(message);
  const payload = {
    product: "rdm-train-movements",
    messageType: message.header?.msg_type,
    sourceSystem: message.header?.source_system_id,
    originalDataSource: message.header?.original_data_source,
    trainId: message.body.train_id,
    trainUid: message.body.train_uid,
    toc: message.body.toc_id,
    trainServiceCode: message.body.train_service_code,
    stanox: message.body.loc_stanox,
    reportingStanox: message.body.reporting_stanox,
    platform: cleanPlatform(message.body.platform),
    path: message.body.route,
    line: message.body.line_ind,
    plannedEventType: message.body.planned_event_type,
    eventType: message.body.event_type,
    plannedTimestamp: epochMillisToIso(message.body.planned_timestamp),
    gbttTimestamp: epochMillisToIso(message.body.gbtt_timestamp),
    actualTimestamp: epochMillisToIso(message.body.actual_timestamp),
    timetableVariationMinutes: numberString(message.body.timetable_variation),
    variationStatus: message.body.variation_status,
    autoExpected: booleanString(message.body.auto_expected),
  };

  return {
    event: {
      id: await sha1Hex(JSON.stringify({ type, payload })),
      source: "rdm",
      topic: "rdm-train-movements",
      type,
      occurredAt,
      ingestedAt: nowIso,
      serviceKey,
      trainRunKey,
      payloadVersion: 1,
      payload,
    },
    ignored: false,
  };
}

function parseMovementMessage(value: unknown): RdmTrainMovementMessage | null {
  if (!isJsonObject(value) || Array.isArray(value)) return null;
  const header = isJsonObject(value.header)
    ? {
        msg_type: stringValue(value.header.msg_type),
        msg_queue_timestamp: stringValue(value.header.msg_queue_timestamp),
        source_system_id: stringValue(value.header.source_system_id),
        original_data_source: stringValue(value.header.original_data_source),
      }
    : undefined;
  const body = isJsonObject(value.body)
    ? {
        train_id: stringValue(value.body.train_id),
        train_uid: stringValue(value.body.train_uid),
        actual_timestamp: stringValue(value.body.actual_timestamp),
        gbtt_timestamp: stringValue(value.body.gbtt_timestamp),
        planned_timestamp: stringValue(value.body.planned_timestamp),
        planned_event_type: stringValue(value.body.planned_event_type),
        event_type: stringValue(value.body.event_type),
        platform: stringValue(value.body.platform),
        route: stringValue(value.body.route),
        line_ind: stringValue(value.body.line_ind),
        loc_stanox: stringValue(value.body.loc_stanox),
        reporting_stanox: stringValue(value.body.reporting_stanox),
        toc_id: stringValue(value.body.toc_id),
        train_service_code: stringValue(value.body.train_service_code),
        timetable_variation: stringValue(value.body.timetable_variation),
        variation_status: stringValue(value.body.variation_status),
        train_terminated: stringValue(value.body.train_terminated),
        auto_expected: stringValue(value.body.auto_expected),
      }
    : undefined;

  return { header, body };
}

function movementEventType(message: RdmTrainMovementMessage): RailEventType {
  if (booleanString(message.body?.train_terminated)) return "service.terminated";
  return "service.location.updated";
}

function cleanPlatform(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function booleanString(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return undefined;
}

function numberString(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
