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

test("path-token / signed-link URLs are do_not_send_external (not just query tokens)", () => {
  const inds = extractIndicators("reset here https://example.com/reset/SECRET123 now");
  const url = inds.find((i) => i.type === "url");
  assert.ok(url);
  assert.equal(url.privacyClass, "do_not_send_external");
  assert.ok(!url.value.includes("SECRET123"));
});

test("masked/local phones become internal-only phone indicators", () => {
  const inds = extractIndicators("Contact shown: 0244***019");
  const phone = inds.find((i) => i.type === "phone");
  assert.ok(phone);
  assert.equal(phone.privacyClass, "do_not_send_external");
});

test("extracts only routable PUBLIC IPv4; excludes private/reserved/doc/malformed", () => {
  const text =
    "Hits from 8.8.8.8 and 1.1.1.1; ignore 10.0.0.5, 192.168.1.1, 127.0.0.1, 169.254.1.1, " +
    "172.16.5.5, 100.64.0.1, 224.0.0.1, 192.0.2.7, 198.51.100.9, 203.0.113.5, 999.1.1.1, 1.2.03.4";
  const ips = extractIndicators(text).filter((i) => i.type === "ip").map((i) => i.value);
  assert.deepEqual(ips, ["8.8.8.8", "1.1.1.1"]);
});

test("public IP indicators are privacyClass public (eligible for IP reputation)", () => {
  const ip = extractIndicators("connect to 1.1.1.1").find((i) => i.type === "ip");
  assert.ok(ip);
  assert.equal(ip.privacyClass, "public");
});

test("IP-shaped token inside a do_not_send_external URL is NOT re-emitted as a public IP", () => {
  const inds = extractIndicators("reset https://example.com/r?token=8.8.8.8 now");
  assert.equal(inds.filter((i) => i.type === "ip").length, 0, "token value must not leak as an IP");
  assert.equal(inds.find((i) => i.type === "url")?.privacyClass, "do_not_send_external");
});

test("IP-shaped value in a do_not_send_external PATH token (no query) is NOT re-emitted as a public IP", () => {
  // /reset/<seg> is a signed-link path; the IP-shaped segment must not leak even with no token query param.
  const inds = extractIndicators("open https://example.com/reset/8.8.8.8 to continue");
  assert.equal(inds.filter((i) => i.type === "ip").length, 0, "path-token value must not leak as an IP");
  assert.equal(inds.find((i) => i.type === "url")?.privacyClass, "do_not_send_external");
});

test("benchmarking range 198.18.0.0/15 is excluded from public IPs", () => {
  const ips = extractIndicators("hosts 198.18.0.1 and 198.19.255.254 and 8.8.4.4")
    .filter((i) => i.type === "ip")
    .map((i) => i.value);
  assert.deepEqual(ips, ["8.8.4.4"]);
});

test("plain text with no indicators yields nothing; never throws", () => {
  assert.deepEqual(extractIndicators("just a normal sentence"), []);
  assert.deepEqual(extractIndicators(""), []);
});
