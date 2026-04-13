import { createRailOntologySdk, type OntologyGraph } from "@zawa/ontology";
import type {
  DashboardResponse,
  ServiceResponse,
  StationBoardResponse,
  StationListResponse,
} from "@zawa/domain/api";
import { serviceThingId, stationThingId } from "@zawa/db/queries/ontology";

export interface OntologyEnvelope {
  ontology: OntologyGraph;
}

export async function withServiceOntology(
  db: D1Database,
  response: ServiceResponse,
): Promise<ServiceResponse & OntologyEnvelope> {
  const roots = [
    response.service.service_thing_id,
    response.service.train_run_thing_id,
    response.service.operator_thing_id,
    serviceThingId(response.service.service_key),
    ...response.stops.flatMap((stop) => [
      stop.service_thing_id,
      stop.station_thing_id,
      stationThingId(stop.station_key),
    ]),
    ...response.formations.flatMap((formation) => [
      formation.service_thing_id,
      formation.formation_thing_id,
      formation.loading_category_thing_id,
      formation.source_instance_thing_id,
      ...formation.coaches.flatMap((coach) => [coach.service_thing_id, coach.formation_thing_id]),
    ]),
    ...response.movements.flatMap((movement) => [
      movement.train_run_thing_id,
      movement.movement_thing_id,
      movement.service_thing_id,
      movement.operator_thing_id,
    ]),
  ];

  return { ...response, ontology: await createRailOntologySdk(db).getGraph(roots) };
}

export async function withStationBoardOntology(
  db: D1Database,
  response: StationBoardResponse,
): Promise<StationBoardResponse & OntologyEnvelope> {
  const roots = [
    stationThingId(response.stationKey),
    response.profile?.station_thing_id,
    ...response.rows.flatMap((row) => [
      row.station_thing_id,
      row.service_thing_id,
      stationThingId(row.station_key),
      serviceThingId(row.service_key),
    ]),
  ];

  return { ...response, ontology: await createRailOntologySdk(db).getGraph(roots) };
}

export async function withStationListOntology(
  db: D1Database,
  response: StationListResponse,
): Promise<StationListResponse & OntologyEnvelope> {
  const roots = response.stations.flatMap((station) => [
    station.station_thing_id,
    stationThingId(station.station_key),
  ]);

  return { ...response, ontology: await createRailOntologySdk(db).getGraph(roots) };
}

export async function withDashboardOntology(
  db: D1Database,
  response: DashboardResponse,
): Promise<DashboardResponse & OntologyEnvelope> {
  const roots = [
    ...response.popularStations.map((station) => stationThingId(station.station_key)),
    ...response.nextServices.flatMap((service) => [
      stationThingId(service.station_key),
      serviceThingId(service.service_key),
    ]),
  ];

  return { ...response, ontology: await createRailOntologySdk(db).getGraph(roots) };
}
