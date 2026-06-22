import { test } from "node:test";
import assert from "node:assert/strict";
import { createAppCheckMiddleware, isAppCheckEnforced } from "./appCheck";

function mockRes() {
  const r = { statusCode: 0, body: null as unknown };
  return {
    status(code: number) {
      r.statusCode = code;
      return this;
    },
    json(body: unknown) {
      r.body = body;
    },
    get state() {
      return r;
    },
  };
}

function mockReq(headers: Record<string, string> = {}) {
  return { header: (n: string) => headers[n] };
}

test("passthrough when not enforced (default off) — never calls verifier", async () => {
  const mw = createAppCheckMiddleware({
    isEnforced: () => false,
    verifier: async () => {
      throw new Error("verifier must not run when disabled");
    },
  });
  let called = false;
  const res = mockRes();
  await mw(mockReq(), res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(res.state.statusCode, 0);
});

test("401 when enforced and token missing", async () => {
  const mw = createAppCheckMiddleware({ isEnforced: () => true, verifier: async () => ({}) });
  let called = false;
  const res = mockRes();
  await mw(mockReq(), res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(res.state.statusCode, 401);
});

test("401 when enforced and token invalid", async () => {
  const mw = createAppCheckMiddleware({
    isEnforced: () => true,
    verifier: async () => {
      throw new Error("invalid token");
    },
  });
  let called = false;
  const res = mockRes();
  await mw(mockReq({ "X-Firebase-AppCheck": "bad" }), res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(res.state.statusCode, 401);
});

test("passes when enforced and token valid", async () => {
  const mw = createAppCheckMiddleware({
    isEnforced: () => true,
    verifier: async () => ({ appId: "genuine-app" }),
  });
  let called = false;
  const res = mockRes();
  await mw(mockReq({ "X-Firebase-AppCheck": "good" }), res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(res.state.statusCode, 0);
});

test("isAppCheckEnforced is OFF unless APP_CHECK_ENFORCE === 'true'", () => {
  assert.equal(isAppCheckEnforced({ APP_CHECK_ENFORCE: "true" } as NodeJS.ProcessEnv), true);
  assert.equal(isAppCheckEnforced({ APP_CHECK_ENFORCE: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(isAppCheckEnforced({ APP_CHECK_ENFORCE: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(isAppCheckEnforced({} as NodeJS.ProcessEnv), false);
});
