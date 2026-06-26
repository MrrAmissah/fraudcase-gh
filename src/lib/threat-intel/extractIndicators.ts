/** Extract reputation indicators (URLs, domains, phones) from already-redacted text. Pure, no network. */
import { ExtractedIndicator } from "./types";
import { normalizeUrl } from "./normalize";

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
// Ghana-style or masked phone (e.g. 0244000019 or 0244***019). Internal-only either way.
const PHONE_RE = /\b0[\d*]{8,11}\b/g;

/**
 * Extract indicators from redacted evidence text / accepted-fact text. URLs with token-like params
 * are flagged `do_not_send_external`; phones are always internal-only (masked and/or PII).
 */
export function extractIndicators(text: string, sourceEvidenceId?: string): ExtractedIndicator[] {
  const out: ExtractedIndicator[] = [];
  const seen = new Set<string>();
  const src = text || "";

  for (const m of src.matchAll(URL_RE)) {
    const n = normalizeUrl(m[0]);
    if (!n) continue;
    const privacyClass = n.hasTokenParams ? "do_not_send_external" : "public";

    if (!seen.has(`url:${n.normalizedUrl}`)) {
      seen.add(`url:${n.normalizedUrl}`);
      out.push({
        type: "url",
        value: n.normalizedUrl,
        normalizedValue: n.normalizedUrl,
        sourceEvidenceId,
        confidence: 0.9,
        privacyClass,
        domain: n.domain,
        tld: n.tld,
      });
    }
    if (n.domain && !seen.has(`domain:${n.domain}`)) {
      seen.add(`domain:${n.domain}`);
      out.push({
        type: "domain",
        value: n.domain,
        normalizedValue: n.domain,
        sourceEvidenceId,
        confidence: 0.9,
        privacyClass,
        domain: n.domain,
        tld: n.tld,
      });
    }
  }

  for (const m of src.matchAll(PHONE_RE)) {
    const val = m[0];
    if (seen.has(`phone:${val}`)) continue;
    seen.add(`phone:${val}`);
    out.push({
      type: "phone",
      value: val,
      normalizedValue: val.replace(/\s+/g, ""),
      sourceEvidenceId,
      confidence: 0.7,
      privacyClass: "do_not_send_external",
    });
  }

  return out;
}
