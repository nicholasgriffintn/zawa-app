import type { D1DatabaseLike } from "../d1";

export interface DashboardMetricRow {
  station_count: number;
  visible_service_count: number;
  delayed_service_count: number;
  cancelled_service_count: number;
  active_incident_count: number;
  operator_count: number;
  operator_issue_count: number;
  last_updated_at: string | null;
}

export interface DashboardStationRow {
  station_key: string;
  station_name: string | null;
  service_count: number;
  delayed_service_count: number;
  next_scheduled_ts: string | null;
  last_updated_at: string | null;
}

export interface DashboardServiceRow {
  station_key: string;
  station_name: string | null;
  board_type: string;
  service_key: string;
  scheduled_ts: string | null;
  expected_ts: string | null;
  platform: string | null;
  destination_name: string | null;
  operator_code: string | null;
  status: string;
  updated_at: string;
}

export interface DashboardIncidentRow {
  incident_id: string;
  priority: number | null;
  summary: string | null;
  description_html: string | null;
  start_at: string | null;
  end_at: string | null;
  routes_affected_html: string | null;
  info_link_url: string | null;
  info_link_label: string | null;
  updated_at: string;
  operator_names: string | null;
}

export interface DashboardOperatorStatusRow {
  toc_code: string;
  toc_name: string | null;
  status: string;
  status_description: string | null;
  updated_at: string;
}

export interface DashboardSyncStateRow {
  source_key: string;
  status: string;
  item_count: number;
  last_checked_at: string;
  last_changed_at: string | null;
  error_message: string | null;
}

export interface DashboardSummary {
  metrics: DashboardMetricRow;
  popularStations: DashboardStationRow[];
  nextServices: DashboardServiceRow[];
  incidents: DashboardIncidentRow[];
  operatorStatuses: DashboardOperatorStatusRow[];
  syncStates: DashboardSyncStateRow[];
}

export async function getDashboardSummary(
  db: D1DatabaseLike,
  nowIso: string,
  activeSinceIso: string,
): Promise<DashboardSummary> {
  const [metrics, popularStations, nextServices, incidents, operatorStatuses, syncStates] =
    await Promise.all([
      getDashboardMetrics(db, activeSinceIso, nowIso),
      getPopularStations(db, activeSinceIso),
      getNextServices(db, nowIso),
      getActiveIncidents(db, nowIso),
      getOperatorStatuses(db),
      getSyncStates(db),
    ]);

  return {
    metrics,
    popularStations,
    nextServices,
    incidents,
    operatorStatuses,
    syncStates,
  };
}

async function getDashboardMetrics(
  db: D1DatabaseLike,
  activeSinceIso: string,
  nowIso: string,
): Promise<DashboardMetricRow> {
  const row = await db
    .prepare(
      `
      SELECT
        (
          SELECT COUNT(*)
          FROM (
            SELECT station_key FROM station_profiles WHERE is_active = 1
            UNION
            SELECT DISTINCT station_key
            FROM station_board_entries
            WHERE COALESCE(expected_ts, scheduled_ts, updated_at) >= ?
          )
        ) AS station_count,
        (
          SELECT COUNT(DISTINCT service_key)
          FROM station_board_entries
          WHERE COALESCE(expected_ts, scheduled_ts, updated_at) >= ?
        ) AS visible_service_count,
        (
          SELECT COUNT(DISTINCT service_key)
          FROM station_board_entries
          WHERE expected_ts IS NOT NULL
            AND scheduled_ts IS NOT NULL
            AND expected_ts > scheduled_ts
            AND COALESCE(expected_ts, scheduled_ts, updated_at) >= ?
        ) AS delayed_service_count,
        (
          SELECT COUNT(DISTINCT service_key)
          FROM station_board_entries
          WHERE (status LIKE '%cancelled%' OR status LIKE '%terminated%')
            AND COALESCE(expected_ts, scheduled_ts, updated_at) >= ?
        ) AS cancelled_service_count,
        (
          SELECT COUNT(*)
          FROM network_incidents
          WHERE is_active = 1
            AND (start_at IS NULL OR datetime(start_at) <= datetime(?))
            AND (end_at IS NULL OR datetime(end_at) >= datetime(?))
        ) AS active_incident_count,
        (SELECT COUNT(*) FROM operator_statuses) AS operator_count,
        (
          SELECT COUNT(*)
          FROM operator_statuses
          WHERE LOWER(status) NOT IN ('good service', 'good', 'normal')
        ) AS operator_issue_count,
        (
          SELECT MAX(updated_at)
          FROM (
            SELECT MAX(updated_at) AS updated_at FROM station_board_entries
            UNION ALL SELECT MAX(updated_at) FROM network_incidents
            UNION ALL SELECT MAX(updated_at) FROM operator_statuses
            UNION ALL SELECT MAX(last_checked_at) FROM source_sync_runs
          )
        ) AS last_updated_at
    `,
    )
    .bind(activeSinceIso, activeSinceIso, activeSinceIso, activeSinceIso, nowIso, nowIso)
    .first<DashboardMetricRow>();

  return (
    row ?? {
      station_count: 0,
      visible_service_count: 0,
      delayed_service_count: 0,
      cancelled_service_count: 0,
      active_incident_count: 0,
      operator_count: 0,
      operator_issue_count: 0,
      last_updated_at: null,
    }
  );
}

async function getPopularStations(
  db: D1DatabaseLike,
  activeSinceIso: string,
): Promise<DashboardStationRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        station_keys.station_key,
        station_profiles.station_name,
        COUNT(DISTINCT station_board_entries.service_key) AS service_count,
        COUNT(DISTINCT CASE
          WHEN station_board_entries.expected_ts IS NOT NULL
            AND station_board_entries.scheduled_ts IS NOT NULL
            AND station_board_entries.expected_ts > station_board_entries.scheduled_ts
          THEN station_board_entries.service_key
        END) AS delayed_service_count,
        MIN(station_board_entries.scheduled_ts) AS next_scheduled_ts,
        MAX(station_board_entries.updated_at) AS last_updated_at
      FROM (
        SELECT station_key FROM station_profiles WHERE is_active = 1
        UNION
        SELECT DISTINCT station_key
        FROM station_board_entries
        WHERE COALESCE(expected_ts, scheduled_ts, updated_at) >= ?
      ) station_keys
      LEFT JOIN station_profiles
        ON station_profiles.station_key = station_keys.station_key
      LEFT JOIN station_board_entries
        ON station_board_entries.station_key = station_keys.station_key
        AND COALESCE(
          station_board_entries.expected_ts,
          station_board_entries.scheduled_ts,
          station_board_entries.updated_at
        ) >= ?
      GROUP BY station_keys.station_key, station_profiles.station_name
      ORDER BY service_count DESC, last_updated_at DESC, station_profiles.station_name ASC, station_keys.station_key ASC
      LIMIT 8
    `,
    )
    .bind(activeSinceIso, activeSinceIso)
    .all<DashboardStationRow>();

  return result.results;
}

async function getNextServices(db: D1DatabaseLike, nowIso: string): Promise<DashboardServiceRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        board.station_key,
        station_profiles.station_name,
        board.board_type,
        board.service_key,
        board.scheduled_ts,
        board.expected_ts,
        board.platform,
        board.destination_name,
        services.operator_code,
        board.status,
        board.updated_at
      FROM station_board_entries board
      LEFT JOIN station_profiles ON station_profiles.station_key = board.station_key
      LEFT JOIN service_journeys services ON services.service_key = board.service_key
      WHERE board.board_type = 'departures'
        AND COALESCE(board.expected_ts, board.scheduled_ts, board.updated_at) >= ?
      ORDER BY COALESCE(board.expected_ts, board.scheduled_ts, board.updated_at) ASC
      LIMIT 10
    `,
    )
    .bind(nowIso)
    .all<DashboardServiceRow>();

  return result.results;
}

async function getActiveIncidents(
  db: D1DatabaseLike,
  nowIso: string,
): Promise<DashboardIncidentRow[]> {
  const result = await db
    .prepare(
      `
      SELECT
        incidents.incident_id,
        incidents.priority,
        incidents.summary,
        incidents.description_html,
        incidents.start_at,
        incidents.end_at,
        incidents.routes_affected_html,
        incidents.info_link_url,
        incidents.info_link_label,
        incidents.updated_at,
        GROUP_CONCAT(
          COALESCE(incident_operators.operator_name, incident_operators.operator_code),
          ', '
        ) AS operator_names
      FROM network_incidents incidents
      LEFT JOIN network_incident_operators incident_operators
        ON incident_operators.incident_id = incidents.incident_id
      WHERE incidents.is_active = 1
        AND (incidents.start_at IS NULL OR datetime(incidents.start_at) <= datetime(?))
        AND (incidents.end_at IS NULL OR datetime(incidents.end_at) >= datetime(?))
      GROUP BY
        incidents.incident_id,
        incidents.priority,
        incidents.summary,
        incidents.description_html,
        incidents.start_at,
        incidents.end_at,
        incidents.routes_affected_html,
        incidents.info_link_url,
        incidents.info_link_label,
        incidents.updated_at
      ORDER BY incidents.priority ASC, incidents.updated_at DESC
      LIMIT 6
    `,
    )
    .bind(nowIso, nowIso)
    .all<DashboardIncidentRow>();

  return result.results;
}

async function getOperatorStatuses(db: D1DatabaseLike): Promise<DashboardOperatorStatusRow[]> {
  const result = await db
    .prepare(
      `
      SELECT toc_code, toc_name, status, status_description, updated_at
      FROM operator_statuses
      ORDER BY
        CASE WHEN LOWER(status) IN ('good service', 'good', 'normal') THEN 1 ELSE 0 END,
        updated_at DESC,
        toc_name ASC
      LIMIT 8
    `,
    )
    .all<DashboardOperatorStatusRow>();

  return result.results;
}

async function getSyncStates(db: D1DatabaseLike): Promise<DashboardSyncStateRow[]> {
  const result = await db
    .prepare(
      `
      SELECT sync_key AS source_key, status, item_count, last_checked_at, last_changed_at, error_message
      FROM source_sync_runs
      ORDER BY last_checked_at DESC
      LIMIT 6
    `,
    )
    .all<DashboardSyncStateRow>();

  return result.results;
}
