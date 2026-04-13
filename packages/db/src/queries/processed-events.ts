import { type D1DatabaseLike, writeAccepted } from "../d1";

export async function hasProcessedEvent(db: D1DatabaseLike, eventId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT event_id FROM projection_claims WHERE event_id = ?")
    .bind(eventId)
    .first<{ event_id: string }>();

  return !!row;
}

export async function markProcessedEvent(
  db: D1DatabaseLike,
  eventId: string,
  nowIso: string,
): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO projection_claims (event_id, processed_at) VALUES (?, ?)")
    .bind(eventId, nowIso)
    .run();
}

export async function claimProcessedEvent(
  db: D1DatabaseLike,
  eventId: string,
  nowIso: string,
): Promise<boolean> {
  const result = await db
    .prepare("INSERT OR IGNORE INTO projection_claims (event_id, processed_at) VALUES (?, ?)")
    .bind(eventId, nowIso)
    .run();

  return writeAccepted(result);
}

export async function releaseProcessedEvent(db: D1DatabaseLike, eventId: string): Promise<void> {
  await db.prepare("DELETE FROM projection_claims WHERE event_id = ?").bind(eventId).run();
}
