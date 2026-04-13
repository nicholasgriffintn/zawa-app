export function normaliseStationInput(value: string): string {
  return value.trim().toUpperCase();
}

export function resolveStationCodeInput(value: string): string | null {
  const input = normaliseStationInput(value);
  return /^[A-Z0-9]{2,5}$/.test(input) ? input : null;
}
