import type { ServiceResponse, StationBoardResponse } from "@zawa/domain/api";

import { fetchRdmJson } from "./http";
import { mapRdmBoard, mapRdmServiceDetails, type RdmBoardType } from "./ldb";

export interface RdmStationBoardEnv {
  RDM_LDB_ARR_DEP_WITH_DETAILS_URL: string;
  RDM_LDB_API_KEY: string;
}

export interface RdmServiceDetailsEnv {
  RDM_SERVICE_DETAILS_URL: string;
  RDM_SERVICE_DETAILS_API_KEY: string;
}

export type RdmServiceEnv = RdmStationBoardEnv & RdmServiceDetailsEnv;

export async function getRdmStationBoard(
  env: RdmStationBoardEnv,
  stationKey: string,
  boardType: RdmBoardType,
  options: { limit: number; cursor?: string | null },
): Promise<StationBoardResponse> {
  const timeOffset = readTimeOffset(options.cursor);
  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_LDB_API_KEY,
    template: env.RDM_LDB_ARR_DEP_WITH_DETAILS_URL,
    path: { crs: stationKey },
    query: {
      numRows: options.limit,
      timeOffset,
      timeWindow: 60,
    },
  });

  return mapRdmBoard(stationKey, boardType, data, options.limit, timeOffset);
}

export async function getRdmServiceDetails(
  env: RdmServiceDetailsEnv,
  serviceKey: string,
): Promise<ServiceResponse> {
  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_SERVICE_DETAILS_API_KEY,
    template: env.RDM_SERVICE_DETAILS_URL,
    path: { serviceid: serviceKey },
  });

  return mapRdmServiceDetails(serviceKey, data);
}

function readTimeOffset(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const parsed = Number(cursor);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-120, Math.min(119, Math.trunc(parsed)));
}
