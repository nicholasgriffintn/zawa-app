import type { RailEvent } from "@zawa/domain/events";
import { markIngestConnected, markIngestError } from "@zawa/db/queries/ingest-health";
import {
  replaceIncidents,
  replaceOperatorStatuses,
  replaceStationDisruptions,
  upsertStationProfiles,
  type IncidentWrite,
  type OperatorStatusWrite,
  type StationDisruptionGroupWrite,
  type StationProfileWrite,
} from "@zawa/db/queries/operational-data";
import {
  getRdmSyncState,
  listReferenceStationsAfter,
  replaceReferenceLoadingCategories,
  replaceReferenceReasonCodes,
  replaceReferenceSourceInstances,
  replaceReferenceStations,
  replaceReferenceTocs,
  upsertRdmSyncState,
  type ReferenceLoadingCategoryWrite,
  type ReferenceReasonCodeWrite,
  type ReferenceSourceInstanceWrite,
  type ReferenceStationWrite,
  type ReferenceTocWrite,
} from "@zawa/db/queries/reference-data";
import {
  listStationBoardsDueForRefresh,
  markStationBoardRefreshRequests,
} from "@zawa/db/queries/stations";
import { stationBoardRefreshEvent } from "@zawa/rdm/projection-events";
import { validateOntologyQuality } from "@zawa/ontology";
import { RdmHttpError } from "@zawa/rdm/http";
import {
  fetchRdmLoadingCategoryList,
  fetchRdmReasonCodeList,
  fetchRdmSourceInstanceNames,
  fetchRdmStationList,
  fetchRdmTocList,
  type RdmReferencePayload,
} from "@zawa/rdm/reference";
import {
  fetchRdmIncidents,
  fetchRdmNationalServiceIndicator,
  fetchRdmStationProfile,
  type RdmIncident,
  type RdmKnowledgebaseEnv,
  type RdmStationProfile,
} from "@zawa/rdm/xml-products";
import { withTimeout } from "@zawa/shared/async";
import { sha1Hex } from "@zawa/shared/hash";
import { nowIso } from "@zawa/shared/time";
import { positiveIntegerValue } from "@zawa/shared/values";

import { fetchStationDisruptionGroups } from "./disruption-sync";

interface Env extends RdmKnowledgebaseEnv {
  DB: D1Database;
  RAIL_EVENTS_QUEUE: Queue<RailEvent>;
  RDM_REFERENCE_STATION_LIST_URL: string;
  RDM_REFERENCE_TOC_LIST_URL: string;
  RDM_REFERENCE_REASON_CODE_LIST_URL: string;
  RDM_REFERENCE_LOADING_CATEGORY_URL: string;
  RDM_REFERENCE_SOURCE_INSTANCE_NAMES_URL: string;
  RDM_REFERENCE_DATA_API_KEY: string;
  RDM_STATION_REFRESH_BATCH_SIZE: string;
  RDM_STATION_PROFILE_BATCH_SIZE: string;
  RDM_STATION_DISRUPTION_BATCH_SIZE: string;
  RDM_INCIDENT_BATCH_SIZE: string;
  RDM_QUEUE_SEND_TIMEOUT_MS: string;
  RDM_SYNC_JOB_TIMEOUT_MS: string;
  RDM_STATION_REFRESH_STALE_MINUTES: string;
  RDM_ONTOLOGY_QUALITY_TIMEOUT_MS: string;
}

const REFERENCE_CRON = "17 2 * * *";
const STATION_BOARD_REFRESH_CRON = "*/5 * * * *";
const OPERATOR_STATUSES_CRON = "1,6,11,16,21,26,31,36,41,46,51,56 * * * *";
const NETWORK_INCIDENTS_CRON = "4,9,14,19,24,29,34,39,44,49,54,59 * * * *";
const STATION_DISRUPTIONS_CRON = "7,22,37,52 * * * *";
const STATION_PROFILES_CRON = "43 * * * *";
const ONTOLOGY_QUALITY_CRON = "13 * * * *";
const SYNC_FEED_NAME = "rdm-sync";
const BOARD_LIMIT = 8;
const MAX_QUEUE_SEND_BATCH_SIZE = 100;
const DEFAULT_STATION_REFRESH_BATCH_SIZE = 100;
const DEFAULT_QUEUE_SEND_TIMEOUT_MS = 20_000;
const DEFAULT_SYNC_JOB_TIMEOUT_MS = 240_000;
const DEFAULT_STATION_REFRESH_STALE_MINUTES = 30;
const DEFAULT_ONTOLOGY_QUALITY_TIMEOUT_MS = 120_000;
const DEFAULT_INCIDENT_BATCH_SIZE = 100;

export default {
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    await runScheduledSync(event.cron, env);
  },
} satisfies ExportedHandler<Env>;

async function runScheduledSync(cron: string, env: Env): Promise<void> {
  const startedAt = nowIso();
  const jobs = scheduledSyncJobs(cron);
  const recordsIngestHealth = jobs.some((job) => job.recordsIngestHealth !== false);

  if (jobs.length === 0) {
    console.warn(
      JSON.stringify({ event: "rdm.sync.skipped", cron, message: "No sync job configured" }),
    );
    return;
  }

  try {
    for (const job of jobs) {
      await runScheduledJob(job, cron, env, startedAt);
    }

    if (recordsIngestHealth) {
      await markIngestConnected(env.DB, SYNC_FEED_NAME, startedAt, `rdm-sync:${cron}:${startedAt}`);
    }
    console.log(
      JSON.stringify({ event: "rdm.sync.complete", cron, jobs: jobs.map((job) => job.name) }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown RDM sync error";
    if (recordsIngestHealth) {
      await markIngestError(env.DB, SYNC_FEED_NAME, nowIso(), message);
    }
    console.error(JSON.stringify({ event: "rdm.sync.error", cron, message }));
    throw error;
  }
}

async function runScheduledJob(
  job: ScheduledSyncJob,
  cron: string,
  env: Env,
  checkedAt: string,
): Promise<void> {
  const startedMs = Date.now();
  const timeoutMs = positiveIntegerValue(env.RDM_SYNC_JOB_TIMEOUT_MS, DEFAULT_SYNC_JOB_TIMEOUT_MS);
  console.log(JSON.stringify({ event: "rdm.sync.job.started", cron, job: job.name }));

  try {
    await withTimeout(job.run(env, checkedAt), {
      operation: `rdm-sync job ${job.name}`,
      timeoutMs,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "rdm.sync.job.error",
        cron,
        job: job.name,
        durationMs: Date.now() - startedMs,
        message: error instanceof Error ? error.message : "unknown scheduled job error",
      }),
    );
    throw error;
  }

  console.log(
    JSON.stringify({
      event: "rdm.sync.job.complete",
      cron,
      job: job.name,
      durationMs: Date.now() - startedMs,
    }),
  );
}

interface ScheduledSyncJob {
  name: string;
  run: (env: Env, checkedAt: string) => Promise<void>;
  recordsIngestHealth?: boolean;
}

function scheduledSyncJobs(cron: string): ScheduledSyncJob[] {
  switch (cron) {
    case STATION_BOARD_REFRESH_CRON:
      return [{ name: "station-board-refresh", run: queueStationBoardRefreshes }];
    case OPERATOR_STATUSES_CRON:
      return [{ name: "operator-statuses", run: syncOperatorStatuses }];
    case NETWORK_INCIDENTS_CRON:
      return [{ name: "network-incidents", run: syncNetworkIncidents }];
    case STATION_DISRUPTIONS_CRON:
      return [{ name: "station-disruptions", run: syncStationDisruptions }];
    case STATION_PROFILES_CRON:
      return [{ name: "station-profiles", run: syncStationProfiles }];
    case REFERENCE_CRON:
      return [{ name: "reference-data", run: syncReferenceData }];
    case ONTOLOGY_QUALITY_CRON:
      return [{ name: "ontology-quality", run: syncOntologyQuality, recordsIngestHealth: false }];
    default:
      return [];
  }
}

async function syncOntologyQuality(env: Env, checkedAt: string): Promise<void> {
  const report = await withTimeout(validateOntologyQuality(env.DB, checkedAt), {
    operation: "ontology quality validation",
    timeoutMs: positiveIntegerValue(
      env.RDM_ONTOLOGY_QUALITY_TIMEOUT_MS,
      DEFAULT_ONTOLOGY_QUALITY_TIMEOUT_MS,
    ),
  });
  const { summary } = report;
  const logPayload = {
    event: "ontology.quality.validated",
    source: "rdm-sync:scheduled",
    checkedAt,
    violations: summary.violation_count,
    errors: summary.error_count,
    warnings: summary.warning_count,
  };

  if (summary.error_count > 0) {
    console.warn(JSON.stringify(logPayload));
    return;
  }

  console.log(JSON.stringify(logPayload));
}

async function syncReferenceData(env: Env, checkedAt: string): Promise<void> {
  await syncVersionedReference({
    env,
    sourceName: "rdm.station-list",
    checkedAt,
    fetchPayload: (currentVersion) => fetchRdmStationList(env, currentVersion),
    replace: (payload) =>
      replaceReferenceStations(
        env.DB,
        payload.items.map<ReferenceStationWrite>((station) => ({
          station_key: station.station_key,
          station_name: station.station_name ?? station.station_key,
          source_version: payload.version,
          updated_at: checkedAt,
        })),
        checkedAt,
      ),
  });

  await syncVersionedReference({
    env,
    sourceName: "rdm.toc-list",
    checkedAt,
    fetchPayload: (currentVersion) => fetchRdmTocList(env, currentVersion),
    replace: (payload) =>
      replaceReferenceTocs(
        env.DB,
        payload.items.map<ReferenceTocWrite>((toc) => ({
          toc_code: toc.toc,
          toc_name: toc.name ?? toc.toc,
          source_version: payload.version,
          updated_at: checkedAt,
        })),
        checkedAt,
      ),
  });

  await syncVersionedReference({
    env,
    sourceName: "rdm.loading-categories",
    checkedAt,
    fetchPayload: (currentVersion) => fetchRdmLoadingCategoryList(env, currentVersion),
    replace: (payload) =>
      replaceReferenceLoadingCategories(
        env.DB,
        payload.items.map<ReferenceLoadingCategoryWrite>((category) => ({
          category_code: category.code,
          category_name: category.name,
          typical_description: category.typicalDescription ?? null,
          expected_description: category.expectedDescription ?? null,
          definition: category.definition ?? null,
          colour: category.colour ?? null,
          image: category.image ?? null,
          toc_code: category.toc ?? null,
          source_version: payload.version,
          updated_at: checkedAt,
        })),
        checkedAt,
      ),
  });

  await syncUnversionedReference({
    env,
    sourceName: "rdm.reason-codes",
    checkedAt,
    fetchPayload: () => fetchRdmReasonCodeList(env),
    replace: (payload) =>
      replaceReferenceReasonCodes(
        env.DB,
        payload.items.map<ReferenceReasonCodeWrite>((reason) => ({
          reason_code: reason.code,
          late_reason: reason.lateReason,
          cancellation_reason: reason.cancellationReason,
          updated_at: checkedAt,
        })),
        checkedAt,
      ),
  });

  await syncUnversionedReference({
    env,
    sourceName: "rdm.source-instance-names",
    checkedAt,
    fetchPayload: () => fetchRdmSourceInstanceNames(env),
    replace: (payload) =>
      replaceReferenceSourceInstances(
        env.DB,
        payload.items.map<ReferenceSourceInstanceWrite>((sourceInstance) => ({
          source_instance_id: sourceInstance.code,
          source_instance_name: sourceInstance.name ?? sourceInstance.code,
          updated_at: checkedAt,
        })),
        checkedAt,
      ),
  });
}

async function syncOperatorStatuses(env: Env, checkedAt: string): Promise<void> {
  const operatorStatuses = await fetchRdmNationalServiceIndicator(env);
  await replaceOperatorStatuses(
    env.DB,
    operatorStatuses.map<OperatorStatusWrite>((status) => ({
      toc_code: status.toc_code,
      toc_name: status.toc_name,
      status: status.status,
      status_description: status.status_description,
      status_image: status.status_image,
      twitter_account: status.twitter_account,
      additional_info: status.additional_info,
      updated_at: checkedAt,
      disruptions: status.disruptions,
    })),
    checkedAt,
  );
  await upsertRdmSyncState(env.DB, {
    source_key: "rdm.national-service-indicator",
    source_version: null,
    status: "ok",
    item_count: operatorStatuses.length,
    cursor: null,
    last_checked_at: checkedAt,
    last_changed_at: checkedAt,
    error_message: null,
  });
}

async function syncNetworkIncidents(env: Env, checkedAt: string): Promise<void> {
  const state = await getRdmSyncState(env.DB, "rdm.incidents");
  const batchSize = positiveIntegerValue(env.RDM_INCIDENT_BATCH_SIZE, DEFAULT_INCIDENT_BATCH_SIZE);
  const incidents = (await fetchRdmIncidents(env)).sort((left, right) =>
    left.incident_id.localeCompare(right.incident_id),
  );
  const {
    rows: incidentBatch,
    nextCursor,
    completedCycle,
  } = nextIncidentBatch(incidents, state?.cursor ?? null, batchSize);
  await replaceIncidents(
    env.DB,
    incidentBatch.map<IncidentWrite>((incident) => ({
      incident_id: incident.incident_id,
      version: incident.version,
      planned: incident.planned,
      priority: incident.priority,
      summary: incident.summary,
      description_html: incident.description_html,
      start_at: incident.start_at,
      end_at: incident.end_at,
      routes_affected_html: incident.routes_affected_html,
      info_link_url: incident.info_link_url,
      info_link_label: incident.info_link_label,
      updated_at: checkedAt,
      operators: incident.operators,
    })),
    checkedAt,
    {
      deactivateMissingIncidentIds: completedCycle
        ? new Set(incidents.map((incident) => incident.incident_id))
        : null,
    },
  );
  await upsertRdmSyncState(env.DB, {
    source_key: "rdm.incidents",
    source_version: null,
    status: "ok",
    item_count: incidents.length,
    cursor: nextCursor,
    last_checked_at: checkedAt,
    last_changed_at: incidentBatch.length > 0 ? checkedAt : (state?.last_changed_at ?? null),
    error_message: null,
  });

  console.log(
    JSON.stringify({
      event: "rdm.incidents.batch",
      incidents: incidentBatch.length,
      totalIncidents: incidents.length,
      nextCursor,
      completedCycle,
    }),
  );
}

async function syncStationProfiles(env: Env, checkedAt: string): Promise<void> {
  const state = await getRdmSyncState(env.DB, "rdm.station-profiles");
  const batchSize = positiveIntegerValue(env.RDM_STATION_PROFILE_BATCH_SIZE, 25);
  const { stations, nextCursor } = await nextStationBatch(env, state?.cursor ?? null, batchSize);
  const profiles: StationProfileWrite[] = [];
  const skippedStations: string[] = [];

  for (const station of stations) {
    try {
      const profile = await fetchRdmStationProfile(env, station.station_key);
      profiles.push(await stationProfileWrite(profile, checkedAt));
    } catch (error) {
      if (!isUnavailableStationProfileError(error)) throw error;
      skippedStations.push(station.station_key);
      profiles.push(unavailableStationProfileWrite(station, error, checkedAt));
    }
  }

  await upsertStationProfiles(env.DB, profiles);
  await upsertRdmSyncState(env.DB, {
    source_key: "rdm.station-profiles",
    source_version: null,
    status: skippedStations.length ? "partial_error" : "ok",
    item_count: profiles.length,
    cursor: nextCursor,
    last_checked_at: checkedAt,
    last_changed_at: profiles.length ? checkedAt : (state?.last_changed_at ?? null),
    error_message: skippedStations.length
      ? `Station profiles unavailable for ${skippedStations.length} station(s): ${skippedStations.slice(0, 12).join(", ")}`
      : null,
  });
}

async function stationProfileWrite(
  profile: RdmStationProfile,
  checkedAt: string,
): Promise<StationProfileWrite> {
  const profileData = JSON.stringify(profile);
  return {
    station_key: profile.station_key,
    station_name: profile.station_name,
    sixteen_character_name: profile.sixteen_character_name,
    national_location_code: profile.national_location_code,
    station_operator: profile.station_operator,
    latitude: profile.latitude,
    longitude: profile.longitude,
    address_line_1: profile.address_line_1,
    address_line_2: profile.address_line_2,
    address_line_3: profile.address_line_3,
    address_line_4: profile.address_line_4,
    postcode: profile.postcode,
    staffing_level: profile.staffing_level,
    cctv_available: profile.cctv_available,
    cis_modes: profile.cis_modes.length ? profile.cis_modes.join(",") : null,
    customer_help_points_available: profile.customer_help_points_available,
    ticket_office_available: profile.ticket_office_available,
    ticket_machine_available: profile.ticket_machine_available,
    oyster_issued: profile.oyster_issued,
    oyster_topup_ticket_machine: profile.oyster_topup_ticket_machine,
    oyster_accepted: profile.oyster_accepted,
    smartcard_issued: profile.smartcard_issued,
    smartcard_topup_ticket_office: profile.smartcard_topup_ticket_office,
    smartcard_topup_ticket_machine: profile.smartcard_topup_ticket_machine,
    smartcard_validator: profile.smartcard_validator,
    seated_area_available: profile.seated_area_available,
    waiting_room_available: profile.waiting_room_available,
    toilets_available: profile.toilets_available,
    wifi_available: profile.wifi_available,
    induction_loop: profile.induction_loop,
    accessible_ticket_machines: profile.accessible_ticket_machines,
    ramp_for_train_access: profile.ramp_for_train_access,
    accessible_taxis_available: profile.accessible_taxis_available,
    national_key_toilets_available: profile.national_key_toilets_available,
    step_free_access_coverage: profile.step_free_access_coverage,
    impaired_mobility_set_down_available: profile.impaired_mobility_set_down_available,
    cycle_storage_spaces: profile.cycle_storage_spaces,
    car_park_spaces: profile.car_park_spaces,
    accessible_car_park_spaces: profile.accessible_car_park_spaces,
    rail_replacement_map_url: profile.rail_replacement_map_url,
    profile_status: "available",
    profile_error_status: null,
    profile_error_message: null,
    profile_hash: await sha1Hex(profileData),
    profile_updated_at: profile.changed_at,
    updated_at: checkedAt,
  };
}

function unavailableStationProfileWrite(
  station: { station_key: string; station_name: string },
  error: RdmHttpError,
  checkedAt: string,
): StationProfileWrite {
  return {
    station_key: station.station_key,
    station_name: station.station_name,
    sixteen_character_name: null,
    national_location_code: null,
    station_operator: null,
    latitude: null,
    longitude: null,
    address_line_1: null,
    address_line_2: null,
    address_line_3: null,
    address_line_4: null,
    postcode: null,
    staffing_level: null,
    cctv_available: null,
    cis_modes: null,
    customer_help_points_available: null,
    ticket_office_available: null,
    ticket_machine_available: null,
    oyster_issued: null,
    oyster_topup_ticket_machine: null,
    oyster_accepted: null,
    smartcard_issued: null,
    smartcard_topup_ticket_office: null,
    smartcard_topup_ticket_machine: null,
    smartcard_validator: null,
    seated_area_available: null,
    waiting_room_available: null,
    toilets_available: null,
    wifi_available: null,
    induction_loop: null,
    accessible_ticket_machines: null,
    ramp_for_train_access: null,
    accessible_taxis_available: null,
    national_key_toilets_available: null,
    step_free_access_coverage: null,
    impaired_mobility_set_down_available: null,
    cycle_storage_spaces: null,
    car_park_spaces: null,
    accessible_car_park_spaces: null,
    rail_replacement_map_url: null,
    profile_status: "unavailable",
    profile_error_status: error.status,
    profile_error_message: error.message,
    profile_hash: null,
    profile_updated_at: null,
    updated_at: checkedAt,
  };
}

function isUnavailableStationProfileError(error: unknown): error is RdmHttpError {
  return error instanceof RdmHttpError && (error.status === 403 || error.status === 404);
}

async function syncStationDisruptions(env: Env, checkedAt: string): Promise<void> {
  const state = await getRdmSyncState(env.DB, "rdm.station-disruptions");
  const batchSize = positiveIntegerValue(env.RDM_STATION_DISRUPTION_BATCH_SIZE, 20);
  const { stations, nextCursor } = await nextStationBatch(env, state?.cursor ?? null, batchSize);

  if (!stations.length) {
    await upsertRdmSyncState(env.DB, {
      source_key: "rdm.station-disruptions",
      source_version: null,
      status: "ok",
      item_count: 0,
      cursor: nextCursor,
      last_checked_at: checkedAt,
      last_changed_at: state?.last_changed_at ?? null,
      error_message: null,
    });
    return;
  }

  const { groups, failedStationKeys } = await fetchStationDisruptionGroups(
    env,
    stations.map((station) => station.station_key),
    batchSize,
  );
  await replaceStationDisruptions(
    env.DB,
    groups.map<StationDisruptionGroupWrite>((group) => ({
      station_key: group.station_key,
      generated_at: group.generated_at,
      updated_at: checkedAt,
      disruptions: group.disruptions.map((disruption) => ({
        disruption_id: disruption.disruption_id,
        category: disruption.category,
        severity: disruption.severity,
        description: disruption.description,
        message_html: disruption.message_html,
        is_suppressed: disruption.is_suppressed,
      })),
    })),
    checkedAt,
  );
  await upsertRdmSyncState(env.DB, {
    source_key: "rdm.station-disruptions",
    source_version: null,
    status: failedStationKeys.length ? "partial_error" : "ok",
    item_count: groups.reduce((total, group) => total + group.disruptions.length, 0),
    cursor: nextCursor,
    last_checked_at: checkedAt,
    last_changed_at: groups.length ? checkedAt : (state?.last_changed_at ?? null),
    error_message: failedStationKeys.length
      ? `Disruption List failed for ${failedStationKeys.length} station(s): ${failedStationKeys.slice(0, 12).join(", ")}`
      : null,
  });
}

async function syncVersionedReference<T>(options: {
  env: Env;
  sourceName: string;
  checkedAt: string;
  fetchPayload: (currentVersion: string) => Promise<RdmReferencePayload<T>>;
  replace: (payload: RdmReferencePayload<T>) => Promise<void>;
}): Promise<void> {
  const previous = await getRdmSyncState(options.env.DB, options.sourceName);
  const currentVersion = previous?.source_version ?? "0";
  const payload = await fetchVersionedReferencePayload(
    options.sourceName,
    currentVersion,
    options.fetchPayload,
  );
  const changed = !previous || payload.version !== previous.source_version;

  if (changed) {
    await options.replace(payload);
  }

  await upsertRdmSyncState(options.env.DB, {
    source_key: options.sourceName,
    source_version: payload.version,
    status: "ok",
    item_count: payload.items.length,
    cursor: previous?.cursor ?? null,
    last_checked_at: options.checkedAt,
    last_changed_at: changed ? options.checkedAt : (previous?.last_changed_at ?? null),
    error_message: null,
  });
}

async function fetchVersionedReferencePayload<T>(
  sourceName: string,
  currentVersion: string,
  fetchPayload: (currentVersion: string) => Promise<RdmReferencePayload<T>>,
): Promise<RdmReferencePayload<T>> {
  try {
    return await fetchPayload(currentVersion);
  } catch (error) {
    if (!(error instanceof RdmHttpError) || error.status !== 400 || currentVersion === "0") {
      throw error;
    }

    console.warn(
      JSON.stringify({
        event: "rdm.reference.version_fallback",
        sourceName,
        currentVersion,
        status: error.status,
      }),
    );
    return fetchPayload("0");
  }
}

async function syncUnversionedReference<T>(options: {
  env: Env;
  sourceName: string;
  checkedAt: string;
  fetchPayload: () => Promise<RdmReferencePayload<T>>;
  replace: (payload: RdmReferencePayload<T>) => Promise<void>;
}): Promise<void> {
  const payload = await options.fetchPayload();
  await options.replace(payload);
  await upsertRdmSyncState(options.env.DB, {
    source_key: options.sourceName,
    source_version: payload.version,
    status: "ok",
    item_count: payload.items.length,
    cursor: null,
    last_checked_at: options.checkedAt,
    last_changed_at: options.checkedAt,
    error_message: null,
  });
}

async function queueStationBoardRefreshes(env: Env, checkedAt: string): Promise<void> {
  const state = await getRdmSyncState(env.DB, "rdm.station-board-refresh");
  const batchSize = positiveIntegerValue(
    env.RDM_STATION_REFRESH_BATCH_SIZE,
    DEFAULT_STATION_REFRESH_BATCH_SIZE,
  );
  const staleMinutes = positiveIntegerValue(
    env.RDM_STATION_REFRESH_STALE_MINUTES,
    DEFAULT_STATION_REFRESH_STALE_MINUTES,
  );
  const queueSendTimeoutMs = positiveIntegerValue(
    env.RDM_QUEUE_SEND_TIMEOUT_MS,
    DEFAULT_QUEUE_SEND_TIMEOUT_MS,
  );
  const staleBefore = new Date(Date.parse(checkedAt) - staleMinutes * 60_000).toISOString();
  const boards = await listStationBoardsDueForRefresh(env.DB, staleBefore, batchSize);

  let queueBatch: MessageSendRequest<RailEvent>[] = [];
  for (const board of boards) {
    queueBatch.push({
      body: await stationBoardRefreshEvent(
        board.station_key,
        board.board_type,
        checkedAt,
        BOARD_LIMIT,
      ),
    });

    if (queueBatch.length === MAX_QUEUE_SEND_BATCH_SIZE) {
      await sendRailEventQueueBatch(env, queueBatch, queueSendTimeoutMs);
      queueBatch = [];
    }
  }

  await sendRailEventQueueBatch(env, queueBatch, queueSendTimeoutMs);

  await markStationBoardRefreshRequests(env.DB, boards, checkedAt);

  await upsertRdmSyncState(env.DB, {
    source_key: "rdm.station-board-refresh",
    source_version: null,
    status: "ok",
    item_count: boards.length,
    cursor: null,
    last_checked_at: checkedAt,
    last_changed_at: boards.length > 0 ? checkedAt : (state?.last_changed_at ?? null),
    error_message: null,
  });

  console.log(
    JSON.stringify({
      event: "rdm.station_boards.queued",
      boards: boards.length,
      staleBefore,
    }),
  );
}

async function sendRailEventQueueBatch(
  env: Env,
  messages: MessageSendRequest<RailEvent>[],
  timeoutMs: number,
): Promise<void> {
  if (messages.length === 0) return;

  await withTimeout(env.RAIL_EVENTS_QUEUE.sendBatch(messages), {
    operation: `rail event queue sendBatch (${messages.length} message(s))`,
    timeoutMs,
  });
}

async function nextStationBatch(
  env: Env,
  cursor: string | null,
  batchSize: number,
): Promise<{
  stations: Array<{ station_key: string; station_name: string }>;
  nextCursor: string | null;
}> {
  let stations = await listReferenceStationsAfter(env.DB, cursor, batchSize);
  let nextCursor = stations.at(-1)?.station_key ?? null;

  if (stations.length === 0 && cursor) {
    stations = await listReferenceStationsAfter(env.DB, null, batchSize);
    nextCursor = stations.at(-1)?.station_key ?? null;
  }

  return { stations, nextCursor };
}

function nextIncidentBatch(
  incidents: RdmIncident[],
  cursor: string | null,
  batchSize: number,
): { rows: RdmIncident[]; nextCursor: string | null; completedCycle: boolean } {
  const pageLimit = Math.max(1, Math.trunc(batchSize));
  const startIndex = cursor ? incidents.findIndex((incident) => incident.incident_id > cursor) : 0;
  const effectiveStartIndex = startIndex === -1 ? 0 : startIndex;
  const rows = incidents.slice(effectiveStartIndex, effectiveStartIndex + pageLimit);
  const completedCycle = effectiveStartIndex + rows.length >= incidents.length;

  return {
    rows,
    nextCursor: completedCycle ? null : (rows.at(-1)?.incident_id ?? null),
    completedCycle,
  };
}
