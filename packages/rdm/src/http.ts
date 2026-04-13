import { positiveIntegerValue } from "@zawa/shared/values";

export interface RdmRequestOptions {
  apiKey: string;
  template: string;
  path: Record<string, string>;
  query?: Record<string, string | number | null | undefined>;
  timeoutMs?: number;
}

export class RdmHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

export class RdmRequestTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`RDM request timed out after ${timeoutMs}ms`);
  }
}

const DEFAULT_RDM_REQUEST_TIMEOUT_MS = 15_000;

export async function fetchRdmJson<T>(options: RdmRequestOptions): Promise<T> {
  const body = await fetchRdmText({ ...options, accept: "application/json" });
  return JSON.parse(body) as T;
}

export async function fetchRdmText(
  options: RdmRequestOptions & { accept?: string },
): Promise<string> {
  const timeoutMs = positiveIntegerValue(options.timeoutMs, DEFAULT_RDM_REQUEST_TIMEOUT_MS);
  let response: Response;
  let body: string;

  try {
    response = await fetch(buildRdmUrl(options.template, options.path, options.query), {
      headers: {
        accept: options.accept ?? "application/xml,text/xml,*/*",
        "x-apikey": options.apiKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await response.text();
  } catch (error) {
    if (isAbortError(error)) throw new RdmRequestTimeoutError(timeoutMs);
    throw error;
  }

  if (!response.ok) {
    throw new RdmHttpError(
      `RDM request failed with HTTP ${response.status}`,
      response.status,
      body.slice(0, 500),
    );
  }

  return body;
}

export function buildRdmUrl(
  template: string,
  pathValues: Record<string, string>,
  query?: Record<string, string | number | null | undefined>,
): string {
  let url = template;
  for (const [key, value] of Object.entries(pathValues)) {
    url = url.replaceAll(`{${key}}`, encodeURIComponent(value));
  }

  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      parsed.searchParams.set(key, String(value));
    }
  }
  return parsed.toString();
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")
  );
}
