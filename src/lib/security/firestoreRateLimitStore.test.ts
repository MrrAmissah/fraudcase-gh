import test from "node:test";
import assert from "node:assert/strict";
import {
  FirestoreRateLimitStore,
  createRateLimitStore,
  hashLimiterKey,
  DEFAULT_RATE_LIMIT_COLLECTION,
  MIN_SALT_LENGTH,
  type RateLimitFirestore,
} from "./firestoreRateLimitStore";
import { MemoryRateLimitStore, makeDailyRateLimit, makeBurstRateLimit } from "./rateLimit";

const SALT = "test-salt-long-enough";

/**
 * Minimal in-process Firestore fake: enough of get/set/runTransaction to exercise the real
 * read-modify-write logic. Transactions run serially, which matches the store's assumption that
 * Firestore serializes conflicting transactions.
 */
function fakeFirestore(): RateLimitFirestore & { docs: Map<string, any>; writes: any[] } {
  const docs = new Map<string, any>();
  const writes: any[] = [];
  const api: any = {
    docs,
    writes,
    collection(name: string) {
      return {
        doc(id: string) {
          return { __path: `${name}/${id}`, __id: id };
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const tx = {
        async get(ref: any) {
          const data = docs.get(ref.__path);
          return {
            exists: data !== undefined,
            get: (field: string) => (data ? data[field] : undefined),
          };
        },
        set(ref: any, value: any, options?: { merge?: boolean }) {
          const prev = options?.merge ? docs.get(ref.__path) || {} : {};
          docs.set(ref.__path, { ...prev, ...value });
          writes.push({ path: ref.__path, value });
        },
      };
      return fn(tx);
    },
  };
  return api;
}

/** A store whose every operation rejects, for the fail-mode tests. */
const throwingStore = {
  async hitDaily(): Promise<boolean> {
    throw new Error("firestore unavailable");
  },
  async hitBurst(): Promise<boolean> {
    throw new Error("firestore unavailable");
  },
};

function fakeRes() {
  return {
    statusCode: 0,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

async function runMiddleware(mw: any) {
  const req = { socket: { remoteAddress: "203.0.113.7" }, headers: {} };
  const res = fakeRes();
  let nexted = false;
  await mw(req, res, () => {
    nexted = true;
  });
  return { res, nexted };
}

test("hitDaily allows exactly `limit` hits then blocks, matching the in-memory store", async () => {
  const db = fakeFirestore();
  const store = new FirestoreRateLimitStore(db, SALT);
  assert.equal(await store.hitDaily("qc:1.2.3.4", 2), true);
  assert.equal(await store.hitDaily("qc:1.2.3.4", 2), true);
  assert.equal(await store.hitDaily("qc:1.2.3.4", 2), false);
  // Blocked hits must not keep incrementing the counter.
  const [doc] = [...db.docs.values()];
  assert.equal(doc.count, 2);
});

test("hitDaily isolates different keys and different UTC days", async () => {
  const db = fakeFirestore();
  let now = Date.parse("2026-07-30T10:00:00Z");
  const store = new FirestoreRateLimitStore(db, SALT, DEFAULT_RATE_LIMIT_COLLECTION, () => now);

  assert.equal(await store.hitDaily("qc:1.1.1.1", 1), true);
  assert.equal(await store.hitDaily("qc:1.1.1.1", 1), false);
  // A different key is unaffected.
  assert.equal(await store.hitDaily("qc:2.2.2.2", 1), true);
  // Next UTC day is a fresh window.
  now = Date.parse("2026-07-31T00:00:01Z");
  assert.equal(await store.hitDaily("qc:1.1.1.1", 1), true);
});

test("hitBurst blocks within the window and resets only after it elapses", async () => {
  const db = fakeFirestore();
  let now = 1_000_000;
  const store = new FirestoreRateLimitStore(db, SALT, DEFAULT_RATE_LIMIT_COLLECTION, () => now);

  assert.equal(await store.hitBurst("burst:1.1.1.1", 2, 60_000), true);
  assert.equal(await store.hitBurst("burst:1.1.1.1", 2, 60_000), true);
  assert.equal(await store.hitBurst("burst:1.1.1.1", 2, 60_000), false);

  // Still inside the window measured from the FIRST hit, so still blocked.
  now += 59_000;
  assert.equal(await store.hitBurst("burst:1.1.1.1", 2, 60_000), false);

  now += 2_000;
  assert.equal(await store.hitBurst("burst:1.1.1.1", 2, 60_000), true);
});

test("namespaced keys do not collide in one collection", async () => {
  const db = fakeFirestore();
  const store = new FirestoreRateLimitStore(db, SALT);
  assert.equal(await store.hitDaily("route_a:9.9.9.9", 1), true);
  assert.equal(await store.hitDaily("route_a:9.9.9.9", 1), false);
  assert.equal(await store.hitDaily("route_b:9.9.9.9", 1), true);
});

test("PRIVACY: the raw IP never reaches a document id or a written field", async () => {
  const db = fakeFirestore();
  const store = new FirestoreRateLimitStore(db, SALT);
  const ip = "198.51.100.42";
  await store.hitDaily(`qc_analyze:${ip}`, 5);
  await store.hitBurst(`qc_burst:${ip}`, 5, 60_000);

  const serialized = JSON.stringify([...db.docs.entries()].concat(db.writes as any));
  assert.equal(serialized.includes(ip), false, "raw IP must not be persisted");
  assert.equal(serialized.includes("qc_analyze"), false, "raw limiter key must not be persisted");
});

test("hashLimiterKey is stable per salt and diverges across salts", () => {
  const a = hashLimiterKey("qc:1.2.3.4", SALT);
  const b = hashLimiterKey("qc:1.2.3.4", SALT);
  const c = hashLimiterKey("qc:1.2.3.4", "another-salt-entirely");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{32}$/);
});

test("the store refuses to construct without a sufficiently long salt", () => {
  const db = fakeFirestore();
  assert.throws(() => new FirestoreRateLimitStore(db, ""), /salt/i);
  assert.throws(() => new FirestoreRateLimitStore(db, "x".repeat(MIN_SALT_LENGTH - 1)), /salt/i);
});

test("createRateLimitStore only uses Firestore when explicitly configured with a salt and a db", () => {
  const db = fakeFirestore();

  // Default: in-memory.
  assert.ok(createRateLimitStore({ env: {} as NodeJS.ProcessEnv, db }) instanceof MemoryRateLimitStore);

  // Requested but no salt: fall back rather than persist weak hashes.
  assert.ok(
    createRateLimitStore({ env: { RATE_LIMIT_STORE: "firestore" } as NodeJS.ProcessEnv, db }) instanceof
      MemoryRateLimitStore,
  );

  // Requested with a too-short salt: same.
  assert.ok(
    createRateLimitStore({
      env: { RATE_LIMIT_STORE: "firestore", RATE_LIMIT_HASH_SALT: "short" } as NodeJS.ProcessEnv,
      db,
    }) instanceof MemoryRateLimitStore,
  );

  // Requested with a salt but no db handle: same.
  assert.ok(
    createRateLimitStore({
      env: { RATE_LIMIT_STORE: "firestore", RATE_LIMIT_HASH_SALT: SALT } as NodeJS.ProcessEnv,
      db: null,
    }) instanceof MemoryRateLimitStore,
  );

  // Fully configured.
  assert.ok(
    createRateLimitStore({
      env: { RATE_LIMIT_STORE: "firestore", RATE_LIMIT_HASH_SALT: SALT } as NodeJS.ProcessEnv,
      db,
    }) instanceof FirestoreRateLimitStore,
  );
});

test("a store outage fails CLOSED by default, with 503 and not 429", async () => {
  const daily = makeDailyRateLimit("qc", 5, "over limit", throwingStore);
  const { res, nexted } = await runMiddleware(daily);
  assert.equal(nexted, false, "request must not proceed when the limiter is unavailable");
  assert.equal(res.statusCode, 503, "a store outage is not a quota error");
  assert.notEqual(res.body.error, "over limit");

  const burst = makeBurstRateLimit("qc_burst", 5, 60_000, "slow down", throwingStore);
  const second = await runMiddleware(burst);
  assert.equal(second.nexted, false);
  assert.equal(second.res.statusCode, 503);
});

test("a store outage can fail OPEN where availability matters more than metering", async () => {
  const mw = makeDailyRateLimit("qc", 5, "over limit", throwingStore, { failMode: "open" });
  const { res, nexted } = await runMiddleware(mw);
  assert.equal(nexted, true);
  assert.equal(res.statusCode, 0, "no response should be sent when failing open");
});

test("the unavailable message is configurable and distinct from the over-limit message", async () => {
  const mw = makeDailyRateLimit("qc", 5, "over limit", throwingStore, {
    unavailableMessage: "temporarily unavailable",
  });
  const { res } = await runMiddleware(mw);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, "temporarily unavailable");
});
