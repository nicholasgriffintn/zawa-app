import { formatStatus, statusTone } from "../lib/format";

import "./StatusBadge.scss";

export function StatusBadge({
  label,
  status,
  tone,
}: {
  label?: string;
  status: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <span className={`status-badge ${tone ?? statusTone(status)}`}>
      {label ?? formatStatus(status)}
    </span>
  );
}
