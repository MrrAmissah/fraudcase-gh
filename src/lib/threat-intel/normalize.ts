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

/** Path keywords whose FOLLOWING segment is treated as a secret (e.g. /reset/<token>, /verify/<token>). */
const TOKEN_PATH_KEYWORDS = new Set([
  "reset", "verify", "confirm", "activate", "token", "auth", "invite", "magic",
  "session", "password", "signup", "oauth", "unsubscribe", "login",
]);

/** Heuristic: a path segment that looks like an opaque secret (hex digest or long digit-rich token). */
function looksLikeTokenSegment(seg: string): boolean {
  if (seg.length < 20 || !/^[A-Za-z0-9_-]+$/.test(seg)) return false;
  if (/^[a-f0-9]{20,}$/i.test(seg)) return true; // hex digest
  const digits = (seg.match(/[0-9]/g) || []).length;
  return digits >= 4 && /[A-Za-z]/.test(seg); // mixed alnum with several digits (not a word-slug)
}

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

  // Redact + flag token-bearing PATH segments (signed links / reset tokens), e.g. /reset/SECRET123 or
  // an opaque /a8f3...  Segments after a sensitive keyword, or that look like an opaque token, become ***.
  const rawSegs = u.pathname.split("/");
  let hasTokenPath = false;
  const safeSegs = rawSegs.map((seg, i) => {
    if (!seg) return seg;
    const prev = (rawSegs[i - 1] || "").toLowerCase();
    if (TOKEN_PATH_KEYWORDS.has(prev) || looksLikeTokenSegment(seg)) {
      hasTokenPath = true;
      return "***";
    }
    return seg;
  });
  const path = safeSegs.join("/").replace(/\/+$/, "");
  // A token in the path (not just query) must also keep the URL off external providers.
  const hasSecretMaterial = hasTokenParams || hasTokenPath;
  const normalizedUrl = `${u.protocol}//${host}${path}${qs ? `?${qs}` : ""}`;

  return { normalizedUrl, host, domain, tld, isPunycode, hasTokenParams: hasSecretMaterial };
}
