import { upsertStationMessageCurrent } from "@zawa/db/queries/operational-data";
import type { D1DatabaseLike } from "@zawa/db/d1";
import type { RailEvent } from "@zawa/domain/events";
import { toStationKey } from "@zawa/domain/keys";
import { sha1Hex } from "@zawa/shared/hash";
import {
  isRecord,
  recordArray,
  stringOrNull,
  stringOrNumberValue,
  stringValue,
} from "@zawa/shared/values";

interface StationMessageProjection {
  station_key: string;
  category: string | null;
  severity: string | null;
  message_html: string;
}

export async function projectStationMessageEvent(
  db: D1DatabaseLike,
  event: RailEvent,
): Promise<number> {
  if (event.type !== "rdm.realtime.station.message.updated") return 0;

  const messages = stationMessagesFromPayload(event.payload.body);
  for (const message of messages) {
    await upsertStationMessageCurrent(db, {
      ...message,
      message_hash: await sha1Hex(
        JSON.stringify({
          stationKey: message.station_key,
          category: message.category,
          severity: message.severity,
          messageHtml: message.message_html,
        }),
      ),
      generated_at: event.occurredAt,
      updated_at: event.ingestedAt,
    });
  }

  return messages.length;
}

function stationMessagesFromPayload(value: unknown): StationMessageProjection[] {
  const candidates = stationMessageCandidates(value);
  return candidates.flatMap((candidate) => {
    const stationKey = stationKeyFromRecord(candidate);
    const messageHtml = messageHtmlFromRecord(candidate);
    if (!stationKey || !messageHtml) return [];

    return [
      {
        station_key: stationKey,
        category: stringOrNull(candidate.category ?? candidate.type ?? candidate.reason),
        severity: stringOrNull(candidate.severity ?? candidate.priority),
        message_html: messageHtml,
      },
    ];
  });
}

function stationMessageCandidates(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(stationMessageCandidates);
  if (!isRecord(value)) return [];

  const nested = [
    ...recordArray(value.messages),
    ...recordArray(value.message),
    ...recordArray(value.stationMessages),
    ...recordArray(value.StationMessage),
  ];
  if (nested.length === 0) return [value];

  return nested.map((message) => ({
    ...value,
    ...message,
  }));
}

function stationKeyFromRecord(record: Record<string, unknown>): string | null {
  const value =
    stringValue(record.station_key) ??
    stringValue(record.stationKey) ??
    stringValue(record.crs) ??
    stringValue(record.CRS) ??
    stringValue(record.crsCode) ??
    stringValue(record.stationCrs) ??
    stringValue(record.stationCRS) ??
    stringValue(record.stationCode);

  return value ? toStationKey(value) : null;
}

function messageHtmlFromRecord(record: Record<string, unknown>): string | null {
  return (
    stringValue(record.xhtmlMessage) ??
    stringValue(record.messageHtml) ??
    stringValue(record.html) ??
    stringValue(record.message) ??
    stringValue(record.text) ??
    stringOrNumberValue(record.Value) ??
    stringOrNumberValue(record.value) ??
    null
  );
}
