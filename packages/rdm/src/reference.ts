import { isRecord, recordArray, stringOrNumberValue, stringValue } from "@zawa/shared/values";

import { fetchRdmJson } from "./http";

export interface RdmReferenceEnv {
  RDM_REFERENCE_STATION_LIST_URL: string;
  RDM_REFERENCE_TOC_LIST_URL: string;
  RDM_REFERENCE_REASON_CODE_LIST_URL: string;
  RDM_REFERENCE_LOADING_CATEGORY_URL: string;
  RDM_REFERENCE_SOURCE_INSTANCE_NAMES_URL: string;
  RDM_REFERENCE_DATA_API_KEY: string;
}

export interface RdmStationReference {
  station_key: string;
  station_name: string | null;
}

export interface RdmTocReference {
  toc: string;
  name: string | null;
}

export interface RdmReasonCodeReference {
  code: string;
  lateReason: string | null;
  cancellationReason: string | null;
}

export interface RdmLoadingCategoryReference {
  code: string;
  name: string | null;
  typicalDescription: string | null;
  expectedDescription: string | null;
  definition: string | null;
  colour: string | null;
  image: string | null;
  toc: string | null;
}

export interface RdmSourceInstanceReference {
  code: string;
  name: string | null;
}

export interface RdmReferencePayload<T> {
  version: string | null;
  items: T[];
}

export async function fetchRdmStationList(
  env: RdmReferenceEnv,
  currentVersion: string,
): Promise<RdmReferencePayload<RdmStationReference>> {
  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_REFERENCE_DATA_API_KEY,
    template: env.RDM_REFERENCE_STATION_LIST_URL,
    path: { currentVersion },
  });
  return parseStationList(data);
}

export async function fetchRdmTocList(
  env: RdmReferenceEnv,
  currentVersion: string,
): Promise<RdmReferencePayload<RdmTocReference>> {
  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_REFERENCE_DATA_API_KEY,
    template: env.RDM_REFERENCE_TOC_LIST_URL,
    path: { currentVersion },
  });
  return parseValueList(data, "TOCList", "toc");
}

export async function fetchRdmReasonCodeList(
  env: RdmReferenceEnv,
): Promise<RdmReferencePayload<RdmReasonCodeReference>> {
  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_REFERENCE_DATA_API_KEY,
    template: env.RDM_REFERENCE_REASON_CODE_LIST_URL,
    path: {},
  });
  return {
    version: null,
    items: recordArray(data).flatMap((item) => {
      const code = stringOrNumberValue(item.code);
      if (!code) return [];
      return [
        {
          code,
          lateReason: stringValue(item.lateReason) ?? null,
          cancellationReason: stringValue(item.cancReason) ?? null,
        },
      ];
    }),
  };
}

export async function fetchRdmLoadingCategoryList(
  env: RdmReferenceEnv,
  currentVersion: string,
): Promise<RdmReferencePayload<RdmLoadingCategoryReference>> {
  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_REFERENCE_DATA_API_KEY,
    template: env.RDM_REFERENCE_LOADING_CATEGORY_URL,
    path: { currentVersion },
  });
  return parseLoadingCategoryList(data);
}

export async function fetchRdmSourceInstanceNames(
  env: RdmReferenceEnv,
): Promise<RdmReferencePayload<RdmSourceInstanceReference>> {
  const data = await fetchRdmJson<unknown>({
    apiKey: env.RDM_REFERENCE_DATA_API_KEY,
    template: env.RDM_REFERENCE_SOURCE_INSTANCE_NAMES_URL,
    path: {},
  });
  return {
    version: null,
    items: recordArray(data).flatMap((item) => {
      const code = stringOrNumberValue(item.id);
      if (!code) return [];
      return [{ code, name: stringValue(item.name) ?? null }];
    }),
  };
}

export function parseStationList(value: unknown): RdmReferencePayload<RdmStationReference> {
  const record = isRecord(value) ? value : null;
  const stationList = record?.StationList;
  if (!Array.isArray(stationList)) throw new Error("Invalid RDM station list response");

  return {
    version: stringValue(record?.version) ?? null,
    items: stationList.flatMap((station) => {
      const item = isRecord(station) ? station : null;
      const stationKey = stringValue(item?.crs);
      if (!stationKey) return [];
      return [
        {
          station_key: stationKey.toUpperCase(),
          station_name: stringValue(item?.Value) ?? null,
        },
      ];
    }),
  };
}

function parseValueList(
  value: unknown,
  listKey: string,
  codeKey: string,
): RdmReferencePayload<RdmTocReference> {
  const record = isRecord(value) ? value : null;
  const items = record ? recordArray(record[listKey]) : [];
  if (!record || !items.length) throw new Error(`Invalid RDM ${listKey} response`);

  return {
    version: stringValue(record.version) ?? null,
    items: items.flatMap((item) => {
      const code = stringOrNumberValue(item[codeKey]);
      if (!code) return [];
      return [
        {
          toc: code.toUpperCase(),
          name: stringValue(item.Value) ?? stringValue(item.name) ?? null,
        },
      ];
    }),
  };
}

function parseLoadingCategoryList(
  value: unknown,
): RdmReferencePayload<RdmLoadingCategoryReference> {
  const record = isRecord(value) ? value : null;
  const items = record ? recordArray(record.CategoryList) : [];
  if (!record || !items.length) throw new Error("Invalid RDM CategoryList response");

  return {
    version: stringValue(record.version) ?? null,
    items: items.flatMap((item) => {
      const code = stringOrNumberValue(item.code);
      if (!code) return [];
      const data = recordArray(item.data)[0];
      return [
        {
          code: code.toUpperCase(),
          name: stringValue(item.name) ?? null,
          typicalDescription: stringValue(data?.typicalDescription) ?? null,
          expectedDescription: stringValue(data?.expectedDescription) ?? null,
          definition: stringValue(data?.definition) ?? null,
          colour: stringValue(data?.colour) ?? null,
          image: stringValue(data?.image) ?? null,
          toc: stringValue(data?.toc) ?? null,
        },
      ];
    }),
  };
}
