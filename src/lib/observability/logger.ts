/**
 * Structured audit logger for FraudCase GH.
 *
 * Emits a single JSON line per event to stdout/stderr so deploy platforms can
 * ingest structured logs. The hard rule for this module: it must NEVER log
 * sensitive content. To enforce that mechanically it:
 *   - only serializes a fixed allowlist of safe fields,
 *   - drops any non-scalar `meta` value (objects, arrays, Errors, functions),
 *     which is where raw request bodies, evidence text, tokens, or full error
 *     objects would otherwise leak, and
 *   - derives error descriptors via {@link safeErrorType}, which returns the
 *     error name/code only and never the message or stack.
 *
 * Callers are still responsible for not passing PII as scalar values (e.g. do
 * not put a phone number or email in `meta`). Pass identifiers, counts, status
 * codes, durations, and route names only.
 */

export type LogLevel = "info" | "warn" | "error";

export interface AuditEvent {
  /** Stable event name, e.g. "quick_check_analyze", "case_fetch". */
  event: string;
  /** Severity; defaults to "info". "error" routes to stderr. */
  level?: LogLevel;
  /** Request route, e.g. "/api/quick-check/analyze". Never a full URL with query. */
  route?: string;
  /** Outcome: "ok" | "error" | an HTTP status code. */
  status?: "ok" | "error" | number;
  /** Handler duration in milliseconds. */
  latencyMs?: number;
  /** Safe error descriptor from {@link safeErrorType} (name/code only). */
  errorType?: string;
  /** Additional safe, non-sensitive scalar fields. Non-scalars are dropped. */
  meta?: Record<string, unknown>;
}

/**
 * Returns a NON-SENSITIVE descriptor for an unknown error: its name and/or
 * code/status only. Never returns the error message or stack, which can contain
 * user content, PII, tokens, or secrets.
 */
export function safeErrorType(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { name?: unknown; code?: unknown; status?: unknown };
    const code = e.code ?? e.status;
    const name = typeof e.name === "string" && e.name ? e.name : undefined;
    if (name && code !== undefined && code !== null) return `${name}:${String(code)}`;
    if (name) return name;
    if (code !== undefined && code !== null) return String(code);
  }
  return "Error";
}

/** Keep only scalar meta values; drop objects/arrays/Errors/functions/etc. */
function sanitizeMeta(
  meta?: Record<string, unknown>,
): Record<string, string | number | boolean> | undefined {
  if (!meta) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
    // Non-scalars (objects, arrays, Error instances, functions, null) are
    // intentionally dropped to prevent content/PII/secret leakage.
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Emit one structured JSON log line. */
export function logEvent(e: AuditEvent): void {
  const level: LogLevel = e.level ?? "info";
  const meta = sanitizeMeta(e.meta);
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event: e.event,
  };
  if (e.route) record.route = e.route;
  if (e.status !== undefined) record.status = e.status;
  if (e.latencyMs !== undefined) record.latencyMs = e.latencyMs;
  if (e.errorType) record.errorType = e.errorType;
  if (meta) record.meta = meta;

  const line = JSON.stringify(record);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Convenience for the common "route failed" case: logs the route, an error
 * status, and a safe error type derived from `err`. The raw error is never
 * serialized.
 */
export function logRouteError(event: string, route: string, err: unknown, meta?: Record<string, unknown>): void {
  logEvent({ event, level: "error", route, status: "error", errorType: safeErrorType(err), meta });
}
