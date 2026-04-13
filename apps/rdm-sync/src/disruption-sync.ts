import {
  fetchRdmDisruptionList,
  type RdmKnowledgebaseEnv,
  type RdmStationDisruptionGroup,
} from "@zawa/rdm/xml-products";

export interface StationDisruptionFetchResult {
  groups: RdmStationDisruptionGroup[];
  failedStationKeys: string[];
}

export async function fetchStationDisruptionGroups(
  env: RdmKnowledgebaseEnv,
  stationKeys: string[],
  requestSize: number,
): Promise<StationDisruptionFetchResult> {
  const groups: RdmStationDisruptionGroup[] = [];
  const failedStationKeys: string[] = [];

  for (let index = 0; index < stationKeys.length; index += requestSize) {
    const batch = stationKeys.slice(index, index + requestSize);
    const result = await fetchDisruptionBatch(env, batch);
    groups.push(...result.groups);
    failedStationKeys.push(...result.failedStationKeys);
  }

  return { groups, failedStationKeys };
}

async function fetchDisruptionBatch(
  env: RdmKnowledgebaseEnv,
  stationKeys: string[],
): Promise<StationDisruptionFetchResult> {
  try {
    return { groups: await fetchRdmDisruptionList(env, stationKeys), failedStationKeys: [] };
  } catch (error) {
    if (stationKeys.length === 1) {
      console.error(
        JSON.stringify({
          event: "rdm.station_disruptions.station_failed",
          stationKey: stationKeys[0],
          message: error instanceof Error ? error.message : "unknown RDM disruption request error",
        }),
      );
      return { groups: [], failedStationKeys: stationKeys };
    }

    const splitAt = Math.ceil(stationKeys.length / 2);
    const left = await fetchDisruptionBatch(env, stationKeys.slice(0, splitAt));
    const right = await fetchDisruptionBatch(env, stationKeys.slice(splitAt));
    return {
      groups: [...left.groups, ...right.groups],
      failedStationKeys: [...left.failedStationKeys, ...right.failedStationKeys],
    };
  }
}
