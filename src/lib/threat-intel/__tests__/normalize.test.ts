import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, normalizeDomain } from "../normalize";

test("normalizeUrl: lowercases host, drops tracking params, keeps path", () => {
  const n = normalizeUrl("HTTPS://WWW.Example.com/Pay?utm_source=x&id=7");
  assert.ok(n);
  assert.equal(n.host, "www.example.com");
  assert.equal(n.domain, "example.com");
  assert.equal(n.tld, "com");
  assert.equal(n.normalizedUrl, "https://www.example.com/Pay?id=7");
  assert.equal(n.hasTokenParams, false);
});

test("normalizeUrl: adds scheme to bare host, flags + STRIPS token params", () => {
  const n = normalizeUrl("pay-momo.example.tk/reset?token=abc123");
  assert.ok(n);
  assert.equal(n.domain, "pay-momo.example.tk");
  assert.equal(n.tld, "tk");
  assert.equal(n.hasTokenParams, true);
  // the secret must NOT survive into the normalized (stored/displayed) value
  assert.ok(!n.normalizedUrl.includes("abc123"));
  assert.ok(!n.normalizedUrl.toLowerCase().includes("token"));
});

test("normalizeUrl: drops only token params, keeps benign ones", () => {
  const n = normalizeUrl("https://example.com/r?token=SECRET&page=2");
  assert.ok(n);
  assert.ok(!n.normalizedUrl.includes("SECRET"));
  assert.ok(n.normalizedUrl.includes("page=2"));
});

test("normalizeUrl: rejects non-http(s) and junk", () => {
  assert.equal(normalizeUrl("mailto:a@b.com"), null);
  assert.equal(normalizeUrl("not a url"), null);
  assert.equal(normalizeUrl(""), null);
});

test("normalizeDomain: strips www, detects punycode + tld", () => {
  assert.deepEqual(normalizeDomain("www.Foo.Bar.COM"), { domain: "foo.bar.com", tld: "com", isPunycode: false });
  assert.equal(normalizeDomain("xn--80ak6aa92e.com").isPunycode, true);
});
