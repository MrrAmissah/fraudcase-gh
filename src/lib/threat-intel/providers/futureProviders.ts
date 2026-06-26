/**
 * Placeholder providers — declared but NOT implemented. They carry capability metadata and stay
 * permanently disabled (no flag, no key path, no network). Each requires separate approval and a
 * passive-only design before any implementation:
 *
 *  - AbuseIPDB: check ACCEPTED public IPs only; never REPORT an IP.
 *  - urlscan: search EXISTING public scans only; never AUTO-SUBMIT user-derived URLs.
 *
 * No private evidence is ever submitted to either.
 */
import { ThreatIntelProvider, unavailableVerdict } from "./providerTypes";

export const abuseIpdbProviderStub: ThreatIntelProvider = {
  name: "abuseipdb",
  capabilities: { url: false, domain: false, ip: true, hash: false },
  isConfigured: () => false,
  isEnabled: () => false,
  async lookup() {
    return unavailableVerdict("abuseipdb", "provider not implemented (planned: check accepted public IPs only; never report)");
  },
};

export const urlscanProviderStub: ThreatIntelProvider = {
  name: "urlscan",
  capabilities: { url: true, domain: true, ip: false, hash: false },
  isConfigured: () => false,
  isEnabled: () => false,
  async lookup() {
    return unavailableVerdict("urlscan", "provider not implemented (planned: search existing public scans only; never auto-submit)");
  },
};
