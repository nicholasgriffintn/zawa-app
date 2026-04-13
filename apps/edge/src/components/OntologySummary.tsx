import type { OntologyGraphResponse } from "@zawa/domain/api";

import { ontologyBrowseHref, ontologyHref } from "../lib/ontology-links";
import { ontologySummaryViewModel, type OntologySummaryToken } from "../lib/ontology-view-model";
import { Icon } from "./Icon";

import "./OntologySummary.scss";

export function OntologySummary({
  graph,
  title = "Knowledge graph",
  eyebrow = "Ontology",
  compact = false,
}: {
  graph: OntologyGraphResponse | null | undefined;
  title?: string;
  eyebrow?: string;
  compact?: boolean;
}) {
  const summary = ontologySummaryViewModel(graph);
  const hasGraph = summary.thingCount > 0 || summary.tripleCount > 0;

  return (
    <details className={compact ? "ontology-summary compact" : "ontology-summary"}>
      <summary className="ontology-summary-heading">
        <div>
          <p className="section-label">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span className="ontology-summary-toggle" aria-hidden="true">
          <Icon name="chevron-down" />
        </span>
      </summary>

      <div className="ontology-summary-body">
        <div className="ontology-summary-counts" aria-label="Ontology graph counts">
          <div>
            <strong>{summary.rootCount.toLocaleString("en-GB")}</strong>
            <span>roots</span>
          </div>
          <div>
            <strong>{summary.thingCount.toLocaleString("en-GB")}</strong>
            <span>things</span>
          </div>
          <div>
            <strong>{summary.tripleCount.toLocaleString("en-GB")}</strong>
            <span>triples</span>
          </div>
        </div>

        {hasGraph ? (
          <div className="ontology-summary-lists">
            <OntologyTokenList
              label="Roots"
              tokens={summary.roots}
              tokenHref={(token) => ontologyHref("thing", token.id)}
            />
            <OntologyTokenList
              label="Classes"
              tokens={summary.classes}
              tokenHref={(token) => ontologyHref("class", token.id)}
            />
            <OntologyTokenList
              label="Predicates"
              tokens={summary.predicates}
              tokenHref={(token) => ontologyHref("property", token.id)}
            />
          </div>
        ) : (
          <p className="muted">No linked things have been projected for this view yet.</p>
        )}

        <div className="ontology-summary-actions">
          <a className="ontology-summary-link" href="/ontologies">
            Ontology catalogue
            <Icon name="route" />
          </a>
          <a className="ontology-summary-link" href={ontologyBrowseHref("things")}>
            Browse things
            <Icon name="route" />
          </a>
          <a className="ontology-summary-link" href={ontologyBrowseHref("triples")}>
            Browse triples
            <Icon name="route" />
          </a>
          {summary.primaryRootThingId ? (
            <a
              className="ontology-summary-link"
              href={ontologyHref("thing", summary.primaryRootThingId)}
            >
              Inspect root graph
              <Icon name="chevron-right" />
            </a>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function OntologyTokenList({
  label,
  tokens,
  tokenHref,
}: {
  label: string;
  tokens: OntologySummaryToken[];
  tokenHref: (token: OntologySummaryToken) => string;
}) {
  if (tokens.length === 0) return null;

  return (
    <div>
      <span>{label}</span>
      <div>
        {tokens.map((token) => (
          <a key={token.id} href={tokenHref(token)}>
            {token.label}
          </a>
        ))}
      </div>
    </div>
  );
}
