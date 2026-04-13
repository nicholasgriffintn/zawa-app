import type { SearchResponse } from "@zawa/domain/api";

import { ontologyHref } from "./ontology-links";
import { stationBoardHref } from "./station-search";

export type AppSearchResult = SearchResponse["results"][number];

const RESULT_KIND_LABELS: Record<AppSearchResult["result_kind"], string> = {
  station: "Station",
  service: "Service",
  operator: "Operator",
  incident: "Incident",
  operator_disruption: "Operator disruption",
  station_disruption: "Station disruption",
  station_message: "Station message",
  service_formation: "Formation",
  loading_category: "Loading category",
  reason_code: "Reason code",
  source_instance: "Source",
  train_run: "Train run",
  train_movement: "Train movement",
  ontology_class: "Class",
  ontology_property: "Predicate",
  ontology_thing: "Thing",
};

export function searchResultHref(result: AppSearchResult): string {
  if (result.result_kind === "station" && result.station_key) {
    return stationBoardHref(result.station_key);
  }
  if (result.result_kind === "service" && result.service_key) {
    return `/services/${encodeURIComponent(result.service_key)}`;
  }
  if (result.result_kind === "ontology_class") {
    return ontologyHref("class", result.result_id);
  }
  if (result.result_kind === "ontology_property") {
    return ontologyHref("property", result.result_id);
  }
  if (result.thing_id) {
    return ontologyHref("thing", result.thing_id);
  }

  return "/ontologies";
}

export function searchResultKindLabel(result: AppSearchResult): string {
  return RESULT_KIND_LABELS[result.result_kind];
}

export function searchResultContext(result: AppSearchResult): string {
  const label = searchResultKindLabel(result);
  const subtitle = result.subtitle?.trim();
  if (!subtitle) return label;
  return `${label} - ${subtitle}`;
}

export function searchResultMatchLabel(result: AppSearchResult): string {
  const value = result.match_value?.trim();
  if (!value || value === result.title || value === result.subtitle) return result.match_label;
  return `${result.match_label}: ${value}`;
}
