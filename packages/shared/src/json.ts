export type JsonObject = Record<string, unknown>;

export { isRecord as isJsonObject } from "./values";

export function parseJsonSafe(data: unknown): unknown {
  if (typeof data !== "string") {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
