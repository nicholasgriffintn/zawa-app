import type { StationBoardResponse } from "@zawa/domain/api";

import { formatBoardStatus } from "./format";
import { serviceMode, serviceTypeLabel } from "./service-detail-view-model";

type SummaryTone = "good" | "warn" | "bad" | "neutral";
type BoardRow = StationBoardResponse["rows"][number];

export interface StationOverviewFact {
  label: string;
  value: string;
}

export function stationLocationLabel(profile: StationBoardResponse["profile"]): string {
  if (!profile) return "National Rail";
  const address = [
    profile.address_line_1,
    profile.address_line_2,
    profile.address_line_3,
    profile.address_line_4,
    profile.postcode,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");

  return address || profile.station_operator || "National Rail";
}

export function stationOverviewFacts(
  profile: StationBoardResponse["profile"],
): StationOverviewFact[] {
  if (!profile) return [];

  return [
    profile.step_free_access_coverage
      ? { label: "Step-free", value: profile.step_free_access_coverage }
      : null,
    profile.ticket_office_available === 1 || profile.ticket_machine_available === 1
      ? {
          label: "Tickets",
          value: [
            profile.ticket_office_available === 1 ? "Office" : null,
            profile.ticket_machine_available === 1 ? "Machines" : null,
          ]
            .filter((part): part is string => Boolean(part))
            .join(" and "),
        }
      : null,
    profile.toilets_available === 1 ? { label: "Toilets", value: "Available" } : null,
    profile.cycle_storage_spaces
      ? { label: "Cycle spaces", value: String(profile.cycle_storage_spaces) }
      : null,
  ].filter((fact): fact is StationOverviewFact => Boolean(fact));
}

export function stationBoardStatusSummary(rows: StationBoardResponse["rows"]): Array<{
  label: string;
  value: string;
  tone: SummaryTone;
}> {
  const delayed = rows.filter((row) =>
    formatBoardStatus({
      expected: row.expected_ts,
      scheduled: row.scheduled_ts,
      status: row.status,
    }).includes("late"),
  ).length;
  const platformChanges = rows.filter((row) => row.status.includes("platform")).length;
  const cancelled = rows.filter((row) => row.status.includes("cancelled")).length;
  const running = Math.max(0, rows.length - delayed - cancelled);

  return [
    { label: "Tracked services", value: String(rows.length), tone: "neutral" },
    { label: "Running on time", value: String(running), tone: running ? "good" : "neutral" },
    { label: "Delayed", value: String(delayed), tone: delayed ? "warn" : "neutral" },
    {
      label: "Platform changes",
      value: String(platformChanges),
      tone: platformChanges ? "warn" : "neutral",
    },
    { label: "Cancelled", value: String(cancelled), tone: cancelled ? "bad" : "neutral" },
  ];
}

export function stationDisruptionSummary(
  rows: StationBoardResponse["rows"],
  stationAlertCount: number,
): {
  title: string;
  description: string;
  tone: SummaryTone;
} {
  if (stationAlertCount) {
    return {
      title: `${stationAlertCount} station alert${stationAlertCount === 1 ? "" : "s"}`,
      description: "Open the current station alerts for the affected area and service notes",
      tone: "warn",
    };
  }

  if (!rows.length) {
    return {
      title: "No services shown yet",
      description: "We will highlight changes once this board has live services",
      tone: "neutral",
    };
  }

  const cancelled = rows.filter((row) => row.status.includes("cancelled")).length;
  if (cancelled) {
    return {
      title: `${cancelled} cancellation${cancelled === 1 ? "" : "s"} shown`,
      description: "Based on the services currently shown on this board",
      tone: "bad",
    };
  }

  const delayed = rows.filter((row) =>
    formatBoardStatus({
      expected: row.expected_ts,
      scheduled: row.scheduled_ts,
      status: row.status,
    }).includes("late"),
  ).length;
  const platformChanges = rows.filter((row) => row.status.includes("platform")).length;
  const changed = delayed + platformChanges;

  if (changed) {
    return {
      title: `${changed} service change${changed === 1 ? "" : "s"} active`,
      description: "Delay and platform changes are based on the services shown here",
      tone: "warn",
    };
  }

  return {
    title: "No changes on shown services",
    description: "No cancellation, delay, or platform change is visible",
    tone: "good",
  };
}

export function stationNextServiceSummary(
  row: Pick<BoardRow, "platform" | "service_type">,
): string {
  const mode = serviceMode(row);
  const typeLabel = serviceTypeLabel(row.service_type);

  if (mode === "bus") {
    if (row.platform?.toLowerCase() === "bus") return "Bus service";
    return `Bus stand ${row.platform ?? "TBC"}`;
  }

  if (mode === "train") {
    return row.platform ? `Platform ${row.platform}` : "";
  }

  return [
    row.platform ? `Platform ${row.platform}` : null,
    typeLabel ? `${typeLabel} service` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
