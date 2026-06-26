/**
 * Placeholder provider(s) — declared but NOT implemented; permanently disabled (no flag, no key, no
 * network) until separately approved with a passive-only design.
 *
 *  - urlscan: search EXISTING public scans only; never AUTO-SUBMIT user-derived URLs.
 *
 * (AbuseIPDB is now implemented as a real check-only provider in `abuseIpdbProvider.ts`.)
 */
import { ThreatIntelProvider, unavailableVerdict } from "./providerTypes";

export const urlscanProviderStub: ThreatIntelProvider = {
  name: "urlscan",
  capabilities: { url: true, domain: true, ip: false, hash: false },
  isConfigured: () => false,
  isEnabled: () => false,
  async lookup() {
    return unavailableVerdict("urlscan", "provider not implemented (planned: search existing public scans only; never auto-submit)");
  },
};
