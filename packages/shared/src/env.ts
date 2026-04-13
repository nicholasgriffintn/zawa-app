export type EnvSource = Record<string, string | undefined>;

export function requiredEnv(env: EnvSource, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}

export function optionalEnv(env: EnvSource, key: string, fallback: string): string {
  return env[key]?.trim() || fallback;
}

export function csvEnv(env: EnvSource, key: string): string[] {
  return requiredEnv(env, key)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function booleanEnv(env: EnvSource, key: string, fallback: boolean): boolean {
  const value = env[key]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${key} must be true or false`);
}
