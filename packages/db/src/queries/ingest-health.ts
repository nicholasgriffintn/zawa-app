import type { D1DatabaseLike } from "../d1";

export async function markIngestConnected(
  db: D1DatabaseLike,
  feedName: string,
  nowIso: string,
  lastEventId: string,
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO ingest_feeds (
        feed_name, connection_started_at, last_message_at, last_event_id,
        reconnect_count, health_state, updated_at
      )
      VALUES (?, ?, ?, ?, 0, 'connected', ?)
      ON CONFLICT(feed_name) DO UPDATE SET
        connection_started_at = COALESCE(ingest_feeds.connection_started_at, excluded.connection_started_at),
        last_message_at = excluded.last_message_at,
        last_event_id = excluded.last_event_id,
        health_state = excluded.health_state,
        updated_at = excluded.updated_at
    `,
    )
    .bind(feedName, nowIso, nowIso, lastEventId, nowIso)
    .run();
}

export async function markIngestError(
  db: D1DatabaseLike,
  feedName: string,
  nowIso: string,
  errorMessage: string,
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO ingest_feeds (
        feed_name, connection_started_at, last_message_at, last_event_id,
        reconnect_count, health_state, updated_at
      )
      VALUES (?, ?, ?, ?, 1, 'error', ?)
      ON CONFLICT(feed_name) DO UPDATE SET
        reconnect_count = ingest_feeds.reconnect_count + 1,
        health_state = excluded.health_state,
        last_event_id = excluded.last_event_id,
        updated_at = excluded.updated_at
    `,
    )
    .bind(feedName, nowIso, nowIso, `error:${errorMessage}`, nowIso)
    .run();
}
