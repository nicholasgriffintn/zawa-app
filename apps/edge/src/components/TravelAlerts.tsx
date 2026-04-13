import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "../hooks/useDialogFocus";
import type { TravelAlert } from "../lib/travel-alerts";
import { Icon } from "./Icon";

import "./TravelAlerts.scss";

export function TravelAlertButton({
  alerts,
  label = "Travel alerts",
}: {
  alerts: TravelAlert[];
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  if (alerts.length === 0) return null;

  return (
    <>
      <button className="travel-alert-button" type="button" onClick={() => setIsOpen(true)}>
        <span>
          <Icon name="alert" />
          {label}
        </span>
        <strong>
          {alerts.length} alert{alerts.length === 1 ? "" : "s"}
        </strong>
      </button>
      {isOpen
        ? createPortal(
            <TravelAlertDialog
              alerts={alerts}
              label={label}
              titleId={titleId}
              onClose={() => setIsOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

export function TravelAlertCards({
  alerts,
  label = "Travel alerts",
}: {
  alerts: TravelAlert[];
  label?: string;
}) {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const titleId = useId();
  const selectedAlert = alerts.find((alert) => alert.id === selectedAlertId) ?? null;
  const orderedAlerts = selectedAlert
    ? [selectedAlert, ...alerts.filter((alert) => alert.id !== selectedAlert.id)]
    : alerts;

  if (alerts.length === 0) return null;

  return (
    <>
      <div className="home-alert-list">
        {alerts.map((alert) => (
          <button
            key={alert.id}
            className="home-alert-card"
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSelectedAlertId(alert.id)}
          >
            {alert.eyebrow ? <span>{alert.eyebrow}</span> : null}
            <strong>{alert.title}</strong>
            {alert.meta ? <small>{alert.meta}</small> : null}
          </button>
        ))}
      </div>
      {selectedAlertId
        ? createPortal(
            <TravelAlertDialog
              alerts={orderedAlerts}
              label={label}
              titleId={titleId}
              onClose={() => setSelectedAlertId(null)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function TravelAlertDialog({
  alerts,
  label,
  titleId,
  onClose,
}: {
  alerts: TravelAlert[];
  label: string;
  titleId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useDialogFocus(dialogRef, { onClose });

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="travel-alert-modal"
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="overview-title">{label}</p>
            <h2 id={titleId}>
              {alerts.length} active alert{alerts.length === 1 ? "" : "s"}
            </h2>
          </div>
          <button type="button" aria-label={`Close ${label}`} onClick={onClose}>
            Close
          </button>
        </header>
        <div className="travel-alert-list">
          {alerts.map((alert) => (
            <article className="travel-alert-card" key={alert.id}>
              <div>
                <Icon name="alert" />
                <strong>{alert.title}</strong>
              </div>
              {alert.eyebrow ? <span>{alert.eyebrow}</span> : null}
              {alert.body ? <p>{alert.body}</p> : null}
              {alert.meta ? <small>{alert.meta}</small> : null}
              {alert.href ? (
                <a href={alert.href} rel="noreferrer" target="_blank">
                  {alert.hrefLabel ?? "Open alert"}
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
