/** URL/domain normalization for threat-intel (pure, no network). */

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "ref", "ref_src", "igshid",
]);

/** Query keys that signal a personal/secret token -> the URL must NOT go to external providers. */
const TOKEN_PARAM_HINTS = [
  "token", "sig", "signature", "auth", "otp", "code", "session", "sessionid",
  "password", "pwd", "access_token", "id_token", "key", "secret", "verify", "reset",
];

export interface NormalizedDomain {
  domain: string;
  tld: string;
  isPunycode: boolean;
}

export function normalizeDomain(host: string): NormalizedDomain {
  const h = (host || "").trim().toLowerCase().replace(/^www\./, "");
  const isPunycode = h.includes("xn--");
  const parts = h.split(".");
  const tld = parts.length > 1 ? parts[parts.length - 1] : "";
  return { domain: h, tld, isPunycode };
}

export interface NormalizedUrl {
  normalizedUrl: string;
  host: string;
  domain: string;
  tld: string;
  isPunycode: boolean;
  hasTokenParams: boolean;
}

/** Parse + normalize a URL (lowercase host, drop tracking params). Returns null if not a valid http(s) URL. */
export function normalizeUrl(raw: string): NormalizedUrl | null {
  const t = (raw || "").trim();
  if (!t) return null;
  let u: URL;
  try {
    // Detect ANY scheme (scheme + ":"), so non-http schemes like mailto: are parsed and then rejected,
    // rather than being treated as a bare host and prefixed with https://.
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(t);
    u = new URL(hasScheme ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const host = u.hostname.toLowerCase();
  const { domain, tld, isPunycode } = normalizeDomain(host);

  const isTokenParam = (key: string): boolean => {
    const kk = key.toLowerCase();
    return TOKEN_PARAM_HINTS.some((hint) => kk.includes(hint));
  };

  let hasTokenParams = false;
  // Drop tracking params AND secret-bearing params, so the normalized value never carries a token.
  // We still flag hasTokenParams so the caller can mark the indicator do_not_send_external.
  const keep = new URLSearchParams();
  for (const [k, v] of u.searchParams) {
    if (isTokenParam(k)) {
      hasTokenParams = true;
      continue;
    }
    if (TRACKING_PARAMS.has(k.toLowerCase())) continue;
    keep.set(k, v);
  }
  const qs = keep.toString();
  const path = u.pathname.replace(/\/+$/, "");
  const normalizedUrl = `${u.protocol}//${host}${path}${qs ? `?${qs}` : ""}`;

  return { normalizedUrl, host, domain, tld, isPunycode, hasTokenParams };
}
