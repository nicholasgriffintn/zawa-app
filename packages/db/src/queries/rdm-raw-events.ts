import type { D1DatabaseLike } from "../d1";
import { recordSourceEventThings } from "./ontology";

export interface RdmRawEventWrite {
  event_id: string;
  source_key: string;
  message_id: string | null;
  topic: string | null;
  occurred_at: string | null;
  received_at: string;
  payload_json: string;
}

export async function insertRdmRawEvents(
  db: D1DatabaseLike,
  rows: RdmRawEventWrite[],
): Promise<void> {
  await recordSourceEventThings(
    db,
    rows.map((row) => ({
      eventId: row.event_id,
      sourceKey: row.source_key,
      messageId: row.message_id,
      topic: row.topic,
      eventType: null,
      thingId: null,
      occurredAt: row.occurred_at,
      receivedAt: row.received_at,
      payloadJson: row.payload_json,
    })),
  );
}
