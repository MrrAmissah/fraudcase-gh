import { test } from "node:test";
import assert from "node:assert/strict";
import { extractIndicators } from "../extractIndicators";

test("extracts url + domain indicators and de-dupes", () => {
  const inds = extractIndicators("Pay at https://gh-post-delivery.xyz/fee and again https://gh-post-delivery.xyz/fee");
  const urls = inds.filter((i) => i.type === "url");
  const domains = inds.filter((i) => i.type === "domain");
  assert.equal(urls.length, 1);
  assert.equal(domains.length, 1);
  assert.equal(domains[0].value, "gh-post-delivery.xyz");
  assert.equal(urls[0].privacyClass, "public");
});

test("token/signed URLs are classed do_not_send_external", () => {
  const inds = extractIndicators("reset here https://example.com/r?token=SECRET123");
  const url = inds.find((i) => i.type === "url");
  assert.ok(url);
  assert.equal(url.privacyClass, "do_not_send_external");
});

test("masked/local phones become internal-only phone indicators", () => {
  const inds = extractIndicators("Contact shown: 0244***019");
  const phone = inds.find((i) => i.type === "phone");
  assert.ok(phone);
  assert.equal(phone.privacyClass, "do_not_send_external");
});

test("plain text with no indicators yields nothing; never throws", () => {
  assert.deepEqual(extractIndicators("just a normal sentence"), []);
  assert.deepEqual(extractIndicators(""), []);
});
