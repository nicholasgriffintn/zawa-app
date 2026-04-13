import { sha1Hex } from "@zawa/shared/hash";

export interface RdmRawEventWrite {
  event_id: string;
  source_key: string;
  message_id: string | null;
  topic: string | null;
  occurred_at: string | null;
  received_at: string;
  payload_json: string;
}

export interface RdmRawPayload {
  payload: unknown;
  topic: string | null;
  occurredAt: string | null;
}

export async function buildRdmRawEventRows(
  sourceKey: string,
  receivedAt: string,
  payloads: RdmRawPayload[],
): Promise<RdmRawEventWrite[]> {
  const rows: RdmRawEventWrite[] = [];

  for (const [index, payload] of payloads.entries()) {
    const payloadJson = JSON.stringify(payload.payload) ?? "null";
    const payloadHash = await sha1Hex(payloadJson);
    rows.push({
      event_id: await sha1Hex(
        JSON.stringify({
          sourceKey,
          receivedAt,
          index,
          payloadHash,
        }),
      ),
      source_key: sourceKey,
      message_id: payloadHash,
      topic: payload.topic,
      occurred_at: payload.occurredAt,
      received_at: receivedAt,
      payload_json: payloadJson,
    });
  }

  return rows;
}
