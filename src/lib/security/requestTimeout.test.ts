import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRequestTimeout } from "./requestTimeout";

function mockRes() {
  const listeners: Record<string, () => void> = {};
  const state = { status: 0, body: null as unknown, headersSent: false };
  return {
    get headersSent() {
      return state.headersSent;
    },
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      state.headersSent = true;
    },
    on(event: string, listener: () => void) {
      listeners[event] = listener;
    },
    fire(event: string) {
      listeners[event]?.();
    },
    state,
  };
}

test("sends a calm 503 when the handler does not respond in time", async () => {
  const mw = makeRequestTimeout(5, "took too long");
  const res = mockRes();
  mw({}, res, () => {
    /* handler hangs: never responds */
  });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(res.state.status, 503);
  assert.deepEqual(res.state.body, { error: "took too long" });
});

test("does not send 503 when the response finishes first (timer cleared)", async () => {
  const mw = makeRequestTimeout(50);
  const res = mockRes();
  mw({}, res, () => {
    // Handler responds quickly, then the framework emits 'finish'.
    res.status(200).json({ ok: true });
    res.fire("finish");
  });
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(res.state.status, 200);
  assert.deepEqual(res.state.body, { ok: true });
});

test("calls next() so the handler chain proceeds", () => {
  const mw = makeRequestTimeout(1000);
  const res = mockRes();
  let nexted = false;
  mw({}, res, () => {
    nexted = true;
  });
  assert.equal(nexted, true);
});
