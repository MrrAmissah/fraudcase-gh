/** Extract reputation indicators (URLs, domains, phones) from already-redacted text. Pure, no network. */
import { ExtractedIndicator } from "./types";
import { normalizeUrl, NormalizedUrl } from "./normalize";

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
/** Bare `host.tld(/path)` without a scheme. Lookbehind avoids emails (a@b.com) and mid-token matches. */
const BARE_RE = /(?<![\w@.])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(\/[^\s<>"')\]]*)?/gi;
/** Ghana-style or masked phone (e.g. 0244000019 or 0244***019). Internal-only either way. */
const PHONE_RE = /\b0[\d*]{8,11}\b/g;

/** Recognized TLDs — a bare domain without a path is only accepted if its TLD is here (cuts false positives). */
const COMMON_TLDS = new Set([
  "com", "net", "org", "io", "app", "co", "info", "biz", "xyz", "tk", "ml", "ga", "cf", "gq",
  "top", "click", "link", "gh", "ng", "africa", "site", "online", "store", "shop", "live", "sbs", "cfd", "gov",
]);

/** IPv4 not surrounded by other digits/dots (so it isn't a sub-match of a longer dotted number). */
const IP_RE = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g;

/**
 * True only for routable PUBLIC IPv4. Excludes malformed octets, private (10/8, 172.16/12, 192.168/16),
 * loopback (127/8), link-local (169.254/16), CGNAT (100.64/10), multicast/reserved (>=224), "this
 * network" (0/8), and documentation ranges (192.0.2/24, 198.51.100/24, 203.0.113/24, 192.0.0/24).
 */
export function isPublicIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  const o: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || (p.length > 1 && p[0] === "0")) return false; // malformed / leading zero
    const n = Number(p);
    if (n > 255) return false;
    o.push(n);
  }
  const [a, b, c] = o;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a >= 224) return false; // multicast (224-239) + reserved (>=240)
  if (a === 198 && (b === 18 || b === 19)) return false; // 198.18.0.0/15 benchmarking
  if (a === 192 && b === 0 && (c === 2 || c === 0)) return false; // 192.0.2/24 doc, 192.0.0/24 IETF
  if (a === 198 && b === 51 && c === 100) return false; // 198.51.100/24 doc
  if (a === 203 && b === 0 && c === 113) return false; // 203.0.113/24 doc
  return true;
}

export function extractIndicators(text: string, sourceEvidenceId?: string): ExtractedIndicator[] {
  const out: ExtractedIndicator[] = [];
  const seen = new Set<string>();
  const src = text || "";

  const push = (n: NormalizedUrl) => {
    const privacyClass = n.hasTokenParams ? "do_not_send_external" : "public";
    if (!seen.has(`url:${n.normalizedUrl}`)) {
      seen.add(`url:${n.normalizedUrl}`);
      out.push({ type: "url", value: n.normalizedUrl, normalizedValue: n.normalizedUrl, sourceEvidenceId, confidence: 0.9, privacyClass, domain: n.domain, tld: n.tld });
    }
    if (n.domain && !seen.has(`domain:${n.domain}`)) {
      seen.add(`domain:${n.domain}`);
      out.push({ type: "domain", value: n.domain, normalizedValue: n.domain, sourceEvidenceId, confidence: 0.9, privacyClass, domain: n.domain, tld: n.tld });
    }
  };

  // Char spans of token-bearing (do_not_send_external) URLs, so an IP-shaped token value inside one
  // (e.g. ?token=8.8.8.8) is not re-emitted as a separate public IP and leaked to a provider.
  const dnseSpans: Array<[number, number]> = [];
  const record = (m: RegExpMatchArray, n: NormalizedUrl) => {
    if (n.hasTokenParams && typeof m.index === "number") dnseSpans.push([m.index, m.index + m[0].length]);
    push(n);
  };

  for (const m of src.matchAll(URL_RE)) {
    const n = normalizeUrl(m[0]);
    if (n) record(m, n);
  }

  for (const m of src.matchAll(BARE_RE)) {
    const host = m[1];
    const hasPath = Boolean(m[2]);
    const tld = (host.split(".").pop() || "").toLowerCase();
    // Reduce false positives ("Mr.Smith", "file.pdf"): require a path OR a recognized TLD.
    if (!hasPath && !COMMON_TLDS.has(tld)) continue;
    const n = normalizeUrl(m[0]);
    if (n) record(m, n);
  }

  for (const m of src.matchAll(IP_RE)) {
    const ip = m[0];
    const idx = typeof m.index === "number" ? m.index : -1;
    const insideSecretUrl = idx >= 0 && dnseSpans.some(([s, e]) => idx >= s && idx < e);
    // Only routable public IPs are eligible; exclude private/reserved/doc/malformed and IPs that sit
    // inside a do_not_send_external URL (token/signed-link values).
    if (insideSecretUrl || !isPublicIPv4(ip) || seen.has(`ip:${ip}`)) continue;
    seen.add(`ip:${ip}`);
    out.push({ type: "ip", value: ip, normalizedValue: ip, sourceEvidenceId, confidence: 0.8, privacyClass: "public" });
  }

  for (const m of src.matchAll(PHONE_RE)) {
    const val = m[0];
    if (seen.has(`phone:${val}`)) continue;
    seen.add(`phone:${val}`);
    out.push({ type: "phone", value: val, normalizedValue: val.replace(/\s+/g, ""), sourceEvidenceId, confidence: 0.7, privacyClass: "do_not_send_external" });
  }

  return out;
}
