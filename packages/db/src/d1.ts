export interface D1RunResultLike {
  meta?: {
    changes?: number;
  };
  success?: boolean;
}

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<D1RunResultLike>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1StatementLike;
  batch?(statements: D1StatementLike[]): Promise<D1RunResultLike[]>;
}

const DEFAULT_D1_BATCH_SIZE = 100;

export function writeAccepted(result: D1RunResultLike): boolean {
  return typeof result.meta?.changes === "number" ? result.meta.changes > 0 : true;
}

export async function runD1Batch(
  db: D1DatabaseLike,
  statements: D1StatementLike[],
  batchSize = DEFAULT_D1_BATCH_SIZE,
): Promise<D1RunResultLike[]> {
  if (statements.length === 0) return [];
  const pageSize = Math.max(1, Math.trunc(batchSize));

  const results: D1RunResultLike[] = [];
  for (let index = 0; index < statements.length; index += pageSize) {
    const chunk = statements.slice(index, index + pageSize);
    if (db.batch) {
      results.push(...(await db.batch(chunk)));
      continue;
    }

    for (const statement of chunk) {
      results.push(await statement.run());
    }
  }
  return results;
}

export function sqlPlaceholders(count: number): string {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`SQL placeholder count must be a positive integer, got ${count}`);
  }

  return Array.from({ length: count }, () => "?").join(", ");
}
