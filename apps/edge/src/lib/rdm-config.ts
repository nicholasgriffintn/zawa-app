import { rdmProducts } from "@zawa/domain/rdm-products";

export interface RdmRuntimeEnv {
  RDM_REALTIME_PRODUCT_CODE: string;
  RDM_LDB_PRODUCT_CODE: string;
  RDM_SERVICE_DETAILS_PRODUCT_CODE: string;
  RDM_QUERY_SERVICES_PRODUCT_CODE: string;
  RDM_REFERENCE_DATA_PRODUCT_CODE: string;
  RDM_STATIONS_PRODUCT_CODE: string;
  RDM_STATIONS_JSON_PRODUCT_CODE: string;
  RDM_DISRUPTIONS_PRODUCT_CODE: string;
  RDM_NSI_PRODUCT_CODE: string;
  RDM_INCIDENTS_PRODUCT_CODE: string;
  RDM_TIMETABLE_PRODUCT_CODE: string;
  RDM_TRAIN_MOVEMENTS_PRODUCT_CODE: string;
  RDM_LDB_ARR_DEP_WITH_DETAILS_URL: string;
  RDM_LDB_ARR_DEP_URL: string;
  RDM_SERVICE_DETAILS_URL: string;
  RDM_QUERY_SERVICES_URL: string;
  RDM_QUERY_SERVICE_DETAILS_BY_RID_URL: string;
  RDM_REFERENCE_STATION_LIST_URL: string;
  RDM_REFERENCE_TOC_LIST_URL: string;
  RDM_REFERENCE_REASON_CODE_LIST_URL: string;
  RDM_REFERENCE_LOADING_CATEGORY_URL: string;
  RDM_REFERENCE_SOURCE_INSTANCE_NAMES_URL: string;
  RDM_STATIONS_TOC_URL: string;
  RDM_STATION_BY_CRS_URL: string;
  RDM_DISRUPTION_LIST_URL: string;
  RDM_NSI_URL: string;
  RDM_NSI_TOC_URL: string;
  RDM_INCIDENTS_URL: string;
  RDM_LDB_API_KEY: string;
  RDM_SERVICE_DETAILS_API_KEY: string;
  RDM_QUERY_SERVICES_API_KEY: string;
  RDM_REFERENCE_DATA_API_KEY: string;
  RDM_STATIONS_API_KEY: string;
  RDM_DISRUPTIONS_API_KEY: string;
  RDM_NSI_API_KEY: string;
  RDM_INCIDENTS_API_KEY: string;
}

export interface RdmConfigReport {
  ok: boolean;
  productIssues: string[];
  missingDeliveryConfigKeys: string[];
  missingCredentialKeys: string[];
}

const rdmProductConfig = [
  ["RDM_REALTIME_PRODUCT_CODE", rdmProducts.realtimeTrainInformation.code],
  ["RDM_LDB_PRODUCT_CODE", rdmProducts.liveArrivalDepartureBoards.code],
  ["RDM_SERVICE_DETAILS_PRODUCT_CODE", rdmProducts.serviceDetails.code],
  ["RDM_QUERY_SERVICES_PRODUCT_CODE", rdmProducts.queryServicesAndDetails.code],
  ["RDM_REFERENCE_DATA_PRODUCT_CODE", rdmProducts.referenceData.code],
  ["RDM_STATIONS_PRODUCT_CODE", rdmProducts.knowledgebaseStations.code],
  ["RDM_STATIONS_JSON_PRODUCT_CODE", rdmProducts.stationsJson.code],
  ["RDM_DISRUPTIONS_PRODUCT_CODE", rdmProducts.disruptionList.code],
  ["RDM_NSI_PRODUCT_CODE", rdmProducts.nationalServiceIndicator.code],
  ["RDM_INCIDENTS_PRODUCT_CODE", rdmProducts.incidents.code],
  ["RDM_TIMETABLE_PRODUCT_CODE", rdmProducts.timetableFiles.code],
  ["RDM_TRAIN_MOVEMENTS_PRODUCT_CODE", rdmProducts.trainMovements.code],
] as const satisfies readonly (readonly [keyof RdmRuntimeEnv, string])[];

const requiredDeliveryConfigKeys = [
  "RDM_LDB_ARR_DEP_WITH_DETAILS_URL",
  "RDM_LDB_ARR_DEP_URL",
  "RDM_SERVICE_DETAILS_URL",
  "RDM_QUERY_SERVICES_URL",
  "RDM_QUERY_SERVICE_DETAILS_BY_RID_URL",
  "RDM_REFERENCE_STATION_LIST_URL",
  "RDM_REFERENCE_TOC_LIST_URL",
  "RDM_REFERENCE_REASON_CODE_LIST_URL",
  "RDM_REFERENCE_LOADING_CATEGORY_URL",
  "RDM_REFERENCE_SOURCE_INSTANCE_NAMES_URL",
  "RDM_STATIONS_TOC_URL",
  "RDM_STATION_BY_CRS_URL",
  "RDM_DISRUPTION_LIST_URL",
  "RDM_NSI_URL",
  "RDM_NSI_TOC_URL",
  "RDM_INCIDENTS_URL",
] as const satisfies readonly (keyof RdmRuntimeEnv)[];

const requiredCredentialKeys = [
  "RDM_LDB_API_KEY",
  "RDM_SERVICE_DETAILS_API_KEY",
  "RDM_QUERY_SERVICES_API_KEY",
  "RDM_REFERENCE_DATA_API_KEY",
  "RDM_STATIONS_API_KEY",
  "RDM_DISRUPTIONS_API_KEY",
  "RDM_NSI_API_KEY",
  "RDM_INCIDENTS_API_KEY",
] as const satisfies readonly (keyof RdmRuntimeEnv)[];

export function evaluateRdmConfig(env: RdmRuntimeEnv): RdmConfigReport {
  const productIssues = rdmProductConfig.flatMap(([key, expected]) => {
    const configured = env[key]?.trim();
    if (configured === expected) return [];
    return [`${key} expected ${expected} but received ${configured || "empty"}`];
  });

  const missingDeliveryConfigKeys = requiredDeliveryConfigKeys.filter((key) => !env[key]?.trim());
  const missingCredentialKeys = requiredCredentialKeys.filter((key) => !env[key]?.trim());

  return {
    ok:
      productIssues.length === 0 &&
      missingDeliveryConfigKeys.length === 0 &&
      missingCredentialKeys.length === 0,
    productIssues,
    missingDeliveryConfigKeys: [...missingDeliveryConfigKeys],
    missingCredentialKeys: [...missingCredentialKeys],
  };
}
