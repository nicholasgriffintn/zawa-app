export interface RdmRequestOptions {
  apiKey: string;
  template: string;
  path: Record<string, string>;
  query?: Record<string, string | number | null | undefined>;
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

export async function fetchRdmJson<T>(options: RdmRequestOptions): Promise<T> {
  const response = await fetch(buildRdmUrl(options.template, options.path, options.query), {
    headers: {
      accept: "application/json",
      "x-apikey": options.apiKey,
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new RdmHttpError("RDM request failed", response.status, body.slice(0, 500));
  }

  return JSON.parse(body) as T;
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
