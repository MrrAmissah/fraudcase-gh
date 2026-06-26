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

  for (const m of src.matchAll(URL_RE)) {
    const n = normalizeUrl(m[0]);
    if (n) push(n);
  }

  for (const m of src.matchAll(BARE_RE)) {
    const host = m[1];
    const hasPath = Boolean(m[2]);
    const tld = (host.split(".").pop() || "").toLowerCase();
    // Reduce false positives ("Mr.Smith", "file.pdf"): require a path OR a recognized TLD.
    if (!hasPath && !COMMON_TLDS.has(tld)) continue;
    const n = normalizeUrl(m[0]);
    if (n) push(n);
  }

  for (const m of src.matchAll(PHONE_RE)) {
    const val = m[0];
    if (seen.has(`phone:${val}`)) continue;
    seen.add(`phone:${val}`);
    out.push({ type: "phone", value: val, normalizedValue: val.replace(/\s+/g, ""), sourceEvidenceId, confidence: 0.7, privacyClass: "do_not_send_external" });
  }

  return out;
}
