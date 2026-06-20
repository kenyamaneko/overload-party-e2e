export interface PollOptions {
  timeoutMs: number;
  intervalMs: number;
  description?: string;
}

/**
 * Polls `fn` until it returns a truthy value, then returns that value. Used to verify
 * eventual-consistency side effects (e.g., shop purchase propagating to account profile).
 *
 * Throws after `timeoutMs` with a description that lists the last observed value to
 * make CI failures debuggable without re-running locally.
 */
export async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  opts: PollOptions,
): Promise<T> {
  const deadline = Date.now() + opts.timeoutMs;
  let lastSeen: T | null | undefined;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) return result;
      lastSeen = result;
    } catch (err) {
      lastError = err;
    }
    await sleep(opts.intervalMs);
  }

  const desc = opts.description ?? 'pollUntil';
  const tail = lastError
    ? `last error: ${String(lastError)}`
    : `last seen: ${JSON.stringify(lastSeen)}`;
  throw new Error(`${desc} timed out after ${opts.timeoutMs}ms — ${tail}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
