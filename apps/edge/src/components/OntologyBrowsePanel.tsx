import { useEffect, useState, type ReactNode } from "react";

import type {
  OntologyQualityViolationPageResponse,
  OntologyThingPageResponse,
  OntologyTriplePageResponse,
} from "@zawa/domain/api";
import type { OntologyCatalog, OntologyClass } from "@zawa/ontology";

import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  getOntologyQualityViolationPage,
  getOntologyThingPage,
  getOntologyTriplePage,
} from "../lib/api";
import { ontologyHref } from "../lib/ontology-links";
import { SurfacePanel } from "./SurfacePanel";

import "./OntologyBrowsePanel.scss";

export type OntologyBrowseSection = "classes" | "properties" | "things" | "triples" | "quality";

const PAGE_SIZE = 20;

export function OntologyBrowsePanel({
  catalog,
  section,
}: {
  catalog: OntologyCatalog | null;
  section: OntologyBrowseSection;
}) {
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [section]);

  if (section === "classes") {
    return (
      <CatalogClassBrowser catalog={catalog} pageIndex={pageIndex} setPageIndex={setPageIndex} />
    );
  }

  if (section === "properties") {
    return (
      <CatalogPropertyBrowser catalog={catalog} pageIndex={pageIndex} setPageIndex={setPageIndex} />
    );
  }

  if (section === "things") {
    return <ThingBrowser catalog={catalog} pageIndex={pageIndex} setPageIndex={setPageIndex} />;
  }

  if (section === "triples") {
    return <TripleBrowser catalog={catalog} pageIndex={pageIndex} setPageIndex={setPageIndex} />;
  }

  return <QualityBrowser pageIndex={pageIndex} setPageIndex={setPageIndex} />;
}

function CatalogClassBrowser({
  catalog,
  pageIndex,
  setPageIndex,
}: {
  catalog: OntologyCatalog | null;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
}) {
  const classes = catalog?.classes ?? [];
  const [query, setQuery] = useState("");
  const filteredClasses = classes.filter((item) =>
    matchesQuery(query, item.class_id, item.label, item.description, item.parent_class_id),
  );
  const page = paginate(filteredClasses, pageIndex);

  useEffect(() => {
    setPageIndex(0);
  }, [query, setPageIndex]);

  return (
    <BrowseShell
      count={filteredClasses.length}
      description="Classes define the domain vocabulary used to type stations, services, events, evidence, and reference data."
      emptyLabel={query.trim() ? "No classes match this search." : "Classes are loading."}
      filters={<SearchField label="Search classes" value={query} onChange={setQuery} />}
      pageIndex={pageIndex}
      setPageIndex={setPageIndex}
      title="Classes"
    >
      {page.items.map((item) => (
        <a
          className="ontology-browse-card"
          href={ontologyHref("class", item.class_id)}
          key={item.class_id}
        >
          <strong>{item.label}</strong>
          <code>{item.class_id}</code>
          {item.description ? <span>{item.description}</span> : null}
        </a>
      ))}
    </BrowseShell>
  );
}

function CatalogPropertyBrowser({
  catalog,
  pageIndex,
  setPageIndex,
}: {
  catalog: OntologyCatalog | null;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
}) {
  const classes = catalog?.classes ?? [];
  const properties = catalog?.properties ?? [];
  const [query, setQuery] = useState("");
  const [propertyKind, setPropertyKind] = useState("");
  const filteredProperties = properties.filter(
    (item) =>
      (!propertyKind || item.property_kind === propertyKind) &&
      matchesQuery(
        query,
        item.property_id,
        item.label,
        item.description,
        item.domain_class_id,
        item.range_class_id,
        item.range_datatype,
      ),
  );
  const page = paginate(filteredProperties, pageIndex);

  useEffect(() => {
    setPageIndex(0);
  }, [query, propertyKind, setPageIndex]);

  return (
    <BrowseShell
      count={filteredProperties.length}
      description="Properties describe how things connect to other things or literal data values."
      emptyLabel={
        query.trim() || propertyKind
          ? "No properties match these filters."
          : "Properties are loading."
      }
      filters={
        <FilterBar>
          <SearchField label="Search properties" value={query} onChange={setQuery} />
          <SelectFilter
            label="Kind"
            value={propertyKind}
            onChange={setPropertyKind}
            options={[
              { value: "", label: "All kinds" },
              { value: "object", label: "Object" },
              { value: "datatype", label: "Datatype" },
            ]}
          />
        </FilterBar>
      }
      pageIndex={pageIndex}
      setPageIndex={setPageIndex}
      title="Properties"
    >
      {page.items.map((item) => (
        <a
          className="ontology-browse-card"
          href={ontologyHref("property", item.property_id)}
          key={item.property_id}
        >
          <strong>{item.label}</strong>
          <code>{item.property_id}</code>
          <span>
            {classLabel(classes, item.domain_class_id) ?? "rail:Thing"} {"->"}{" "}
            {classLabel(classes, item.range_class_id) ?? item.range_datatype ?? "value"}
          </span>
        </a>
      ))}
    </BrowseShell>
  );
}

function ThingBrowser({
  catalog,
  pageIndex,
  setPageIndex,
}: {
  catalog: OntologyCatalog | null;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
}) {
  const [page, setPage] = useState<OntologyThingPageResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const [thingType, setThingType] = useState("");

  useEffect(() => {
    setPageIndex(0);
  }, [query, thingType, setPageIndex]);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setPage(null);

    getOntologyThingPage({
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
      query: debouncedQuery,
      thingType,
    })
      .then((nextPage) => {
        if (cancelled) return;
        setPage(nextPage);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPage(null);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [pageIndex, debouncedQuery, thingType]);

  const typeOptions = [
    { value: "", label: "All types" },
    ...(catalog?.classes ?? []).map((item) => ({ value: item.class_id, label: item.label })),
  ];

  return (
    <BrowseShell
      count={page?.total ?? 0}
      description="Things are the projected stations, services, train runs, events, formations, and source records in the graph."
      emptyLabel={
        state === "error"
          ? "Things could not be loaded."
          : query.trim() || thingType
            ? "No things match these filters."
            : "Things are loading."
      }
      filters={
        <FilterBar>
          <SearchField label="Search things" value={query} onChange={setQuery} />
          <SelectFilter
            label="Type"
            value={thingType}
            onChange={setThingType}
            options={typeOptions}
          />
        </FilterBar>
      }
      pageIndex={pageIndex}
      setPageIndex={setPageIndex}
      title="Things"
    >
      {page?.items.map((item) => (
        <a
          className="ontology-browse-card"
          href={ontologyHref("thing", item.thing_id)}
          key={item.thing_id}
        >
          <strong>{item.preferred_label ?? item.thing_id}</strong>
          <code>{item.thing_id}</code>
          <span>{item.disambiguation_hint ?? item.thing_type}</span>
          {item.classes.length ? (
            <small>
              {item.classes
                .map((classItem) => classItem.class_label ?? classItem.class_id)
                .join(", ")}
            </small>
          ) : null}
        </a>
      ))}
    </BrowseShell>
  );
}

function TripleBrowser({
  catalog,
  pageIndex,
  setPageIndex,
}: {
  catalog: OntologyCatalog | null;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
}) {
  const [page, setPage] = useState<OntologyTriplePageResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const [predicateId, setPredicateId] = useState("");

  useEffect(() => {
    setPageIndex(0);
  }, [query, predicateId, setPageIndex]);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setPage(null);

    getOntologyTriplePage({
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
      query: debouncedQuery,
      predicateId,
    })
      .then((nextPage) => {
        if (cancelled) return;
        setPage(nextPage);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPage(null);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [pageIndex, debouncedQuery, predicateId]);

  const predicateOptions = [
    { value: "", label: "All predicates" },
    ...(catalog?.properties ?? []).map((item) => ({ value: item.property_id, label: item.label })),
  ];

  return (
    <BrowseShell
      count={page?.total ?? 0}
      description="Triples are the subject, predicate, and object facts that connect the rail data graph."
      emptyLabel={
        state === "error"
          ? "Triples could not be loaded."
          : query.trim() || predicateId
            ? "No triples match these filters."
            : "Triples are loading."
      }
      filters={
        <FilterBar>
          <SearchField label="Search triples" value={query} onChange={setQuery} />
          <SelectFilter
            label="Predicate"
            value={predicateId}
            onChange={setPredicateId}
            options={predicateOptions}
          />
        </FilterBar>
      }
      pageIndex={pageIndex}
      setPageIndex={setPageIndex}
      title="Triples"
    >
      {page?.items.map((item) => (
        <article className="ontology-browse-triple" key={item.triple_id}>
          <a href={ontologyHref("thing", item.subject_thing_id)}>{item.subject_thing_id}</a>
          <a href={ontologyHref("property", item.predicate_id)}>
            {item.predicate_label ?? item.predicate_id}
          </a>
          {item.object_thing_id ? (
            <a href={ontologyHref("thing", item.object_thing_id)}>
              {item.object_preferred_label ?? item.object_thing_id}
            </a>
          ) : (
            <span>{item.object_literal ?? "value"}</span>
          )}
        </article>
      ))}
    </BrowseShell>
  );
}

function QualityBrowser({
  pageIndex,
  setPageIndex,
}: {
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
}) {
  const [page, setPage] = useState<OntologyQualityViolationPageResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const [severity, setSeverity] = useState("");

  useEffect(() => {
    setPageIndex(0);
  }, [query, severity, setPageIndex]);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setPage(null);

    getOntologyQualityViolationPage({
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
      query: debouncedQuery,
      severity: severity === "error" || severity === "warning" ? severity : undefined,
    })
      .then((nextPage) => {
        if (cancelled) return;
        setPage(nextPage);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPage(null);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [pageIndex, debouncedQuery, severity]);

  const checkedAt = page?.summary.checked_at;
  const description = checkedAt
    ? `Current constraint violations from the last ontology quality pass at ${new Date(checkedAt).toLocaleString("en-GB")}.`
    : "Current constraint violations will appear after the first ontology quality pass runs.";

  return (
    <BrowseShell
      count={page?.total ?? 0}
      description={description}
      emptyLabel={
        state === "error"
          ? "Ontology quality results could not be loaded."
          : query.trim() || severity
            ? "No ontology quality violations match these filters."
            : "No ontology quality violations are currently recorded."
      }
      filters={
        <FilterBar>
          <SearchField label="Search quality" value={query} onChange={setQuery} />
          <SelectFilter
            label="Severity"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: "", label: "All severities" },
              { value: "error", label: "Errors" },
              { value: "warning", label: "Warnings" },
            ]}
          />
        </FilterBar>
      }
      pageIndex={pageIndex}
      setPageIndex={setPageIndex}
      title="Quality"
    >
      {page?.items.map((item) => (
        <article className="ontology-browse-card" key={item.violation_id}>
          <strong>{item.severity}</strong>
          <code>{item.constraint_id}</code>
          <span>{item.message}</span>
          <small>{item.thing_id ?? item.property_id ?? item.violation_kind}</small>
        </article>
      ))}
    </BrowseShell>
  );
}

function BrowseShell({
  children,
  count,
  description,
  emptyLabel,
  filters,
  pageIndex,
  setPageIndex,
  title,
}: {
  children: ReactNode;
  count: number;
  description: string;
  emptyLabel: string;
  filters?: ReactNode;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
  title: string;
}) {
  const hasItems = count > 0;
  const pageCount = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  return (
    <SurfacePanel className="ontology-browse-panel">
      <div className="ontology-browse-heading">
        <p className="section-label">Ontology browser</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {filters}

      {hasItems ? (
        <div className="ontology-browse-list">{children}</div>
      ) : (
        <p className="muted">{emptyLabel}</p>
      )}

      <PaginationControls
        count={count}
        pageCount={pageCount}
        pageIndex={pageIndex}
        setPageIndex={setPageIndex}
      />
    </SurfacePanel>
  );
}

function FilterBar({ children }: { children: ReactNode }) {
  return <div className="ontology-filter-bar">{children}</div>;
}

function SearchField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="ontology-filter-control">
      <span>{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function SelectFilter({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <label className="ontology-filter-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PaginationControls({
  count,
  pageCount,
  pageIndex,
  setPageIndex,
}: {
  count: number;
  pageCount: number;
  pageIndex: number;
  setPageIndex: (pageIndex: number) => void;
}) {
  const start = count === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const end = Math.min((pageIndex + 1) * PAGE_SIZE, count);

  return (
    <nav className="ontology-pagination" aria-label="Ontology sample pages">
      <span>
        {start.toLocaleString("en-GB")}-{end.toLocaleString("en-GB")} of{" "}
        {count.toLocaleString("en-GB")}
      </span>
      <div>
        <button
          type="button"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex(pageIndex - 1)}
        >
          Previous
        </button>
        <span>
          Page {(pageIndex + 1).toLocaleString("en-GB")} of {pageCount.toLocaleString("en-GB")}
        </span>
        <button
          type="button"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => setPageIndex(pageIndex + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

function paginate<T>(items: T[], pageIndex: number): { items: T[]; total: number } {
  const offset = pageIndex * PAGE_SIZE;
  return {
    items: items.slice(offset, offset + PAGE_SIZE),
    total: items.length,
  };
}

function classLabel(classes: OntologyClass[], classId: string | null): string | null {
  if (!classId) return null;
  return classes.find((item) => item.class_id === classId)?.label ?? classId;
}

function matchesQuery(query: string, ...values: Array<string | null>): boolean {
  const normalisedQuery = query.trim().toLowerCase();
  if (!normalisedQuery) return true;

  return values.some((value) => value?.toLowerCase().includes(normalisedQuery));
}
