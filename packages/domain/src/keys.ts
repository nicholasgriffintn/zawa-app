export function toStationKey(input: string): string {
  return input.trim().toUpperCase();
}

export function toServiceKey(parts: {
  rid?: string;
  uid?: string;
  serviceDate?: string;
  toc?: string;
}): string {
  if (parts.rid) return `rid:${parts.rid}`;
  return `svc:${parts.uid ?? "unknown"}:${parts.serviceDate ?? "unknown"}:${parts.toc ?? "unknown"}`;
}

export function toTrainRunKey(parts: { trainId?: string; date?: string }): string | undefined {
  if (!parts.trainId) return undefined;
  return `run:${parts.trainId}:${parts.date ?? "unknown"}`;
}

export function toMovementServiceKey(parts: {
  trainId?: string;
  date?: string;
}): string | undefined {
  if (!parts.trainId) return undefined;
  return `movement:${parts.trainId}:${parts.date ?? "unknown"}`;
}
