import { stationThingId } from "@zawa/db/queries/ontology";
import type { ReferenceStationSummary } from "@zawa/db/queries/reference-data";
import type { OntologySearchResult } from "@zawa/ontology";

export function stationSummariesFromSearchResults(
  results: OntologySearchResult[],
): ReferenceStationSummary[] {
  return results.flatMap((result) => {
    if (result.result_kind !== "station" || !result.station_key) return [];

    return {
      station_key: result.station_key,
      station_thing_id: result.thing_id ?? stationThingId(result.station_key),
      station_name: stationSearchResultName(result),
      service_count: 0,
      next_scheduled_ts: null,
      last_updated_at: result.updated_at,
    };
  });
}

function stationSearchResultName(result: OntologySearchResult): string {
  const stationKey = result.station_key?.toUpperCase();
  const candidates = [result.title, result.match_value];
  const publicName = candidates.find((candidate): candidate is string =>
    Boolean(candidate && candidate.toUpperCase() !== stationKey),
  );

  return publicName ?? result.title;
}
