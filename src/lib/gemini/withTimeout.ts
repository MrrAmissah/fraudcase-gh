/**
 * Shared timeout wrapper for Gemini calls (analysis and multimodal extraction).
 *
 * A late resolution/rejection of the original promise is ignored once the race has settled, so a
 * slow Gemini response can never produce a second result or a second HTTP response.
 */
export class GeminiTimeoutError extends Error {
  constructor(ms: number) {
    super(`Gemini call exceeded ${ms}ms`);
    this.name = "GeminiTimeoutError";
  }
}

/** Resolves with the promise's value, or rejects with {@link GeminiTimeoutError} after `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // Intentionally NOT unref'd: the timer is cleared as soon as the promise settles, and the
    // long-running server already keeps the event loop alive. Leaving it ref'd makes the timeout
    // callback fire deterministically under the test runner (an unref'd timer let the test process
    // exit before the callback ran, cancelling the slow-Gemini fallback tests on CI).
    const timer = setTimeout(() => reject(new GeminiTimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
