export type ReadWithTimeoutResult<T> =
  | { timedOut: true; result?: never }
  | { timedOut: false; result: ReadableStreamReadResult<T> };

export async function readWithTimeout<T>(
  readPromise: Promise<ReadableStreamReadResult<T>>,
  timeoutMs: number,
): Promise<ReadWithTimeoutResult<T>> {
  const timeoutPromise = sleep(timeoutMs).then(() => ({ timedOut: true as const }));
  const pendingReadPromise = readPromise.then((result) => ({ timedOut: false as const, result }));
  return Promise.race([timeoutPromise, pendingReadPromise]);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
