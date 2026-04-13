export interface PageOptions {
  limit?: number;
  offset?: number;
}

export function normalisePageOptions(options: PageOptions): Required<PageOptions> {
  const limit = Number.isFinite(options.limit) ? Math.trunc(options.limit ?? 25) : 25;
  const offset = Number.isFinite(options.offset) ? Math.trunc(options.offset ?? 0) : 0;

  return {
    limit: Math.min(Math.max(limit, 1), 50),
    offset: Math.max(offset, 0),
  };
}
