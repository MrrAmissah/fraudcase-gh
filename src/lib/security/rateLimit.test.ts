import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MemoryRateLimitStore,
  getClientIp,
  makeDailyRateLimit,
  makeBurstRateLimit,
} from "./rateLimit";

/** Run a rate-limit middleware once; resolve with the outcome. */
function runMiddleware(mw: any, ip = "1.1.1.1"): Promise<{ nexted: boolean; status: number; body: any }> {
  const req = { headers: {}, socket: { remoteAddress: ip } };
  return new Promise((resolve) => {
    let status = 0;
    let body: any = null;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(b: any) {
        body = b;
        resolve({ nexted: false, status, body });
      },
    };
    mw(req, res, () => resolve({ nexted: true, status, body }));
  });
}

test("hitDaily allows exactly `limit` hits then blocks (parity with original)", async () => {
  const s = new MemoryRateLimitStore();
  for (let i = 0; i < 3; i++) assert.equal(await s.hitDaily("k", 3), true);
  assert.equal(await s.hitDaily("k", 3), false);
  assert.equal(await s.hitDaily("k", 3), false);
});

test("hitDaily isolates different keys/namespaces", async () => {
  const s = new MemoryRateLimitStore();
  assert.equal(await s.hitDaily("a", 1), true);
  assert.equal(await s.hitDaily("a", 1), false);
  assert.equal(await s.hitDaily("b", 1), true);
});

test("hitBurst allows `limit` hits then blocks within the window", async () => {
  const s = new MemoryRateLimitStore();
  for (let i = 0; i < 5; i++) assert.equal(await s.hitBurst("k", 5, 60_000), true);
  assert.equal(await s.hitBurst("k", 5, 60_000), false);
});

test("hitBurst resets after the window elapses", async () => {
  const s = new MemoryRateLimitStore();
  assert.equal(await s.hitBurst("k", 1, 1), true);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await s.hitBurst("k", 1, 1), true);
});

test("makeDailyRateLimit calls next() under the cap and 429s with the message at the cap", async () => {
  const store = new MemoryRateLimitStore();
  const mw = makeDailyRateLimit("ns_daily", 2, "daily limit reached", store);
  assert.deepEqual(await runMiddleware(mw), { nexted: true, status: 0, body: null });
  assert.deepEqual(await runMiddleware(mw), { nexted: true, status: 0, body: null });
  const third = await runMiddleware(mw);
  assert.equal(third.nexted, false);
  assert.equal(third.status, 429);
  assert.equal(third.body.error, "daily limit reached");
});

test("makeBurstRateLimit 429s with the message after the burst cap", async () => {
  const store = new MemoryRateLimitStore();
  const mw = makeBurstRateLimit("ns_burst", 1, 60_000, "slow down", store);
  assert.equal((await runMiddleware(mw)).nexted, true);
  const second = await runMiddleware(mw);
  assert.equal(second.status, 429);
  assert.equal(second.body.error, "slow down");
});

test("namespaced limiters on one shared store do not collide", async () => {
  const store = new MemoryRateLimitStore();
  const a = makeDailyRateLimit("route_a", 1, "a", store);
  const b = makeDailyRateLimit("route_b", 1, "b", store);
  assert.equal((await runMiddleware(a)).nexted, true);
  assert.equal((await runMiddleware(a)).status, 429); // a exhausted
  assert.equal((await runMiddleware(b)).nexted, true); // b independent
});

test("getClientIp ignores X-Forwarded-For unless TRUST_PROXY, and normalizes", () => {
  const prev = process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY;
  assert.equal(
    getClientIp({ headers: { "x-forwarded-for": "9.9.9.9" }, socket: { remoteAddress: "::ffff:10.0.0.5" } }),
    "10.0.0.5",
  );
  process.env.TRUST_PROXY = "true";
  assert.equal(
    getClientIp({ headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8" }, socket: { remoteAddress: "1.1.1.1" } }),
    "9.9.9.9",
  );
  if (prev === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = prev;
});
