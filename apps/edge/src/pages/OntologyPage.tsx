import { useEffect, useMemo, useState } from "react";

import type { OntologyCatalog, OntologyClass, OntologyProperty } from "@zawa/ontology";
import type { OntologyGraphResponse } from "@zawa/domain/api";

import { AppShell } from "../components/AppShell";
import { MetricCard, MetricGrid } from "../components/MetricGrid";
import { OntologyBrowsePanel, type OntologyBrowseSection } from "../components/OntologyBrowsePanel";
import { PageHero } from "../components/PageHero";
import { PageLayout } from "../components/PageLayout";
import { SurfacePanel } from "../components/SurfacePanel";
import { getOntologyCatalog, getOntologyThingGraph } from "../lib/api";
import { ontologyBrowseHref, ontologyHref } from "../lib/ontology-links";

import "./OntologyPage.scss";

export type OntologyDetailRoute =
  | { kind: "class"; id: string }
  | { kind: "property"; id: string }
  | { kind: "thing"; id: string };

export function OntologyPage({
  browse,
  detail,
}: {
  browse?: OntologyBrowseSection;
  detail?: OntologyDetailRoute;
}) {
  const [catalog, setCatalog] = useState<OntologyCatalog | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [hash, setHash] = useState(() => window.location.hash);
  const activeDetail = useMemo(
    () => detail ?? detailRouteFromHash(hash, catalog),
    [catalog, detail, hash],
  );

  useEffect(() => {
    let cancelled = false;

    getOntologyCatalog()
      .then((nextCatalog) => {
        if (cancelled) return;
        setCatalog(nextCatalog);
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(null);
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  return (
    <AppShell connected={loadState === "ready"}>
      <PageLayout>
        <PageHero
          aside={<OntologyStats catalog={catalog} loadState={loadState} />}
          body={
            <p>
              Knowledge graph for linking stations, operators, services, train runs, operational
              events, formations, source evidence, and reference data.
            </p>
          }
          headingId="ontology-heading"
          title="Ontologies"
        />

        {loadState === "error" ? (
          <SurfacePanel>
            <p className="section-label">Unavailable</p>
            <h2>Ontology catalogue could not be loaded</h2>
            <p className="muted">The API is not returning ontology metadata right now.</p>
          </SurfacePanel>
        ) : browse ? (
          <OntologyBrowsePanel catalog={catalog} section={browse} />
        ) : activeDetail ? (
          <OntologyDetail detail={activeDetail} catalog={catalog} />
        ) : (
          <OntologyCatalogue catalog={catalog} />
        )}
      </PageLayout>
    </AppShell>
  );
}

function OntologyStats({
  catalog,
  loadState,
}: {
  catalog: OntologyCatalog | null;
  loadState: "loading" | "ready" | "error";
}) {
  const stats = catalog?.stats;
  const items = [
    ["Classes", stats?.class_count, ontologyBrowseHref("classes")],
    ["Properties", stats?.property_count, ontologyBrowseHref("properties")],
    ["Things", stats?.thing_count, ontologyBrowseHref("things")],
    ["Triples", stats?.triple_count, ontologyBrowseHref("triples")],
    ["Constraints", stats?.constraint_count, undefined],
    ["Quality issues", catalog?.quality.violation_count, ontologyBrowseHref("quality")],
  ] as const;

  return (
    <MetricGrid columns={2} label="Ontology counts">
      {items.map(([label, value, href]) => (
        <MetricCard
          key={label}
          href={href}
          label={label}
          value={loadState === "loading" ? "..." : (value ?? 0).toLocaleString("en-GB")}
        />
      ))}
    </MetricGrid>
  );
}

function OntologyCatalogue({ catalog }: { catalog: OntologyCatalog | null }) {
  const rootClasses = useMemo(() => classTree(catalog?.classes ?? []), [catalog?.classes]);
  const objectProperties = (catalog?.properties ?? []).filter(
    (property) => property.property_kind === "object",
  );
  const datatypeProperties = (catalog?.properties ?? []).filter(
    (property) => property.property_kind === "datatype",
  );

  return (
    <div className="ontology-grid">
      <SurfacePanel>
        <p className="section-label">Classes</p>
        <h2>Domain hierarchy</h2>
        <div className="ontology-class-list">
          {rootClasses.length ? (
            rootClasses.map((node) => <ClassNode key={node.class_id} node={node} />)
          ) : (
            <p className="muted">Classes are loading.</p>
          )}
        </div>
      </SurfacePanel>

      <PropertyPanel title="Object properties" properties={objectProperties} />
      <PropertyPanel title="Datatype properties" properties={datatypeProperties} />
    </div>
  );
}

function OntologyDetail({
  detail,
  catalog,
}: {
  detail: OntologyDetailRoute;
  catalog: OntologyCatalog | null;
}) {
  if (detail.kind === "class") return <ClassDetail classId={detail.id} catalog={catalog} />;
  if (detail.kind === "property")
    return <PropertyDetail propertyId={detail.id} catalog={catalog} />;
  return <ThingDetail thingId={detail.id} catalog={catalog} />;
}

function ClassDetail({ classId, catalog }: { classId: string; catalog: OntologyCatalog | null }) {
  const classes = catalog?.classes ?? [];
  const properties = catalog?.properties ?? [];
  const classItem = classes.find((item) => item.class_id === classId);
  const parent = classItem?.parent_class_id
    ? classes.find((item) => item.class_id === classItem.parent_class_id)
    : null;
  const children = classes.filter((item) => item.parent_class_id === classId);
  const domainProperties = properties.filter((property) => property.domain_class_id === classId);
  const rangeProperties = properties.filter((property) => property.range_class_id === classId);

  return (
    <SurfacePanel className="ontology-detail-panel">
      <OntologyDetailTopline label="Class" />
      {classItem ? (
        <>
          <div className="ontology-detail-heading">
            <p className="section-label">Ontology class</p>
            <h2 id={classAnchor(classItem.class_id)}>{classItem.label}</h2>
            <code>{classItem.class_id}</code>
            {classItem.description ? <p>{classItem.description}</p> : null}
          </div>

          <DefinitionList
            items={[
              [
                "Parent",
                parent ? (
                  <OntologyLink kind="class" id={parent.class_id} label={parent.label} />
                ) : (
                  "None"
                ),
              ],
              ["Source", classItem.source_key],
              ["Updated", classItem.updated_at],
            ]}
          />

          <RelatedList
            title="Child classes"
            emptyLabel="No child classes"
            items={children.map((item) => ({
              key: item.class_id,
              href: ontologyHref("class", item.class_id),
              label: item.label,
              meta: item.class_id,
            }))}
          />
          <RelatedList
            title="Properties with this domain"
            emptyLabel="No domain properties"
            items={domainProperties.map(propertyListItem)}
          />
          <RelatedList
            title="Properties with this range"
            emptyLabel="No range properties"
            items={rangeProperties.map(propertyListItem)}
          />
        </>
      ) : (
        <MissingDetail title="Class not found" id={classId} />
      )}
    </SurfacePanel>
  );
}

function PropertyDetail({
  propertyId,
  catalog,
}: {
  propertyId: string;
  catalog: OntologyCatalog | null;
}) {
  const classes = catalog?.classes ?? [];
  const properties = catalog?.properties ?? [];
  const property = properties.find((item) => item.property_id === propertyId);
  const childProperties = properties.filter((item) => item.parent_property_id === propertyId);
  const parent = property?.parent_property_id
    ? properties.find((item) => item.property_id === property.parent_property_id)
    : null;

  return (
    <SurfacePanel className="ontology-detail-panel">
      <OntologyDetailTopline label="Property" />
      {property ? (
        <>
          <div className="ontology-detail-heading">
            <p className="section-label">{property.property_kind} property</p>
            <h2 id={propertyAnchor(property.property_id)}>{property.label}</h2>
            <code>{property.property_id}</code>
            {property.description ? <p>{property.description}</p> : null}
          </div>

          <DefinitionList
            items={[
              [
                "Domain",
                property.domain_class_id
                  ? classValue(classes, property.domain_class_id)
                  : "rail:Thing",
              ],
              [
                "Range",
                property.range_class_id
                  ? classValue(classes, property.range_class_id)
                  : (property.range_datatype ?? "value"),
              ],
              [
                "Parent property",
                parent ? (
                  <OntologyLink kind="property" id={parent.property_id} label={parent.label} />
                ) : (
                  "None"
                ),
              ],
              ["Source", property.source_key],
              ["Updated", property.updated_at],
            ]}
          />

          <RelatedList
            title="Child properties"
            emptyLabel="No child properties"
            items={childProperties.map(propertyListItem)}
          />
        </>
      ) : (
        <MissingDetail title="Property not found" id={propertyId} />
      )}
    </SurfacePanel>
  );
}

function ThingDetail({ thingId, catalog }: { thingId: string; catalog: OntologyCatalog | null }) {
  const [graph, setGraph] = useState<OntologyGraphResponse | null>(null);
  const [graphState, setGraphState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setGraphState("loading");
    setGraph(null);

    getOntologyThingGraph(thingId)
      .then((nextGraph) => {
        if (cancelled) return;
        setGraph(nextGraph);
        setGraphState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setGraph(null);
        setGraphState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [thingId]);

  const thing = graph?.things.find((item) => item.thing_id === thingId) ?? graph?.things[0] ?? null;
  const classes = catalog?.classes ?? [];

  return (
    <SurfacePanel className="ontology-detail-panel">
      <OntologyDetailTopline label="Thing" />
      {graphState === "error" ? (
        <MissingDetail title="Thing graph unavailable" id={thingId} />
      ) : thing ? (
        <>
          <div className="ontology-detail-heading">
            <p className="section-label">Ontology thing</p>
            <h2>{thing.preferred_label ?? thing.thing_id}</h2>
            <code>{thing.thing_id}</code>
            {thing.disambiguation_hint ? <p>{thing.disambiguation_hint}</p> : null}
          </div>

          <DefinitionList
            items={[
              ["Type", classValue(classes, thing.thing_type)],
              ["Active", thing.is_active ? "Yes" : "No"],
              ["Updated", thing.updated_at],
              [
                "Graph",
                `${graph?.things.length ?? 0} things, ${graph?.triples.length ?? 0} triples`,
              ],
            ]}
          />

          <RelatedList
            title="Class assertions"
            emptyLabel="No class assertions"
            items={thing.classes.map((item) => ({
              key: item.class_id,
              href: ontologyHref("class", item.class_id),
              label: item.class_label ?? item.class_id,
              meta: item.class_id,
            }))}
          />
          <RelatedList
            title="Identifiers"
            emptyLabel="No identifiers"
            items={thing.identifiers.map((item) => ({
              key: `${item.identifier_scheme}:${item.identifier_value}`,
              label: item.identifier_value,
              meta: item.identifier_scheme,
            }))}
          />
          <TripleList graph={graph} />
        </>
      ) : (
        <MissingDetail
          title={graphState === "loading" ? "Thing graph loading" : "Thing not found"}
          id={thingId}
        />
      )}
    </SurfacePanel>
  );
}

function ClassNode({ node }: { node: ClassTreeNode }) {
  return (
    <div className="ontology-class-node" id={classAnchor(node.class_id)}>
      <a href={ontologyHref("class", node.class_id)}>{node.class_id}</a>
      <span>{node.label}</span>
      {node.children.length ? (
        <div>
          {node.children.map((child) => (
            <ClassNode key={child.class_id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PropertyPanel({ title, properties }: { title: string; properties: OntologyProperty[] }) {
  return (
    <SurfacePanel>
      <p className="section-label">Vocabulary</p>
      <h2>{title}</h2>
      <div className="ontology-property-list">
        {properties.length ? (
          properties.map((property) => (
            <article key={property.property_id} id={propertyAnchor(property.property_id)}>
              <a href={ontologyHref("property", property.property_id)}>{property.property_id}</a>
              <span>{property.label}</span>
              <small>
                {property.domain_class_id ?? "rail:Thing"} {"->"}{" "}
                {property.range_class_id ?? property.range_datatype ?? "value"}
              </small>
            </article>
          ))
        ) : (
          <p className="muted">Properties are loading.</p>
        )}
      </div>
    </SurfacePanel>
  );
}

function TripleList({ graph }: { graph: OntologyGraphResponse | null }) {
  const triples = graph?.triples ?? [];

  return (
    <section className="ontology-related">
      <h3>Graph triples</h3>
      {triples.length ? (
        <div className="ontology-triple-list">
          {triples.map((triple) => (
            <article key={triple.triple_id}>
              <a href={ontologyHref("thing", triple.subject_thing_id)}>
                {labelThing(graph, triple.subject_thing_id)}
              </a>
              <a href={ontologyHref("property", triple.predicate_id)}>
                {triple.predicate_label ?? triple.predicate_id}
              </a>
              {triple.object_thing_id ? (
                <a href={ontologyHref("thing", triple.object_thing_id)}>
                  {triple.object_preferred_label ?? triple.object_thing_id}
                </a>
              ) : (
                <span>{triple.object_literal ?? "value"}</span>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No triples are linked to this thing yet.</p>
      )}
    </section>
  );
}

function OntologyDetailTopline({ label }: { label: string }) {
  return (
    <div className="ontology-detail-topline">
      <a href="/ontologies">Ontologies</a>
      <span>{label}</span>
    </div>
  );
}

function DefinitionList({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="ontology-definition-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RelatedList({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ key: string; href?: string; label: string; meta: string }>;
}) {
  return (
    <section className="ontology-related">
      <h3>{title}</h3>
      {items.length ? (
        <div className="ontology-related-list">
          {items.map((item) =>
            item.href ? (
              <a key={item.key} href={item.href}>
                <strong>{item.label}</strong>
                <span>{item.meta}</span>
              </a>
            ) : (
              <div key={item.key}>
                <strong>{item.label}</strong>
                <span>{item.meta}</span>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="muted">{emptyLabel}</p>
      )}
    </section>
  );
}

function MissingDetail({ title, id }: { title: string; id: string }) {
  return (
    <div className="ontology-detail-heading">
      <p className="section-label">Ontology detail</p>
      <h2>{title}</h2>
      <code>{id}</code>
    </div>
  );
}

function OntologyLink({
  kind,
  id,
  label,
}: {
  kind: "class" | "property" | "thing";
  id: string;
  label: string;
}) {
  return <a href={ontologyHref(kind, id)}>{label}</a>;
}

function classValue(classes: OntologyClass[], classId: string) {
  const item = classes.find((ontologyClass) => ontologyClass.class_id === classId);
  return <OntologyLink kind="class" id={classId} label={item?.label ?? classId} />;
}

function propertyListItem(property: OntologyProperty) {
  return {
    key: property.property_id,
    href: ontologyHref("property", property.property_id),
    label: property.label,
    meta: property.property_id,
  };
}

function labelThing(graph: OntologyGraphResponse | null, thingId: string): string {
  const thing = graph?.things.find((item) => item.thing_id === thingId);
  return thing?.preferred_label ?? thingId;
}

function classAnchor(classId: string): string {
  return `class-${anchorToken(classId)}`;
}

function propertyAnchor(propertyId: string): string {
  return `property-${anchorToken(propertyId)}`;
}

function anchorToken(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function detailRouteFromHash(
  hash: string,
  catalog: OntologyCatalog | null,
): OntologyDetailRoute | undefined {
  const value = decodeURIComponent(hash.replace(/^#/, ""));
  if (!value) return undefined;

  const classMatch = value.match(/^class-(.+)$/);
  if (classMatch) return { kind: "class", id: resolveClassId(classMatch[1], catalog) };

  const propertyMatch = value.match(/^property-(.+)$/);
  if (propertyMatch) {
    return { kind: "property", id: resolvePropertyId(propertyMatch[1], catalog) };
  }

  return undefined;
}

function resolveClassId(value: string, catalog: OntologyCatalog | null): string {
  return (
    catalog?.classes.find(
      (item) => anchorToken(item.class_id) === value || item.class_id.endsWith(`:${value}`),
    )?.class_id ?? value
  );
}

function resolvePropertyId(value: string, catalog: OntologyCatalog | null): string {
  return (
    catalog?.properties.find(
      (item) => anchorToken(item.property_id) === value || item.property_id.endsWith(`:${value}`),
    )?.property_id ?? value
  );
}

type ClassTreeNode = OntologyClass & { children: ClassTreeNode[] };

function classTree(classes: OntologyClass[]): ClassTreeNode[] {
  const nodes = new Map<string, ClassTreeNode>();
  for (const item of classes) nodes.set(item.class_id, { ...item, children: [] });

  const roots: ClassTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_class_id ? nodes.get(node.parent_class_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
