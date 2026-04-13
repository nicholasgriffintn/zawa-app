import { Icon, type IconName } from "./Icon";

import "./DetailState.scss";

export function DetailState({
  icon,
  title,
  body,
}: {
  icon: Extract<IconName, "alert-circle" | "clock" | "route">;
  title: string;
  body?: string;
}) {
  return (
    <div className="detail-empty-state">
      <Icon name={icon} />
      <strong>{title}</strong>
      {body ? <span>{body}</span> : null}
    </div>
  );
}
