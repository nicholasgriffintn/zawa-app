import { localD1Path, queryRows } from "./local-d1.mjs";

const dbPath = localD1Path();
const verifyStreaming = process.env.E2E_VERIFY_STREAMING === "1";

const counts = Object.fromEntries(
  queryRows(
    dbPath,
    `
    SELECT 'station_profiles' AS name, COUNT(*) AS count FROM station_profiles
    UNION ALL SELECT 'station_profiles_enriched', COUNT(*) FROM station_profiles
      WHERE profile_hash IS NOT NULL OR profile_checked_at IS NOT NULL
    UNION ALL SELECT 'operators', COUNT(*) FROM operators
    UNION ALL SELECT 'operator_statuses', COUNT(*) FROM operator_statuses
    UNION ALL SELECT 'operator_disruptions', COUNT(*) FROM operator_disruptions
    UNION ALL SELECT 'network_incidents', COUNT(*) FROM network_incidents
    UNION ALL SELECT 'network_incident_operators', COUNT(*) FROM network_incident_operators
    UNION ALL SELECT 'station_disruptions', COUNT(*) FROM station_disruptions
    UNION ALL SELECT 'station_board_refreshes', COUNT(*) FROM station_board_refreshes
    UNION ALL SELECT 'station_board_refreshed', COUNT(*) FROM station_board_refreshes
      WHERE last_refreshed_at IS NOT NULL
    UNION ALL SELECT 'station_board_entries', COUNT(*) FROM station_board_entries
    UNION ALL SELECT 'service_journeys', COUNT(*) FROM service_journeys
    UNION ALL SELECT 'service_call_points', COUNT(*) FROM service_call_points
    UNION ALL SELECT 'service_formations', COUNT(*) FROM service_formations
    UNION ALL SELECT 'service_coaches', COUNT(*) FROM service_coaches
    UNION ALL SELECT 'source_events', COUNT(*) FROM source_events
    UNION ALL SELECT 'train_movements', COUNT(*) FROM train_movements
    UNION ALL SELECT 'station_messages', COUNT(*) FROM station_messages
    UNION ALL SELECT 'ontology_quality_runs', COUNT(*) FROM ontology_quality_runs
    UNION ALL SELECT 'ontology_quality_violations', COUNT(*) FROM ontology_quality_violations
    UNION ALL SELECT 'things', COUNT(*) FROM things
    UNION ALL SELECT 'ontology_triples', COUNT(*) FROM ontology_triples
  `,
  ).map((row) => [row.name, Number(row.count)]),
);

const syncStates = new Map(
  queryRows(
    dbPath,
    `
    SELECT sync_key, status, item_count, last_checked_at, error_message
    FROM source_sync_runs
  `,
  ).map((row) => [row.sync_key, row]),
);

const failures = [];
const warnings = [];

expectPositive("station_profiles", "reference data did not populate station_profiles");
expectPositive("operators", "reference data did not populate operators");
expectPositive("station_profiles_enriched", "station profile cron did not enrich any stations");
expectPositive("operator_statuses", "operator status cron did not populate operator_statuses");
expectPositive("station_board_refreshed", "board refresh cron did not mark any boards refreshed");
expectPositive("station_board_entries", "projector did not write station_board_entries");
expectPositive("service_journeys", "projector did not write service_journeys");
expectPositive(
  "service_call_points",
  "service detail e2e did not project service_call_points; run pnpm dev and pnpm e2e:trigger:service-detail",
);
expectPositive("service_formations", "service detail e2e did not project service_formations");
expectPositive("service_coaches", "service detail e2e did not project service_coaches");
if (verifyStreaming) {
  expectPositive("source_events", "realtime/train-movement producer did not record source_events");
  expectPositive("train_movements", "train-movement producer did not project train_movements");
  expectPositive("station_messages", "realtime producer did not project station_messages");
} else {
  warnIfEmpty("source_events", "source_events is empty; run streaming verification separately");
  warnIfEmpty("train_movements", "train_movements is empty; run streaming verification separately");
  warnIfEmpty(
    "station_messages",
    "station_messages is empty; run streaming verification separately",
  );
}
expectPositive(
  "ontology_quality_runs",
  "ontology quality cron did not record ontology_quality_runs",
);
expectPositive("things", "ontology things were not populated");
expectPositive("ontology_triples", "ontology triples were not populated");

for (const syncKey of [
  "rdm.station-list",
  "rdm.toc-list",
  "rdm.loading-categories",
  "rdm.reason-codes",
  "rdm.source-instance-names",
  "rdm.national-service-indicator",
  "rdm.incidents",
  "rdm.station-board-refresh",
]) {
  expectSyncStatus(syncKey, ["ok"]);
}

expectSyncStatus("rdm.station-profiles", ["ok", "partial_error"]);
expectSyncStatus("rdm.station-disruptions", ["ok", "partial_error"]);

if (counts.network_incidents === 0) {
  warnings.push("network_incidents is empty; this can be valid when RDM has no active incidents");
}

if (counts.station_disruptions === 0) {
  warnings.push(
    "station_disruptions is empty; this can be valid when checked stations have no disruptions",
  );
}

console.log(
  JSON.stringify({ dbPath, counts, syncStates: Object.fromEntries(syncStates) }, null, 2),
);

for (const warning of warnings) {
  console.warn(`WARN: ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log("Local e2e D1 verification passed.");

function expectPositive(key, message) {
  if ((counts[key] ?? 0) <= 0) {
    failures.push(message);
  }
}

function warnIfEmpty(key, message) {
  if ((counts[key] ?? 0) <= 0) {
    warnings.push(message);
  }
}

function expectSyncStatus(syncKey, allowedStatuses) {
  const state = syncStates.get(syncKey);
  if (!state) {
    failures.push(`source_sync_runs is missing ${syncKey}`);
    return;
  }

  if (!allowedStatuses.includes(state.status)) {
    failures.push(`${syncKey} status is ${state.status}; expected ${allowedStatuses.join(" or ")}`);
  }

  if (!state.last_checked_at) {
    failures.push(`${syncKey} has no last_checked_at`);
  }
}
