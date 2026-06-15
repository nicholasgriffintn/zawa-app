import type { D1DatabaseLike } from "@zawa/db/d1";

interface HealthRoutesEnv {
  DB: D1DatabaseLike;
  INGEST_HEARTBEAT_SECONDS: string;
}

interface FeedHealthRow {
  feed_name: string;
  connection_started_at: string | null;
  last_message_at: string | null;
  last_event_id: string | null;
  reconnect_count: number;
  health_state: string;
  updated_at: string;
}

const SCHEDULED_FEED_NAMES = ["rdm-sync", "rdm"] as const;
const STREAMING_FEED_NAMES = ["rdm-realtime", "rdm-train-movements"] as const;

export async function handleHealthRoutes(
  request: Request,
  env: HealthRoutesEnv,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (url.pathname === "/health/live") {
    return Response.json({ ok: true });
  }

  const rows = await env.DB.prepare(`
    SELECT feed_name, connection_started_at, last_message_at, last_event_id, reconnect_count, health_state, updated_at
    FROM ingest_feeds
    WHERE feed_name IN ('rdm-sync', 'rdm', 'rdm-realtime', 'rdm-train-movements')
  `).all<FeedHealthRow>();

  const heartbeatSeconds = Number(env.INGEST_HEARTBEAT_SECONDS) || 30;
  const staleAfterMs = Math.max(heartbeatSeconds * 3 * 1_000, 90_000);
  const feedRows = rows.results;
  const scheduledFeed = currentScheduledFeed(feedRows);
  const streamingFeeds = STREAMING_FEED_NAMES.map((feedName) =>
    feedHealth(feedRows.find((row) => row.feed_name === feedName) ?? null, staleAfterMs),
  );
  const scheduled = feedHealth(scheduledFeed, staleAfterMs);

  return Response.json({
    feed: scheduled.row,
    feeds: {
      scheduled,
      streaming: streamingFeeds,
    },
    staleAfterSeconds: staleAfterMs / 1_000,
  });
}

function currentScheduledFeed(rows: FeedHealthRow[]): FeedHealthRow | null {
  for (const feedName of SCHEDULED_FEED_NAMES) {
    const row = rows.find((candidate) => candidate.feed_name === feedName);
    if (row) return row;
  }

  return null;
}

function feedHealth(
  row: FeedHealthRow | null,
  staleAfterMs: number,
): {
  feedName: string | null;
  ok: boolean;
  fresh: boolean;
  row: FeedHealthRow | null;
} {
  const lastMessageAt = row?.last_message_at ? Date.parse(row.last_message_at) : 0;
  const fresh = lastMessageAt > 0 && Date.now() - lastMessageAt <= staleAfterMs;

  return {
    feedName: row?.feed_name ?? null,
    ok: Boolean(row && row.health_state === "connected" && fresh),
    fresh,
    row,
  };
}
