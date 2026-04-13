export function stableName(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(":");
}

export function domSafeId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}
