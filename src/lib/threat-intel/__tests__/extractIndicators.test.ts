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

test("token/signed URLs are do_not_send_external AND never carry the secret in the value", () => {
  const inds = extractIndicators("reset here https://example.com/r?token=SECRET123");
  const url = inds.find((i) => i.type === "url");
  assert.ok(url);
  assert.equal(url.privacyClass, "do_not_send_external");
  assert.ok(!url.value.includes("SECRET123"), "token value must not be stored/displayed");
  assert.ok(!url.normalizedValue.includes("SECRET123"));
});

test("extracts bare domains (with a path or a recognized TLD)", () => {
  const inds = extractIndicators("Pay at gh-post-delivery.xyz/fee and visit example.com today");
  const domains = inds.filter((i) => i.type === "domain").map((d) => d.value);
  assert.ok(domains.includes("gh-post-delivery.xyz"));
  assert.ok(domains.includes("example.com"));
});

test("does not extract amounts / filenames / names as domains", () => {
  const inds = extractIndicators("Received GHS 12.50, see report.pdf from Mr.Smith");
  assert.equal(inds.filter((i) => i.type === "domain").length, 0);
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
