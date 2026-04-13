import type { OntologyGraphResponse } from "@zawa/domain/api";

export interface OntologySummaryToken {
  id: string;
  label: string;
}

export interface OntologySummaryViewModel {
  rootCount: number;
  thingCount: number;
  tripleCount: number;
  roots: OntologySummaryToken[];
  classes: OntologySummaryToken[];
  predicates: OntologySummaryToken[];
  primaryRootThingId: string | null;
}

export function ontologySummaryViewModel(
  graph: OntologyGraphResponse | null | undefined,
): OntologySummaryViewModel {
  if (!graph) {
    return {
      rootCount: 0,
      thingCount: 0,
      tripleCount: 0,
      roots: [],
      classes: [],
      predicates: [],
      primaryRootThingId: null,
    };
  }

  const thingsById = new Map(graph.things.map((thing) => [thing.thing_id, thing]));

  return {
    rootCount: graph.rootThingIds.length,
    thingCount: graph.things.length,
    tripleCount: graph.triples.length,
    roots: uniqueTokens(
      graph.rootThingIds.map((thingId) => ({
        id: thingId,
        label: thingsById.get(thingId)?.preferred_label ?? thingId,
      })),
    ).slice(0, 4),
    classes: uniqueTokens(
      graph.things.flatMap((thing) =>
        thing.classes.map((classAssertion) => ({
          id: classAssertion.class_id,
          label: classAssertion.class_label ?? classAssertion.class_id,
        })),
      ),
    ).slice(0, 4),
    predicates: uniqueTokens(
      graph.triples.map((triple) => ({
        id: triple.predicate_id,
        label: triple.predicate_label ?? triple.predicate_id,
      })),
    ).slice(0, 4),
    primaryRootThingId: graph.rootThingIds[0] ?? null,
  };
}

function uniqueTokens(
  values: Array<OntologySummaryToken | null | undefined>,
): OntologySummaryToken[] {
  const seen = new Set<string>();
  const uniqueValues: OntologySummaryToken[] = [];

  for (const value of values) {
    const id = value?.id.trim();
    const label = value?.label.trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    uniqueValues.push({ id, label });
  }

  return uniqueValues;
}
