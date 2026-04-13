import type { ReactNode } from "react";

import "./PageLayout.scss";

export function PageLayout({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={["app-page", className].filter(Boolean).join(" ")}>{children}</main>;
}
