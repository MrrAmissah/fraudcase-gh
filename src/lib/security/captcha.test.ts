import { test } from "node:test";
import assert from "node:assert/strict";
import { createCaptchaMiddleware, isCaptchaEnforced } from "./captcha";

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
  const mw = createCaptchaMiddleware({
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

test("400 when enforced and token missing", async () => {
  const mw = createCaptchaMiddleware({ isEnforced: () => true, verifier: async () => true });
  let called = false;
  const res = mockRes();
  await mw(mockReq(), res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(res.state.statusCode, 400);
});

test("403 when enforced and verification fails", async () => {
  const mw = createCaptchaMiddleware({ isEnforced: () => true, verifier: async () => false });
  let called = false;
  const res = mockRes();
  await mw(mockReq({ "X-Captcha-Token": "tok" }), res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(res.state.statusCode, 403);
});

test("403 when enforced and verifier throws (fail closed)", async () => {
  const mw = createCaptchaMiddleware({
    isEnforced: () => true,
    verifier: async () => {
      throw new Error("network error");
    },
  });
  let called = false;
  const res = mockRes();
  await mw(mockReq({ "X-Captcha-Token": "tok" }), res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(res.state.statusCode, 403);
});

test("passes when enforced and verification succeeds", async () => {
  const mw = createCaptchaMiddleware({ isEnforced: () => true, verifier: async () => true });
  let called = false;
  const res = mockRes();
  await mw(mockReq({ "X-Captcha-Token": "tok" }), res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(res.state.statusCode, 0);
});

test("isCaptchaEnforced is OFF unless CAPTCHA_ENFORCE === 'true'", () => {
  assert.equal(isCaptchaEnforced({ CAPTCHA_ENFORCE: "true" } as NodeJS.ProcessEnv), true);
  assert.equal(isCaptchaEnforced({ CAPTCHA_ENFORCE: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(isCaptchaEnforced({} as NodeJS.ProcessEnv), false);
});
