import { setTimeout as delay } from "node:timers/promises";

import { localD1Path, queryRows, sqlString } from "./local-d1.mjs";

const dbPath = localD1Path();
const edgeUrl = process.env.LOCAL_EDGE_URL ?? "http://localhost:8787";
const maxAttempts = 100;
const pollTimeoutMs = 30_000;

const serviceKeys = queryRows(
  dbPath,
  `
    SELECT service_key
    FROM station_board_entries
    WHERE service_key IS NOT NULL
    GROUP BY service_key
    ORDER BY MAX(updated_at) DESC
    LIMIT ${maxAttempts}
  `,
).map((row) => String(row.service_key));

if (serviceKeys.length === 0) {
  throw new Error(
    "No station_board_entries service keys found. Run pnpm e2e:trigger:scheduled first.",
  );
}

for (const serviceKey of serviceKeys) {
  const url = `${edgeUrl}/api/services/${encodeURIComponent(serviceKey)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) }).catch((error) => {
    console.warn(`WARN: ${serviceKey} request failed: ${error.message}`);
    return null;
  });

  if (!response) continue;

  if (!response.ok) {
    console.warn(`WARN: ${serviceKey} returned HTTP ${response.status}`);
    continue;
  }

  await response.arrayBuffer();

  const projection = await waitForServiceProjection(serviceKey);
  if (projection.service_call_points > 0 && projection.service_coaches > 0) {
    console.log(JSON.stringify({ dbPath, edgeUrl, serviceKey, ...projection }, null, 2));
    console.log("Local service detail projection passed.");
    process.exit(0);
  }

  console.warn(
    `WARN: ${serviceKey} projected stops=${projection.service_call_points}, formations=${projection.service_formations}, coaches=${projection.service_coaches}`,
  );
}

throw new Error(
  "No recent board service projected both service_call_points and service_coaches. Run pnpm dev so edge and projector share the queue consumer, then retry with fresher board data.",
);

async function waitForServiceProjection(serviceKey) {
  const deadline = Date.now() + pollTimeoutMs;
  let latest = serviceProjectionCounts(serviceKey);

  while (Date.now() <= deadline) {
    latest = serviceProjectionCounts(serviceKey);
    if (latest.service_call_points > 0 && latest.service_coaches > 0) return latest;
    await delay(500);
  }

  return latest;
}

function serviceProjectionCounts(serviceKey) {
  return Object.fromEntries(
    queryRows(
      dbPath,
      `
        SELECT 'service_call_points' AS name, COUNT(*) AS count
        FROM service_call_points
        WHERE service_key = ${sqlString(serviceKey)}
        UNION ALL SELECT 'service_formations', COUNT(*)
        FROM service_formations
        WHERE service_key = ${sqlString(serviceKey)}
        UNION ALL SELECT 'service_coaches', COUNT(*)
        FROM service_coaches
        WHERE service_key = ${sqlString(serviceKey)}
      `,
    ).map((row) => [row.name, Number(row.count)]),
  );
}
