export class OperationTimeoutError extends Error {
  constructor(
    readonly operation: string,
    readonly timeoutMs: number,
  ) {
    super(`${operation} timed out after ${timeoutMs}ms`);
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  options: { operation: string; timeoutMs: number },
): Promise<T> {
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new OperationTimeoutError(options.operation, options.timeoutMs));
    }, options.timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (timedOut) void promise.catch(() => undefined);
  }
}
