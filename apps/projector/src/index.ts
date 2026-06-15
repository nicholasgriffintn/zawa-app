import { parseServiceResponse, parseStationBoardResponse } from "@zawa/domain/api";
import type { RailEvent, RailEventType } from "@zawa/domain/events";
import { railEventSchema } from "@zawa/domain/schemas";
import { railClockTimeToIso } from "@zawa/domain/time";
import { stationBoardProjectionEvent } from "@zawa/rdm/projection-events";
import { getRdmStationBoard, type RdmStationBoardEnv } from "@zawa/rdm/services";
import {
  buildRdmRawEventRowsFromRailEvent,
  feedNameForRdmStreamingEvent,
} from "@zawa/rdm/streaming";
import { isRecord, positiveIntegerValue, stringOrNull, stringValue } from "@zawa/shared/values";
import { claimProcessedEvent, releaseProcessedEvent } from "@zawa/db/queries/processed-events";
import { markIngestConnected } from "@zawa/db/queries/ingest-health";
import { insertRdmRawEvents } from "@zawa/db/queries/rdm-raw-events";
import {
  patchServiceStopsStatusForService,
  upsertServiceLocationStopCurrent,
  upsertServiceStopCurrents,
} from "@zawa/db/queries/service-stops";
import {
  replaceServiceFormationsCurrent,
  upsertServiceMovementCurrent,
} from "@zawa/db/queries/service-formations";
import {
  upsertServiceCurrent,
  upsertServiceCurrents,
  type ServiceRow,
} from "@zawa/db/queries/services";
import { serviceThingId, stationThingId } from "@zawa/db/queries/ontology";
import {
  markStationBoardRefreshed,
  patchStationBoardStatusForService,
  replaceStationBoardCurrent,
  upsertStationBoardCurrent,
  type StationBoardCurrentWrite,
} from "@zawa/db/queries/stations";

import { scheduleProjectionFromEvent } from "./schedule-projection";
import { projectStationMessageEvent } from "./station-message-projection";

export interface Env extends RdmStationBoardEnv {
  DB: D1Database;
  STATION_BOARD_DO: DurableObjectNamespace;
  SERVICE_DO: DurableObjectNamespace;
}

type StationBoardPatchWrite = StationBoardCurrentWrite & {
  origin_name?: string | null;
  via_name?: string | null;
  service_type?: string | null;
  operator_code?: string | null;
};

export interface ProjectionStats {
  messages: number;
  duplicates: number;
  invalid: number;
  retried: number;
  sourceEventWrites: number;
  ingestHealthWrites: number;
  serviceWrites: number;
  stopWrites: number;
  boardWrites: number;
  formationWrites: number;
  movementWrites: number;
  stationMessageWrites: number;
  refreshWrites: number;
  serviceBroadcasts: number;
  boardBroadcasts: number;
  noops: number;
}

export default {
  async queue(batch: MessageBatch<RailEvent>, env: Env): Promise<void> {
    const stats = emptyProjectionStats(batch.messages.length);

    for (const msg of batch.messages) {
      let claimedEventId: string | null = null;
      try {
        const parsed = railEventSchema.safeParse(msg.body);
        if (!parsed.success) {
          stats.invalid += 1;
          console.error(
            JSON.stringify({
              event: "projector.message.invalid",
              issues: parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
              })),
              message: invalidMessageContext(msg.body),
            }),
          );
          msg.ack();
          continue;
        }

        const event = parsed.data;
        const sourceEventRows = await buildRdmRawEventRowsFromRailEvent(event);
        if (sourceEventRows.length > 0) {
          await insertRdmRawEvents(env.DB, sourceEventRows);
          stats.sourceEventWrites += sourceEventRows.length;
        }

        const feedName = feedNameForRdmStreamingEvent(event);
        if (feedName) {
          await markIngestConnected(env.DB, feedName, event.ingestedAt, event.id);
          stats.ingestHealthWrites += 1;
        }

        if (!(await claimProcessedEvent(env.DB, event.id, new Date().toISOString()))) {
          stats.duplicates += 1;
          msg.ack();
          continue;
        }
        claimedEventId = event.id;

        const messageStats = await projectRailEvent(env, event);
        mergeProjectionStats(stats, messageStats);
        if (isNoopProjection(messageStats)) {
          stats.noops += 1;
          console.log(
            JSON.stringify({
              event: "projector.message.noop",
              eventId: event.id,
              type: event.type,
              serviceKey: event.serviceKey,
              stationKey: event.stationKey,
            }),
          );
        }
        msg.ack();
      } catch (error) {
        if (claimedEventId) {
          await releaseProcessedEvent(env.DB, claimedEventId);
        }
        stats.retried += 1;
        console.error(
          JSON.stringify({
            event: "projector.message.retry",
            message: error instanceof Error ? error.message : "unknown projection error",
          }),
        );
        msg.retry();
      }
    }

    console.log(JSON.stringify({ event: "projector.batch", queue: batch.queue, stats }));
  },
};

function invalidMessageContext(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  return {
    id: body.id,
    type: body.type,
    topic: body.topic,
    occurredAt: body.occurredAt,
    ingestedAt: body.ingestedAt,
    stationKey: body.stationKey,
    serviceKey: body.serviceKey,
  };
}

export async function projectRailEvent(env: Env, event: RailEvent): Promise<ProjectionStats> {
  const stats = emptyProjectionStats(1);
  mergeProjectionStats(stats, await projectStationBoardRefreshEvent(env, event));
  mergeProjectionStats(stats, await projectBoardSnapshotEvent(env, event));
  mergeProjectionStats(stats, await projectServiceSnapshotEvent(env, event));
  mergeProjectionStats(stats, await projectScheduleEvent(env, event));
  stats.stationMessageWrites += await projectStationMessageEvent(env.DB, event);

  if (event.serviceKey && projectsServiceState(event.type)) {
    const serviceAccepted = await upsertServiceCurrent(env.DB, {
      service_key: event.serviceKey,
      train_run_key: event.trainRunKey ?? null,
      train_id: stringOrNull(event.payload.trainId),
      uid: stringOrNull(event.payload.trainUid),
      operator_code: null,
      origin_name: stringOrNull(event.payload.originName),
      destination_name: stringOrNull(event.payload.destinationName),
      service_length: integerOrNull(event.payload.serviceLength),
      scheduled_start_ts: null,
      expected_start_ts: null,
      status: event.type,
      delay_minutes: null,
      cancellation_reason: null,
      last_event_id: event.id,
      updated_at: event.ingestedAt,
    });

    if (serviceAccepted) {
      stats.serviceWrites += 1;
      await broadcastServicePatch(env, event.serviceKey, {
        status: event.type,
        updated_at: event.ingestedAt,
      });
      stats.serviceBroadcasts += 1;
      if (
        await patchServiceStopsStatusForService(
          env.DB,
          event.serviceKey,
          event.type,
          event.ingestedAt,
        )
      ) {
        stats.stopWrites += 1;
      }
      const boardPatches = await patchStationBoardStatusForService(
        env.DB,
        event.serviceKey,
        event.type,
        event.ingestedAt,
      );
      for (const boardPatch of boardPatches) {
        await broadcastStationBoardPatch(env, event, boardPatch);
        stats.boardWrites += 1;
        stats.boardBroadcasts += 1;
      }
    }
  }

  if (event.stationKey && event.serviceKey && projectsServiceState(event.type)) {
    if (await upsertCurrentLocationStop(env, event)) {
      stats.stopWrites += 1;
    }

    for (const boardWrite of stationBoardWritesFromEvent(event)) {
      if (await projectStationBoardWrite(env, event, boardWrite)) {
        stats.boardWrites += 1;
        stats.boardBroadcasts += 1;
      }
    }
  }

  if (event.trainRunKey && event.payload.product === "rdm-train-movements") {
    if (
      await upsertServiceMovementCurrent(env.DB, {
        train_run_key: event.trainRunKey,
        service_key: event.serviceKey ?? null,
        train_id: stringOrNull(event.payload.trainId),
        train_uid: stringOrNull(event.payload.trainUid),
        toc: stringOrNull(event.payload.toc),
        train_service_code: stringOrNull(event.payload.trainServiceCode),
        stanox: stringOrNull(event.payload.stanox),
        reporting_stanox: stringOrNull(event.payload.reportingStanox),
        platform: stringOrNull(event.payload.platform),
        path: stringOrNull(event.payload.path),
        line: stringOrNull(event.payload.line),
        planned_event_type: stringOrNull(event.payload.plannedEventType),
        event_type: stringOrNull(event.payload.eventType),
        planned_ts: stringOrNull(event.payload.plannedTimestamp),
        gbtt_ts: stringOrNull(event.payload.gbttTimestamp),
        actual_ts: stringOrNull(event.payload.actualTimestamp),
        timetable_variation_minutes: integerOrNull(event.payload.timetableVariationMinutes),
        variation_status: stringOrNull(event.payload.variationStatus),
        auto_expected: booleanToInteger(event.payload.autoExpected),
        updated_at: event.ingestedAt,
      })
    ) {
      stats.movementWrites += 1;
    }
  }

  return stats;
}

async function projectStationBoardRefreshEvent(
  env: Env,
  event: RailEvent,
): Promise<ProjectionStats> {
  const stats = emptyProjectionStats(1);
  if (event.type !== "rdm.station.board.refresh.requested") return stats;

  const stationKey = event.stationKey;
  const boardType = stringValue(event.payload.boardType);
  if (!stationKey || (boardType !== "arrivals" && boardType !== "departures")) {
    throw new Error("Invalid station board refresh event");
  }

  const board = await getRdmStationBoard(env, stationKey, boardType, {
    limit: positiveIntegerValue(event.payload.limit, 8),
  });
  const snapshotEvent = await stationBoardProjectionEvent(board, event.ingestedAt);
  mergeProjectionStats(stats, await projectBoardSnapshotEvent(env, snapshotEvent));

  return stats;
}

async function projectScheduleEvent(env: Env, event: RailEvent): Promise<ProjectionStats> {
  const stats = emptyProjectionStats(1);
  const projection = scheduleProjectionFromEvent(event);
  if (!projection) return stats;

  const serviceAccepted = await upsertServiceCurrent(env.DB, projection.service);
  if (serviceAccepted) {
    stats.serviceWrites += 1;
    await broadcastServicePatch(env, projection.service.service_key, {
      status: event.type,
      updated_at: event.ingestedAt,
    });
    stats.serviceBroadcasts += 1;
  }

  stats.stopWrites += (await upsertServiceStopCurrents(env.DB, projection.stops)).filter(
    Boolean,
  ).length;

  for (const boardWrite of projection.boards) {
    if (await projectStationBoardWrite(env, event, boardWrite)) {
      stats.boardWrites += 1;
      stats.boardBroadcasts += 1;
    }
  }

  return stats;
}

async function projectStationBoardWrite(
  env: Env,
  event: RailEvent,
  boardWrite: StationBoardPatchWrite,
): Promise<boolean> {
  const boardAccepted = await upsertStationBoardCurrent(env.DB, boardWrite);
  if (!boardAccepted) return false;

  await broadcastStationBoardPatch(env, event, boardWrite);
  return true;
}

async function broadcastServicePatch(
  env: Env,
  serviceKey: string,
  patch: { status: string; updated_at: string },
): Promise<void> {
  const serviceId = env.SERVICE_DO.idFromName(serviceKey);
  const serviceStub = env.SERVICE_DO.get(serviceId) as DurableObjectStub & {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  await serviceStub.fetch("https://do.internal/broadcast", {
    method: "POST",
    body: JSON.stringify({
      type: "service.patch",
      serviceKey,
      rootThingIds: [serviceThingId(serviceKey)],
      patch,
      sentAt: patch.updated_at,
    }),
  });
}

async function broadcastStationBoardPatch(
  env: Env,
  event: RailEvent,
  boardWrite: StationBoardPatchWrite,
): Promise<void> {
  const stationId = env.STATION_BOARD_DO.idFromName(
    `${boardWrite.board_type}:${boardWrite.station_key}`,
  );
  const stationStub = env.STATION_BOARD_DO.get(stationId) as DurableObjectStub & {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  await stationStub.fetch("https://do.internal/broadcast", {
    method: "POST",
    body: JSON.stringify({
      type: "station.board.patch",
      stationKey: boardWrite.station_key,
      boardType: boardWrite.board_type,
      serviceKey: boardWrite.service_key,
      rootThingIds: [
        stationThingId(boardWrite.station_key),
        serviceThingId(boardWrite.service_key),
      ],
      patch: {
        scheduled_ts: boardWrite.scheduled_ts,
        expected_ts: boardWrite.expected_ts,
        platform: boardWrite.platform,
        origin_name: boardWrite.origin_name,
        destination_name: boardWrite.destination_name,
        via_name: boardWrite.via_name,
        service_type: boardWrite.service_type,
        operator_code: boardWrite.operator_code,
        status: boardWrite.status,
        updated_at: boardWrite.updated_at,
      },
      sentAt: boardWrite.updated_at,
    }),
  });
}

async function broadcastStationBoardRemove(
  env: Env,
  event: RailEvent,
  stationKey: string,
  boardType: "departures" | "arrivals",
  serviceKey: string,
): Promise<void> {
  const stationId = env.STATION_BOARD_DO.idFromName(`${boardType}:${stationKey}`);
  const stationStub = env.STATION_BOARD_DO.get(stationId) as DurableObjectStub & {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
  await stationStub.fetch("https://do.internal/broadcast", {
    method: "POST",
    body: JSON.stringify({
      type: "station.board.remove",
      stationKey,
      boardType,
      serviceKey,
      rootThingIds: [stationThingId(stationKey), serviceThingId(serviceKey)],
      sentAt: event.ingestedAt,
    }),
  });
}

async function projectBoardSnapshotEvent(env: Env, event: RailEvent): Promise<ProjectionStats> {
  const stats = emptyProjectionStats(1);
  if (event.type !== "rdm.board.snapshot") return stats;

  const snapshot = parseStationBoardResponse(event.payload.snapshot);
  const boardType = snapshot.boardType === "arrivals" ? "arrivals" : "departures";
  const boardRows: StationBoardPatchWrite[] = [];
  const serviceRows: ServiceRow[] = [];

  for (const row of snapshot.rows) {
    serviceRows.push({
      service_key: row.service_key,
      train_run_key: null,
      operator_code: row.operator_code,
      service_type: row.service_type,
      origin_name: row.origin_name,
      destination_name: row.destination_name,
      scheduled_start_ts: row.scheduled_ts,
      expected_start_ts: row.expected_ts,
      status: row.status,
      delay_minutes: null,
      cancellation_reason: null,
      last_event_id: event.id,
      updated_at: row.updated_at,
    });

    boardRows.push({
      station_key: row.station_key,
      board_type: boardType,
      service_key: row.service_key,
      scheduled_ts: row.scheduled_ts,
      expected_ts: row.expected_ts,
      platform: row.platform,
      origin_name: row.origin_name,
      destination_name: row.destination_name,
      via_name: row.via_name,
      service_type: row.service_type,
      operator_code: row.operator_code,
      status: row.status,
      updated_at: row.updated_at,
    });
  }

  stats.serviceWrites += (await upsertServiceCurrents(env.DB, serviceRows)).filter(Boolean).length;

  const replaceResult = await replaceStationBoardCurrent(
    env.DB,
    snapshot.stationKey,
    boardType,
    boardRows,
  );
  if (
    await markStationBoardRefreshed(
      env.DB,
      snapshot.stationKey,
      boardType,
      event.ingestedAt,
      snapshot.rows.length,
    )
  ) {
    stats.refreshWrites += 1;
  }

  for (const boardWrite of replaceResult.upsertedRows) {
    await broadcastStationBoardPatch(env, event, boardWrite);
    stats.boardWrites += 1;
    stats.boardBroadcasts += 1;
  }

  for (const serviceKey of replaceResult.removedServiceKeys) {
    await broadcastStationBoardRemove(env, event, snapshot.stationKey, boardType, serviceKey);
    stats.boardWrites += 1;
    stats.boardBroadcasts += 1;
  }

  return stats;
}

async function projectServiceSnapshotEvent(env: Env, event: RailEvent): Promise<ProjectionStats> {
  const stats = emptyProjectionStats(1);
  if (event.type !== "rdm.service.snapshot") return stats;

  const snapshot = parseServiceResponse(event.payload.snapshot);
  const serviceAccepted = await upsertServiceCurrent(env.DB, snapshot.service);
  stats.stopWrites += (await upsertServiceStopCurrents(env.DB, snapshot.stops)).filter(
    Boolean,
  ).length;
  await replaceServiceFormationsCurrent(env.DB, snapshot.service.service_key, snapshot.formations);
  stats.formationWrites += snapshot.formations.length;

  if (serviceAccepted) {
    stats.serviceWrites += 1;
    await broadcastServicePatch(env, snapshot.service.service_key, {
      status: snapshot.service.status,
      updated_at: snapshot.service.updated_at,
    });
    stats.serviceBroadcasts += 1;
  }

  return stats;
}

function stationBoardWritesFromEvent(event: RailEvent): StationBoardPatchWrite[] {
  if (!event.stationKey || !event.serviceKey) return [];

  const base = {
    station_key: event.stationKey,
    service_key: event.serviceKey,
    platform: stringOrNull(event.payload.platform),
    // Location events name the current stop; schedule events preserve the service destination.
    destination_name: null,
    status: event.type,
    updated_at: event.ingestedAt,
  };
  const serviceDate = stringOrNull(event.payload.ssd);
  const arrival = {
    scheduled_ts: railClockTimeToIso(stringOrNull(event.payload.plannedArrival), serviceDate),
    expected_ts:
      railClockTimeToIso(stringOrNull(event.payload.actualArrival), serviceDate) ??
      railClockTimeToIso(stringOrNull(event.payload.expectedArrival), serviceDate),
  };
  const departure = {
    scheduled_ts: railClockTimeToIso(stringOrNull(event.payload.plannedDeparture), serviceDate),
    expected_ts:
      railClockTimeToIso(stringOrNull(event.payload.actualDeparture), serviceDate) ??
      railClockTimeToIso(stringOrNull(event.payload.expectedDeparture), serviceDate),
  };
  const writes: StationBoardPatchWrite[] = [];

  if (arrival.scheduled_ts || arrival.expected_ts) {
    writes.push({ ...base, board_type: "arrivals", ...arrival });
  }

  if (departure.scheduled_ts || departure.expected_ts) {
    writes.push({ ...base, board_type: "departures", ...departure });
  }

  if (writes.length === 0) {
    writes.push({ ...base, board_type: "departures", scheduled_ts: null, expected_ts: null });
  }

  return writes;
}

async function upsertCurrentLocationStop(env: Env, event: RailEvent): Promise<boolean> {
  if (!event.serviceKey || !event.stationKey) return false;

  return upsertServiceLocationStopCurrent(env.DB, {
    service_key: event.serviceKey,
    station_key: event.stationKey,
    station_name: stringOrNull(event.payload.locationName),
    tiploc: stringOrNull(event.payload.tpl),
    scheduled_arrival_ts: railClockTimeToIso(
      stringOrNull(event.payload.plannedArrival),
      stringOrNull(event.payload.ssd),
    ),
    expected_arrival_ts:
      railClockTimeToIso(
        stringOrNull(event.payload.actualArrival),
        stringOrNull(event.payload.ssd),
      ) ??
      railClockTimeToIso(
        stringOrNull(event.payload.expectedArrival),
        stringOrNull(event.payload.ssd),
      ),
    actual_arrival_ts: railClockTimeToIso(
      stringOrNull(event.payload.actualArrival),
      stringOrNull(event.payload.ssd),
    ),
    scheduled_departure_ts: railClockTimeToIso(
      stringOrNull(event.payload.plannedDeparture),
      stringOrNull(event.payload.ssd),
    ),
    expected_departure_ts:
      railClockTimeToIso(
        stringOrNull(event.payload.actualDeparture),
        stringOrNull(event.payload.ssd),
      ) ??
      railClockTimeToIso(
        stringOrNull(event.payload.expectedDeparture),
        stringOrNull(event.payload.ssd),
      ),
    actual_departure_ts: railClockTimeToIso(
      stringOrNull(event.payload.actualDeparture),
      stringOrNull(event.payload.ssd),
    ),
    platform: stringOrNull(event.payload.platform),
    path: stringOrNull(event.payload.path),
    line: stringOrNull(event.payload.line),
    stop_status: event.type,
    updated_at: event.ingestedAt,
  });
}

function projectsServiceState(type: RailEventType): boolean {
  return type.startsWith("service.");
}

function emptyProjectionStats(messages: number): ProjectionStats {
  return {
    messages,
    duplicates: 0,
    invalid: 0,
    retried: 0,
    sourceEventWrites: 0,
    ingestHealthWrites: 0,
    serviceWrites: 0,
    stopWrites: 0,
    boardWrites: 0,
    formationWrites: 0,
    movementWrites: 0,
    stationMessageWrites: 0,
    refreshWrites: 0,
    serviceBroadcasts: 0,
    boardBroadcasts: 0,
    noops: 0,
  };
}

function mergeProjectionStats(target: ProjectionStats, source: ProjectionStats): void {
  target.duplicates += source.duplicates;
  target.invalid += source.invalid;
  target.retried += source.retried;
  target.sourceEventWrites += source.sourceEventWrites;
  target.ingestHealthWrites += source.ingestHealthWrites;
  target.serviceWrites += source.serviceWrites;
  target.stopWrites += source.stopWrites;
  target.boardWrites += source.boardWrites;
  target.formationWrites += source.formationWrites;
  target.movementWrites += source.movementWrites;
  target.stationMessageWrites += source.stationMessageWrites;
  target.refreshWrites += source.refreshWrites;
  target.serviceBroadcasts += source.serviceBroadcasts;
  target.boardBroadcasts += source.boardBroadcasts;
  target.noops += source.noops;
}

function isNoopProjection(stats: ProjectionStats): boolean {
  return (
    stats.serviceWrites === 0 &&
    stats.stopWrites === 0 &&
    stats.boardWrites === 0 &&
    stats.formationWrites === 0 &&
    stats.movementWrites === 0 &&
    stats.stationMessageWrites === 0 &&
    stats.refreshWrites === 0
  );
}

function integerOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function booleanToInteger(value: unknown): number | null {
  if (typeof value !== "boolean") return null;
  return value ? 1 : 0;
}
