import { minutesBetweenIso } from "@zawa/shared/time";

const UK_RAIL_TIME_ZONE = "Europe/London";

const statusLabels = new Map<string, string>([
  ["service.activated", "Running"],
  ["service.updated", "Updated"],
  ["service.cancelled", "Cancelled"],
  ["service.reinstated", "Reinstated"],
  ["service.location.updated", "Location update"],
  ["service.location.platform.changed", "Platform change"],
  ["service.terminated", "Terminated"],
  ["rdm.realtime.unknown", "Update received"],
]);

export function formatTime(value: string | null | undefined): string {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_RAIL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not yet received";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet received";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_RAIL_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}

export function formatDelay(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "";
  if (minutes <= 0) return "On time";
  return `${minutes} min late`;
}

export function formatBoardStatus({
  expected,
  scheduled,
  status,
}: {
  expected: string | null | undefined;
  scheduled: string | null | undefined;
  status: string;
}): string {
  if (status.includes("cancelled")) return "Cancelled";
  if (status.includes("platform")) return "Platform change";

  const delayMinutes = minutesBetweenIso(scheduled, expected);
  if (delayMinutes === null) return formatStatus(status);
  if (delayMinutes <= 0) return "On time";
  return `${delayMinutes} min late`;
}

export function boardStatusTone({
  expected,
  scheduled,
  status,
}: {
  expected: string | null | undefined;
  scheduled: string | null | undefined;
  status: string;
}): "good" | "warn" | "bad" | "neutral" {
  if (status.includes("cancelled") || status.includes("terminated")) return "bad";
  if (status.includes("platform")) return "warn";

  const delayMinutes = minutesBetweenIso(scheduled, expected);
  if (delayMinutes === null) return statusTone(status);
  return delayMinutes > 0 ? "warn" : "good";
}

export function formatServiceCode(value: string): string {
  return value.slice(0, 12).toUpperCase();
}

export function formatStatus(value: string): string {
  return statusLabels.get(value) ?? sentenceCase(value.replaceAll(".", " "));
}

export function statusTone(value: string): "good" | "warn" | "bad" | "neutral" {
  const normalised = value.toLowerCase();
  if (normalised.includes("good service") || normalised === "good" || normalised === "normal") {
    return "good";
  }
  if (normalised.includes("cancelled") || normalised.includes("terminated")) return "bad";
  if (normalised.includes("platform") || normalised.includes("updated")) return "warn";
  if (normalised.includes("activated") || normalised.includes("reinstated")) return "good";
  return "neutral";
}

function sentenceCase(value: string): string {
  if (!value) return "Unknown";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
