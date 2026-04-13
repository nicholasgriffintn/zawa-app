export type RdmProductUse = "integrate-now" | "future-candidate";

export interface RdmProduct {
  code: string;
  name: string;
  sourceType: "Streaming" | "API" | "File Source";
  use: RdmProductUse;
  purpose: string;
  notes: string;
}

export const rdmProducts = {
  liveArrivalDepartureBoards: {
    code: "P-2eec03eb-4d53-4955-8a96-0314964a4e9e",
    name: "Live Arrival and Departure Boards",
    sourceType: "API",
    use: "integrate-now",
    purpose:
      "Primary station board source for live arrivals, departures, platforms, NRCC messages, and service availability.",
    notes:
      "Use this for the public station-board API instead of relying on a local projection as the only board source.",
  },
  serviceDetails: {
    code: "P-4dec1247-d040-4290-80a4-639dfac54a92",
    name: "Service Details",
    sourceType: "API",
    use: "integrate-now",
    purpose:
      "Primary per-service source for calling points, live times, cancellation/diversion reasons, formation, and platform data.",
    notes: "Use with service IDs returned by Live Arrival and Departure Boards.",
  },
  queryServicesAndDetails: {
    code: "P-9a4b5235-d06a-483d-b12f-7d0d95b06b18",
    name: "Query Services and Service Details",
    sourceType: "API",
    use: "integrate-now",
    purpose: "Service search and direct service-detail lookup for full service pages.",
    notes: "Useful when a user lands on a service page without first loading a board.",
  },
  referenceData: {
    code: "P-c73f0d2a-c233-497d-846b-8354e2cac326",
    name: "Reference Data",
    sourceType: "API",
    use: "integrate-now",
    purpose:
      "Reference data for stations, TOCs, loading categories, reason codes, and CIS source details.",
    notes: "Use this to enrich board and service responses without hard-coded local lists.",
  },
  knowledgebaseStations: {
    code: "P-88ffe920-471c-4fd9-8e0d-95d5b9b7a257",
    name: "Knowledgebase Stations data feed",
    sourceType: "API",
    use: "integrate-now",
    purpose:
      "Open station metadata including CRS, location, operators, and journey-planning context.",
    notes: "Use for station search, station display names, and station profile fields.",
  },
  stationsJson: {
    code: "P-9c97bd03-e2f2-462d-860a-5bec92700c2d",
    name: "NationalRail Knowledgebase Stations (JSON) - Prod",
    sourceType: "API",
    use: "integrate-now",
    purpose: "Current production JSON station metadata feed.",
    notes:
      "RDM metadata describes /stations, /stations/{crs}, and /stations/tocs/{toc}. Prefer this if subscription access supersedes the older Knowledgebase Stations product.",
  },
  disruptionList: {
    code: "P-fffd1a4b-9fee-4d07-8102-efa8ce848d81",
    name: "Disruption List",
    sourceType: "API",
    use: "integrate-now",
    purpose: "Disruptions for specified CRS codes.",
    notes: "Use for station-level disruption panels.",
  },
  nationalServiceIndicator: {
    code: "P-7a5989cb-4600-4727-9ab0-baa7e483a0f2",
    name: "Knowledgebase National Service Indicator data",
    sourceType: "API",
    use: "integrate-now",
    purpose: "Current incidents, TOC status, route delays, timetable changes, and disruptions.",
    notes:
      "Use for operator and network health summaries; it does not provide live train-level running data.",
  },
  incidents: {
    code: "P-cf16832d-d971-46e7-8883-4fca2101d3fa",
    name: "Knowledgebase Incidents data",
    sourceType: "API",
    use: "integrate-now",
    purpose: "Incident summaries, affected operators, planned/unplanned flags, and priority.",
    notes: "Use to enrich disruption and incident detail views.",
  },
  timetableFiles: {
    code: "P-9ca6bc7e-62e1-44d6-b93a-1616f7d2caf8",
    name: "Darwin Timetable Files",
    sourceType: "File Source",
    use: "integrate-now",
    purpose: "Base timetable files to seed schedules before realtime overlay events arrive.",
    notes: "RDM says these files are intended to be used with Darwin Real Time Train Information.",
  },
  realtimeTrainInformation: {
    code: "P-d3bf124c-1058-4040-8a62-87181a877d59",
    name: "Darwin Real Time Train Information",
    sourceType: "Streaming",
    use: "integrate-now",
    purpose: "Realtime prediction, cancellation, and delay-reason stream for local projections.",
    notes: "Use through RDM delivery only; do not connect to direct National Rail Push Port hosts.",
  },
  trainMovements: {
    code: "P-826477b8-3789-45e7-85bd-22c4ae9bcfae",
    name: "NWR Train Movements",
    sourceType: "Streaming",
    use: "integrate-now",
    purpose: "TRUST train progress and movement events in realtime.",
    notes:
      "Use for movement/timing corroboration; it reports events that have happened and does not provide predictions.",
  },
  realtimeTrainInformationPush: {
    code: "P-3f10bf96-d8e8-4041-aa5e-d75d82c45c4e",
    name: "Darwin Real Time Train Information (Push)",
    sourceType: "Streaming",
    use: "future-candidate",
    purpose: "Kafka Pub/Sub variant of Darwin realtime train-running information.",
    notes:
      "Keep documented until RDM subscription delivery details confirm whether it replaces or complements the non-Push realtime product.",
  },
  trainDescriber: {
    code: "P-8d5f90a7-2fce-4179-b233-0dd272cee896",
    name: "NWR Train Describer (TD)",
    sourceType: "Streaming",
    use: "future-candidate",
    purpose: "Berth-level train positioning.",
    notes: "Useful for map-grade tracking, but needs TD berth interpretation and SMART data.",
  },
  smart: {
    code: "P-883f25d9-9483-4d26-9975-81203795243f",
    name: "NWR SMART",
    sourceType: "File Source",
    use: "future-candidate",
    purpose: "Maps train-describer berth steps to arrivals and departures.",
    notes: "Pair with Train Describer if berth-level tracking is added.",
  },
  nwrSchedule: {
    code: "P-dbd92416-2f09-4f72-ad42-d53bbfec50f3",
    name: "NWR Schedule",
    sourceType: "File Source",
    use: "future-candidate",
    purpose: "ITPS schedule, association, and TIPLOC data.",
    notes: "Consider if Darwin timetable files are insufficient for seed schedules.",
  },
  vstp: {
    code: "P-3cc7c8b3-a311-406b-85ed-8032c60f1b29",
    name: "NWR Very Short-Term Planning (VSTP)",
    sourceType: "Streaming",
    use: "future-candidate",
    purpose: "Late-notice schedules that may be absent from schedule files.",
    notes: "Useful once a timetable ingestion path exists.",
  },
  realtimePerformanceData: {
    code: "P-80b653cd-bb2a-4897-a69a-4980e6e554da",
    name: "NWR Realtime Performance Data API",
    sourceType: "API",
    use: "future-candidate",
    purpose: "Network and operator-level performance metrics.",
    notes: "Useful for status summaries, but not a station-board source.",
  },
  realtimePerformanceReferenceData: {
    code: "P-b9e4eb57-e690-44b4-a0d2-3a6447b33258",
    name: "NWR Realtime Performance Reference Data API",
    sourceType: "API",
    use: "future-candidate",
    purpose: "Reference data for realtime performance metrics.",
    notes: "Pair with the performance data API if performance dashboards are added.",
  },
  rtppm: {
    code: "P-8c086887-c4bc-4608-83e2-76c5c4d728ad",
    name: "NWR Real Time Public Performance Measure (RTPPM)",
    sourceType: "Streaming",
    use: "future-candidate",
    purpose: "One-minute public performance measure stream.",
    notes: "Useful for aggregate health indicators; not service-level board data.",
  },
  historicalServicePerformance: {
    code: "P-2dfd6e84-c3e7-460f-8b3c-ac201d259f51",
    name: "Historical Service Performance (HSP)",
    sourceType: "API",
    use: "future-candidate",
    purpose: "Historical performance between locations and dates.",
    notes: "Useful for reliability context and analytics, not live boards.",
  },
  passengerTrainAllocationAndConsist: {
    code: "P-3a2ccb58-e1f9-416b-a40e-0614d0269ecf",
    name: "NWR Passenger Train Allocation and Consist",
    sourceType: "Streaming",
    use: "future-candidate",
    purpose: "Unit, vehicle, consist, capacity, and livery context.",
    notes: "Useful for train composition features after core boards are stable.",
  },
} as const satisfies Record<string, RdmProduct>;

export const integratedRdmProducts = Object.values(rdmProducts).filter(
  (product) => product.use === "integrate-now",
);

export const futureRdmProducts = Object.values(rdmProducts).filter(
  (product) => product.use === "future-candidate",
);
