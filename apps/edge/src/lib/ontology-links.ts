export type OntologyLinkKind = "class" | "property" | "thing";

export function ontologyHref(kind: OntologyLinkKind, id: string): string {
  const pathKind = kind === "class" ? "classes" : kind === "property" ? "properties" : "things";
  return `/ontologies/${pathKind}/${encodeURIComponent(id)}`;
}

export function ontologyBrowseHref(
  kind: "classes" | "properties" | "things" | "triples" | "quality",
): string {
  return `/ontologies/${kind}`;
}
