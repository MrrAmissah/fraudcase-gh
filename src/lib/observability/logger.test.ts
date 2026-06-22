import { test } from "node:test";
import assert from "node:assert/strict";
import { logEvent, logRouteError, safeErrorType } from "./logger";

/** Capture console output produced during fn(). */
function captureConsole(fn: () => void): string[] {
  const lines: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;
  const sink = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  console.log = sink as typeof console.log;
  console.error = sink as typeof console.error;
  console.warn = sink as typeof console.warn;
  try {
    fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
    console.warn = origWarn;
  }
  return lines;
}

test("safeErrorType returns name/code only, never the message or stack", () => {
  const err = new Error("victim 0241234567 with token sk-supersecret leaked here");
  (err as unknown as { code: string }).code = "permission-denied";
  const t = safeErrorType(err);
  assert.equal(t, "Error:permission-denied");
  assert.ok(!t.includes("0241234567"));
  assert.ok(!t.includes("sk-supersecret"));
});

test("safeErrorType handles plain code objects and unknown values", () => {
  assert.equal(safeErrorType({ name: "FirebaseError", code: 7 }), "FirebaseError:7");
  assert.equal(safeErrorType({ status: 503 }), "503");
  assert.equal(safeErrorType("a raw string"), "Error");
  assert.equal(safeErrorType(null), "Error");
});

test("logEvent emits a single line of valid JSON with safe fields", () => {
  const lines = captureConsole(() =>
    logEvent({ event: "case_fetch", route: "/api/cases", status: "ok", latencyMs: 12 }),
  );
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, "case_fetch");
  assert.equal(parsed.route, "/api/cases");
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.latencyMs, 12);
  assert.equal(parsed.level, "info");
  assert.equal(typeof parsed.ts, "string");
});

test("logEvent drops non-scalar meta so bodies/errors/tokens cannot leak", () => {
  const sensitive = {
    body: { message: "0241234567 victim chat transcript", token: "Bearer abc.def" },
    err: new Error("stack trace containing PII 0551112222"),
    files: ["receipt-with-name.jpg"],
  };
  const [line] = captureConsole(() => logEvent({ event: "x", meta: sensitive }));
  assert.ok(!line.includes("0241234567"));
  assert.ok(!line.includes("Bearer abc.def"));
  assert.ok(!line.includes("0551112222"));
  assert.ok(!line.includes("receipt-with-name"));
  const parsed = JSON.parse(line);
  assert.equal(parsed.meta, undefined);
});

test("logEvent keeps only scalar meta values", () => {
  const [line] = captureConsole(() =>
    logEvent({ event: "x", meta: { count: 3, ok: true, name: "safe", nested: { a: 1 } } }),
  );
  const parsed = JSON.parse(line);
  assert.deepEqual(parsed.meta, { count: 3, ok: true, name: "safe" });
});

test("logRouteError logs error level + safe type, never the raw error", () => {
  const err = new Error("firestore failed for user user@example.com 0241234567");
  (err as unknown as { code: string }).code = "unavailable";
  const [line] = captureConsole(() => logRouteError("case_fetch", "/api/cases", err));
  const parsed = JSON.parse(line);
  assert.equal(parsed.level, "error");
  assert.equal(parsed.status, "error");
  assert.equal(parsed.route, "/api/cases");
  assert.equal(parsed.errorType, "Error:unavailable");
  assert.ok(!line.includes("user@example.com"));
  assert.ok(!line.includes("0241234567"));
});
