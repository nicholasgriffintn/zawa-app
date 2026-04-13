import type { ComponentPropsWithoutRef } from "react";

import "./SurfacePanel.scss";

export function SurfacePanel({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section {...props} className={["surface-panel", className].filter(Boolean).join(" ")} />;
}
