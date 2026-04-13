import type { ReactNode } from "react";

import "./MetricGrid.scss";

export function MetricGrid({
  children,
  columns = 4,
  label,
}: {
  children: ReactNode;
  columns?: 2 | 4;
  label: string;
}) {
  return (
    <section className={`metric-grid metric-grid-${columns}`} aria-label={label}>
      {children}
    </section>
  );
}

export function MetricCard({
  detail,
  href,
  label,
  tone = "neutral",
  value,
}: {
  detail?: ReactNode;
  href?: string;
  label: string;
  tone?: "good" | "warn" | "bad" | "neutral";
  value: ReactNode;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </>
  );

  if (href) {
    return (
      <a className={`metric-card metric-card-link ${tone}`} href={href}>
        {content}
      </a>
    );
  }

  return <article className={`metric-card ${tone}`}>{content}</article>;
}
