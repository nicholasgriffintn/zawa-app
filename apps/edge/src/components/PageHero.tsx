import type { ReactNode } from "react";

import "./PageHero.scss";

export function PageHero({
  aside,
  asideSize = "default",
  body,
  eyebrow,
  headingId,
  title,
}: {
  aside?: ReactNode;
  asideSize?: "default" | "wide";
  body: ReactNode;
  eyebrow?: string;
  headingId: string;
  title: string;
}) {
  return (
    <section
      className={asideSize === "wide" ? "page-hero page-hero-aside-wide" : "page-hero"}
      aria-labelledby={headingId}
    >
      <div className="page-hero-copy">
        {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
        <h1 id={headingId}>{title}</h1>
        <div className="page-hero-body">{body}</div>
      </div>
      {aside ? <div className="page-hero-aside">{aside}</div> : null}
    </section>
  );
}
