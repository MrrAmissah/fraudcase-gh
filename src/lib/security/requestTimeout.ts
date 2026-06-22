/**
 * Per-request timeout for expensive public routes (e.g. Quick Check analyze,
 * which calls Gemini). If the handler has not begun responding within `ms`, a
 * calm 503 JSON is returned (never a stack trace) so a hung upstream cannot hold
 * the connection open indefinitely. The timer is cleared when the response
 * finishes or the connection closes.
 *
 * This does not abort in-flight upstream work; it bounds the client-facing
 * response. It complements (does not replace) the server-level requestTimeout.
 */

export interface TimeoutResponse {
  readonly headersSent: boolean;
  status(code: number): TimeoutResponse;
  json(body: unknown): void;
  on(event: string, listener: () => void): void;
}

export type TimeoutNext = (err?: unknown) => void;

export function makeRequestTimeout(
  ms: number,
  message = "The request took too long. Please try again.",
) {
  return function requestTimeout(_req: unknown, res: TimeoutResponse, next: TimeoutNext): void {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: message });
      }
    }, ms);
    // Do not keep the event loop alive solely for this timer.
    if (typeof (timer as { unref?: () => void }).unref === "function") {
      (timer as { unref: () => void }).unref();
    }
    const clear = () => clearTimeout(timer);
    res.on("finish", clear);
    res.on("close", clear);
    next();
  };
}
