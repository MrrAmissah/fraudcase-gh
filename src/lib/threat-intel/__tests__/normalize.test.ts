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

test("normalizeUrl: adds scheme to bare host, flags token params", () => {
  const n = normalizeUrl("pay-momo.example.tk/reset?token=abc123");
  assert.ok(n);
  assert.equal(n.domain, "pay-momo.example.tk");
  assert.equal(n.tld, "tk");
  assert.equal(n.hasTokenParams, true);
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
