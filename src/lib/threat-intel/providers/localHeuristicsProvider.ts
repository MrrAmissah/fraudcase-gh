/** Tier 0 local heuristics for URL/domain indicators. No network. Returns a non-accusatory verdict. */
import { ExtractedIndicator, ProviderVerdict } from "../types";

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rb.gy", "rebrand.ly",
]);

const SUSPICIOUS_TLDS = new Set([
  "zip", "mov", "top", "xyz", "tk", "ml", "ga", "cf", "gq", "work", "click", "link", "country", "kim", "quest",
]);

/** Brand keywords commonly impersonated in Ghana scams. */
const BRAND_HINTS = [
  "ghanapost", "ghpost", "mtn", "telecel", "vodafone", "airteltigo", "ecobank", "gcb",
  "fidelity", "absa", "stanbic", "momo", "mobilemoney", "dhl", "fedex", "ups",
];

/** Known-legitimate registrable domains (allowlist) so official sites aren't flagged as lookalikes. */
const OFFICIAL_DOMAINS = [
  "mtn.com.gh", "telecel.com.gh", "airteltigo.com.gh", "ecobank.com", "gcbbank.com.gh",
  "fidelitybank.com.gh", "absa.com.gh", "stanbicbank.com.gh", "ghanapost.com.gh",
  "dhl.com", "fedex.com", "ups.com", "bog.gov.gh", "csa.gov.gh",
];

function isOfficial(domain: string): boolean {
  return OFFICIAL_DOMAINS.some((o) => domain === o || domain.endsWith(`.${o}`));
}

/** Returns a verdict for url/domain indicators; null for types this provider doesn't handle (e.g. phone). */
export function localHeuristicsVerdict(
  ind: ExtractedIndicator,
  nowIso: () => string = () => new Date().toISOString(),
): ProviderVerdict | null {
  if (ind.type !== "url" && ind.type !== "domain") return null;
  const domain = (ind.domain || ind.normalizedValue || "").toLowerCase();
  const checkedAt = nowIso();

  if (isOfficial(domain)) {
    return {
      provider: "local_heuristics",
      checkedAt,
      status: "no_match",
      category: "benign",
      confidence: 0.1,
      rawScoreSummary: "matches a known-legitimate domain allowlist",
      cacheTtlSeconds: 86400,
    };
  }

  const reasons: string[] = [];
  if (SHORTENERS.has(domain)) reasons.push("URL shortener hides the real destination");
  if (ind.tld && SUSPICIOUS_TLDS.has(ind.tld)) reasons.push(`high-abuse TLD .${ind.tld}`);
  if (domain.includes("xn--")) reasons.push("punycode/homograph domain");
  if ((domain.match(/-/g) || []).length >= 3) reasons.push("many hyphens (common in lookalike domains)");
  for (const b of BRAND_HINTS) {
    if (domain.includes(b)) {
      reasons.push(`mentions brand "${b}" in a non-official domain`);
      break;
    }
  }

  if (reasons.length === 0) {
    return {
      provider: "local_heuristics",
      checkedAt,
      status: "no_match",
      category: "unknown",
      confidence: 0.2,
      rawScoreSummary: "no local heuristic flags",
      cacheTtlSeconds: 3600,
    };
  }

  return {
    provider: "local_heuristics",
    checkedAt,
    status: "match",
    category: "suspicious",
    confidence: Math.min(0.75, 0.3 + reasons.length * 0.15),
    rawScoreSummary: reasons.join("; "),
    cacheTtlSeconds: 3600,
  };
}
