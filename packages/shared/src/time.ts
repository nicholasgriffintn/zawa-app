export function nowIso(): string {
  return new Date().toISOString();
}

export function addMinutesIso(value: string, minutes: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowIso();
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

export interface LocalClockTimeOptions {
  clockTime: string | null | undefined;
  serviceDate: string | null | undefined;
  timeZone: string;
}

export function localClockTimeToIso({
  clockTime,
  serviceDate,
  timeZone,
}: LocalClockTimeOptions): string | null {
  if (!clockTime || !serviceDate) return null;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(clockTime.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] ?? "0");
  if (month < 1 || month > 12 || day < 1 || day > 31 || minutes > 59 || seconds > 59) {
    return null;
  }

  const localMillis = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const utcMillis = localMillis - timeZoneOffsetMillis(localMillis, timeZone);
  const date = new Date(utcMillis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function epochMillisToIso(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;

  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function dateTimeToIso(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function latestIso<T>(
  values: T[],
  fallback: string,
  readValue: (value: T) => string | null | undefined,
): string {
  return values.reduce((latest, value) => {
    const next = readValue(value);
    return next && next > latest ? next : latest;
  }, fallback);
}

export function minutesBetweenIso(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
}

function timeZoneOffsetMillis(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMillis));

  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  const asTimeZoneMillis = Date.UTC(
    Number(partMap.get("year")),
    Number(partMap.get("month")) - 1,
    Number(partMap.get("day")),
    Number(partMap.get("hour")),
    Number(partMap.get("minute")),
    Number(partMap.get("second")),
  );

  return asTimeZoneMillis - utcMillis;
}
