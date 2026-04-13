import { z } from "zod";

const ontologyIdentifierSchema = z.object({
  identifier_scheme: z.string(),
  identifier_value: z.string(),
  is_primary: z.number().int(),
  source_key: z.string(),
});

const ontologyLabelSchema = z.object({
  label_kind: z.string(),
  locale: z.string(),
  label: z.string(),
  source_key: z.string(),
});

const ontologyClassAssertionSchema = z.object({
  class_id: z.string(),
  class_label: z.string().nullable(),
  source_key: z.string(),
  confidence: z.number().nullable(),
});

const ontologyThingSchema = z.object({
  thing_id: z.string(),
  thing_type: z.string(),
  preferred_label: z.string().nullable(),
  disambiguation_hint: z.string().nullable(),
  is_active: z.number().int(),
  updated_at: z.string(),
  classes: z.array(ontologyClassAssertionSchema),
  identifiers: z.array(ontologyIdentifierSchema),
  labels: z.array(ontologyLabelSchema),
});

const ontologyTripleSchema = z.object({
  triple_id: z.string(),
  subject_thing_id: z.string(),
  predicate_id: z.string(),
  predicate_label: z.string().nullable(),
  predicate_kind: z.enum(["object", "datatype"]).nullable(),
  object_thing_id: z.string().nullable(),
  object_thing_type: z.string().nullable(),
  object_preferred_label: z.string().nullable(),
  object_literal: z.string().nullable(),
  object_datatype: z.string().nullable(),
  source_key: z.string(),
  confidence: z.number().nullable(),
  valid_from: z.string().nullable(),
  valid_to: z.string().nullable(),
  updated_at: z.string(),
});

const ontologyGraphSchema = z.object({
  rootThingIds: z.array(z.string()),
  things: z.array(ontologyThingSchema),
  triples: z.array(ontologyTripleSchema),
});

const ontologyQualitySummarySchema = z.object({
  run_key: z.string().nullable(),
  checked_at: z.string().nullable(),
  violation_count: z.number().int().nonnegative(),
  error_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
});

const ontologyQualityViolationSchema = z.object({
  run_key: z.string(),
  violation_id: z.string(),
  constraint_id: z.string(),
  severity: z.enum(["error", "warning"]),
  thing_id: z.string().nullable(),
  property_id: z.string().nullable(),
  violation_kind: z.string(),
  message: z.string(),
  observed_value: z.string().nullable(),
  checked_at: z.string(),
});

const ontologyPageMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const ontologyThingPageResponseSchema = ontologyPageMetaSchema.extend({
  items: z.array(ontologyThingSchema),
});

export const ontologyTriplePageResponseSchema = ontologyPageMetaSchema.extend({
  items: z.array(ontologyTripleSchema),
});

export const ontologyQualityViolationPageResponseSchema = ontologyPageMetaSchema.extend({
  items: z.array(ontologyQualityViolationSchema),
  summary: ontologyQualitySummarySchema,
});

const searchResultKindSchema = z.enum([
  "station",
  "service",
  "operator",
  "incident",
  "operator_disruption",
  "station_disruption",
  "station_message",
  "service_formation",
  "loading_category",
  "reason_code",
  "source_instance",
  "train_run",
  "train_movement",
  "ontology_class",
  "ontology_property",
  "ontology_thing",
]);

const searchResultSchema = z.object({
  result_id: z.string(),
  result_kind: searchResultKindSchema,
  thing_id: z.string().nullable(),
  thing_type: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  match_label: z.string(),
  match_value: z.string().nullable(),
  predicate_id: z.string().nullable(),
  predicate_label: z.string().nullable(),
  station_key: z.string().nullable(),
  service_key: z.string().nullable(),
  score: z.number().int(),
  updated_at: z.string().nullable(),
});

export const searchResponseSchema = z.object({
  query: z.string(),
  results: z.array(searchResultSchema),
});

const stationBoardRowSchema = z.object({
  station_key: z.string(),
  station_thing_id: z.string().optional(),
  board_type: z.string(),
  service_key: z.string(),
  service_thing_id: z.string().optional(),
  scheduled_ts: z.string().nullable(),
  expected_ts: z.string().nullable(),
  platform: z.string().nullable(),
  origin_name: z.string().nullable(),
  destination_name: z.string().nullable(),
  via_name: z.string().nullable(),
  service_type: z.string().nullable().default(null),
  operator_code: z.string().nullable(),
  status: z.string(),
  updated_at: z.string(),
});

const stationProfileSchema = z.object({
  station_key: z.string(),
  station_thing_id: z.string().optional(),
  station_name: z.string(),
  sixteen_character_name: z.string().nullable(),
  national_location_code: z.string().nullable(),
  station_operator: z.string().nullable(),
  station_operator_thing_id: z.string().nullable().optional(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  address_line_1: z.string().nullable(),
  address_line_2: z.string().nullable(),
  address_line_3: z.string().nullable(),
  address_line_4: z.string().nullable(),
  postcode: z.string().nullable(),
  staffing_level: z.string().nullable(),
  cctv_available: z.number().nullable(),
  cis_modes: z.string().nullable(),
  customer_help_points_available: z.number().nullable(),
  ticket_office_available: z.number().nullable(),
  ticket_machine_available: z.number().nullable(),
  oyster_accepted: z.number().nullable(),
  smartcard_validator: z.number().nullable(),
  seated_area_available: z.number().nullable(),
  waiting_room_available: z.number().nullable(),
  toilets_available: z.number().nullable(),
  wifi_available: z.number().nullable(),
  induction_loop: z.number().nullable(),
  accessible_ticket_machines: z.number().nullable(),
  ramp_for_train_access: z.number().nullable(),
  accessible_taxis_available: z.number().nullable(),
  national_key_toilets_available: z.number().nullable(),
  step_free_access_coverage: z.string().nullable(),
  impaired_mobility_set_down_available: z.number().nullable(),
  cycle_storage_spaces: z.number().int().nullable(),
  car_park_spaces: z.number().int().nullable(),
  accessible_car_park_spaces: z.number().int().nullable(),
  rail_replacement_map_url: z.string().nullable(),
  profile_status: z.string().nullable(),
  profile_checked_at: z.string().nullable(),
  updated_at: z.string(),
});

const stationNoticeSchema = z.object({
  id: z.string(),
  station_key: z.string(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  category: z.string().nullable(),
  severity: z.string().nullable(),
  updated_at: z.string(),
});

const serviceIncidentSchema = z.object({
  incident_id: z.string(),
  planned: z.number().nullable(),
  priority: z.number().int().nullable(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  routes_affected: z.string().nullable(),
  info_link_url: z.string().nullable(),
  info_link_label: z.string().nullable(),
  operator_code: z.string().nullable(),
  operator_name: z.string().nullable(),
  updated_at: z.string(),
});

const stationSummarySchema = z.object({
  station_key: z.string(),
  station_thing_id: z.string().optional(),
  station_name: z.string().nullable(),
  service_count: z.number().int().nonnegative(),
  next_scheduled_ts: z.string().nullable(),
  last_updated_at: z.string().nullable(),
});

export const stationBoardResponseSchema = z.object({
  stationKey: z.string(),
  stationName: z.string().nullable(),
  boardType: z.enum(["departures", "arrivals"]),
  rows: z.array(stationBoardRowSchema),
  profile: stationProfileSchema.nullable().default(null),
  notices: z.array(stationNoticeSchema).default([]),
  incidents: z.array(serviceIncidentSchema).default([]),
  previousCursor: z.string().nullable().default(null),
  nextCursor: z.string().nullable().default(null),
  ontology: ontologyGraphSchema.optional(),
});

export const stationListResponseSchema = z.object({
  stations: z.array(stationSummarySchema),
  ontology: ontologyGraphSchema.optional(),
});

const serviceSchema = z.object({
  service_key: z.string(),
  service_thing_id: z.string().optional(),
  train_run_key: z.string().nullable(),
  train_run_thing_id: z.string().nullable().optional(),
  rid: z.string().nullable(),
  uid: z.string().nullable(),
  train_id: z.string().nullable(),
  rsid: z.string().nullable(),
  operator_code: z.string().nullable(),
  operator_thing_id: z.string().nullable().optional(),
  origin_name: z.string().nullable(),
  destination_name: z.string().nullable(),
  service_type: z.string().nullable(),
  category: z.string().nullable(),
  activities: z.string().nullable(),
  service_length: z.number().int().nullable(),
  is_passenger_service: z.number().int().nullable(),
  is_charter: z.number().int().nullable(),
  is_reverse_formation: z.number().int().nullable(),
  detach_front: z.number().int().nullable(),
  scheduled_start_ts: z.string().nullable(),
  expected_start_ts: z.string().nullable(),
  status: z.string(),
  delay_minutes: z.number().nullable(),
  cancellation_reason: z.string().nullable(),
  last_event_id: z.string(),
  updated_at: z.string(),
});

const serviceStopSchema = z.object({
  service_key: z.string(),
  service_thing_id: z.string().optional(),
  stop_index: z.number().int(),
  station_key: z.string(),
  station_thing_id: z.string().optional(),
  station_name: z.string().nullable(),
  tiploc: z.string().nullable(),
  scheduled_arrival_ts: z.string().nullable(),
  expected_arrival_ts: z.string().nullable(),
  actual_arrival_ts: z.string().nullable(),
  scheduled_departure_ts: z.string().nullable(),
  expected_departure_ts: z.string().nullable(),
  actual_departure_ts: z.string().nullable(),
  arrival_type: z.string().nullable(),
  arrival_source: z.string().nullable(),
  arrival_source_instance: z.string().nullable(),
  departure_type: z.string().nullable(),
  departure_source: z.string().nullable(),
  departure_source_instance: z.string().nullable(),
  platform: z.string().nullable(),
  platform_is_hidden: z.number().int().nullable(),
  path: z.string().nullable(),
  line: z.string().nullable(),
  activities: z.string().nullable(),
  is_pass: z.number().int().nullable(),
  is_operational: z.number().int().nullable(),
  stop_cancel_reason: z.string().nullable(),
  stop_delay_reason: z.string().nullable(),
  stop_status: z.string().nullable(),
  updated_at: z.string(),
});

const serviceSummarySchema = z.object({
  calling_point_count: z.number().int().nonnegative(),
  scheduled_duration_minutes: z.number().int().nonnegative().nullable(),
  expected_duration_minutes: z.number().int().nonnegative().nullable(),
  delay_minutes: z.number().nullable(),
});

const serviceCoachSchema = z.object({
  service_key: z.string(),
  service_thing_id: z.string().optional(),
  formation_index: z.number().int(),
  formation_thing_id: z.string().optional(),
  coach_index: z.number().int(),
  coach_thing_id: z.string().optional(),
  tiploc: z.string().nullable(),
  coach_number: z.string().nullable(),
  coach_class: z.string().nullable(),
  toilet_status: z.string().nullable(),
  toilet_value: z.string().nullable(),
  loading: z.number().int().nullable(),
  loading_specified: z.number().int().nullable(),
  updated_at: z.string(),
});

const serviceFormationSchema = z.object({
  service_key: z.string(),
  service_thing_id: z.string().optional(),
  formation_index: z.number().int(),
  formation_thing_id: z.string().optional(),
  tiploc: z.string().nullable(),
  loading_category_code: z.string().nullable(),
  loading_category_thing_id: z.string().nullable().optional(),
  loading_category_name: z.string().nullable(),
  loading_category_colour: z.string().nullable(),
  loading_category_image: z.string().nullable(),
  loading_percentage: z.number().int().nullable(),
  source: z.string().nullable(),
  source_instance: z.string().nullable(),
  source_instance_thing_id: z.string().nullable().optional(),
  updated_at: z.string(),
  coaches: z.array(serviceCoachSchema).default([]),
});

const serviceMovementSchema = z.object({
  train_run_key: z.string(),
  train_run_thing_id: z.string().optional(),
  movement_index: z.number().int(),
  movement_thing_id: z.string().optional(),
  service_key: z.string().nullable(),
  service_thing_id: z.string().nullable().optional(),
  train_id: z.string().nullable(),
  train_uid: z.string().nullable(),
  toc: z.string().nullable(),
  operator_thing_id: z.string().nullable().optional(),
  train_service_code: z.string().nullable(),
  stanox: z.string().nullable(),
  reporting_stanox: z.string().nullable(),
  platform: z.string().nullable(),
  path: z.string().nullable(),
  line: z.string().nullable(),
  planned_event_type: z.string().nullable(),
  event_type: z.string().nullable(),
  planned_ts: z.string().nullable(),
  gbtt_ts: z.string().nullable(),
  actual_ts: z.string().nullable(),
  timetable_variation_minutes: z.number().int().nullable(),
  variation_status: z.string().nullable(),
  auto_expected: z.number().int().nullable(),
  updated_at: z.string(),
});

export const serviceResponseSchema = z.object({
  service: serviceSchema,
  stops: z.array(serviceStopSchema),
  summary: serviceSummarySchema,
  formations: z.array(serviceFormationSchema).default([]),
  movements: z.array(serviceMovementSchema).default([]),
  incidents: z.array(serviceIncidentSchema).default([]),
  stationProfiles: z.array(stationProfileSchema).default([]),
  ontology: ontologyGraphSchema.optional(),
});

const dashboardMetricsSchema = z.object({
  station_count: z.number().int().nonnegative(),
  visible_service_count: z.number().int().nonnegative(),
  delayed_service_count: z.number().int().nonnegative(),
  cancelled_service_count: z.number().int().nonnegative(),
  active_incident_count: z.number().int().nonnegative(),
  operator_count: z.number().int().nonnegative(),
  operator_issue_count: z.number().int().nonnegative(),
  last_updated_at: z.string().nullable(),
});

const dashboardStationSchema = z.object({
  station_key: z.string(),
  station_name: z.string().nullable(),
  service_count: z.number().int().nonnegative(),
  delayed_service_count: z.number().int().nonnegative(),
  next_scheduled_ts: z.string().nullable(),
  last_updated_at: z.string().nullable(),
});

const dashboardServiceSchema = z.object({
  station_key: z.string(),
  station_name: z.string().nullable(),
  board_type: z.string(),
  service_key: z.string(),
  scheduled_ts: z.string().nullable(),
  expected_ts: z.string().nullable(),
  platform: z.string().nullable(),
  destination_name: z.string().nullable(),
  operator_code: z.string().nullable(),
  status: z.string(),
  updated_at: z.string(),
});

const dashboardIncidentSchema = z.object({
  incident_id: z.string(),
  priority: z.number().int().nullable(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  routes_affected: z.string().nullable(),
  info_link_url: z.string().nullable(),
  info_link_label: z.string().nullable(),
  updated_at: z.string(),
  operator_names: z.string().nullable(),
});

const dashboardOperatorStatusSchema = z.object({
  toc_code: z.string(),
  toc_name: z.string().nullable(),
  status: z.string(),
  status_description: z.string().nullable(),
  updated_at: z.string(),
});

const dashboardSyncStateSchema = z.object({
  source_key: z.string(),
  status: z.string(),
  item_count: z.number().int().nonnegative(),
  last_checked_at: z.string(),
  last_changed_at: z.string().nullable(),
  error_message: z.string().nullable(),
});

export const dashboardResponseSchema = z.object({
  generatedAt: z.string(),
  metrics: dashboardMetricsSchema,
  popularStations: z.array(dashboardStationSchema),
  nextServices: z.array(dashboardServiceSchema),
  incidents: z.array(dashboardIncidentSchema),
  operatorStatuses: z.array(dashboardOperatorStatusSchema),
  syncStates: z.array(dashboardSyncStateSchema),
  ontology: ontologyGraphSchema.optional(),
});

export type StationBoardResponse = z.infer<typeof stationBoardResponseSchema>;
export type StationListResponse = z.infer<typeof stationListResponseSchema>;
export type ServiceResponse = z.infer<typeof serviceResponseSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type OntologyGraphResponse = z.infer<typeof ontologyGraphSchema>;
export type OntologyThingPageResponse = z.infer<typeof ontologyThingPageResponseSchema>;
export type OntologyTriplePageResponse = z.infer<typeof ontologyTriplePageResponseSchema>;
export type OntologyQualityViolationPageResponse = z.infer<
  typeof ontologyQualityViolationPageResponseSchema
>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export function parseStationBoardResponse(data: unknown): StationBoardResponse {
  return stationBoardResponseSchema.parse(data);
}

export function parseStationListResponse(data: unknown): StationListResponse {
  return stationListResponseSchema.parse(data);
}

export function parseServiceResponse(data: unknown): ServiceResponse {
  return serviceResponseSchema.parse(data);
}

export function parseDashboardResponse(data: unknown): DashboardResponse {
  return dashboardResponseSchema.parse(data);
}

export function parseOntologyThingPageResponse(data: unknown): OntologyThingPageResponse {
  return ontologyThingPageResponseSchema.parse(data);
}

export function parseOntologyTriplePageResponse(data: unknown): OntologyTriplePageResponse {
  return ontologyTriplePageResponseSchema.parse(data);
}

export function parseOntologyQualityViolationPageResponse(
  data: unknown,
): OntologyQualityViolationPageResponse {
  return ontologyQualityViolationPageResponseSchema.parse(data);
}

export function parseSearchResponse(data: unknown): SearchResponse {
  return searchResponseSchema.parse(data);
}
