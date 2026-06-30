# Threat-intel providers — setup & status

Implements part of [`THREAT_INTEL_ENRICHMENT_PLAN.md`](./THREAT_INTEL_ENRICHMENT_PLAN.md). All provider
calls are **server-side only** and **disabled by default**. Provider API keys are **never** exposed to
the frontend or committed.

## Status

| Tier | Provider | Status | Calls | Default |
|---|---|---|---|---|
| 0 | Local heuristics | **Implemented** | none (network-free) | renders when `THREAT_INTEL_ENABLED=true` |
| 2 | Google Web Risk | **Implemented** | passive `GET v1/uris:search` (URL) | off |
| 3 | VirusTotal | **Implemented** | passive `GET /api/v3/{urls,domains,ip_addresses,files}` | off |
| 3 | AbuseIPDB | **Implemented** (check-only) | passive `GET /api/v2/check` (public IPv4) | off |
| 3 | urlscan | **Planned (stub only)** | none yet | off |

## Feature flags & keys (server env)

| Env | Purpose |
|---|---|
| `THREAT_INTEL_ENABLED` | Master switch for the Risk signals feature (panel + enrichment). Default `false`. |
| `THREAT_INTEL_EXTERNAL_LOOKUPS` | Gate for running any external provider at all. Default `false`. |
| `THREAT_INTEL_PROVIDER_TIMEOUT_MS` | Per-provider timeout (default 4000). |
| `THREAT_INTEL_WEB_RISK_ENABLED` + `GOOGLE_WEB_RISK_API_KEY` | Enable + configure Web Risk. |
| `THREAT_INTEL_VIRUSTOTAL_ENABLED` + `VIRUSTOTAL_API_KEY` | Enable + configure VirusTotal. |
| `THREAT_INTEL_ABUSEIPDB_ENABLED` + `ABUSEIPDB_API_KEY` | Planned. Flag/key reserved; not implemented. |
| `THREAT_INTEL_URLSCAN_ENABLED` + `URLSCAN_API_KEY` | Planned. Flag/key reserved; not implemented. |

A provider is **enabled** only when its flag is the literal `true` **and** its key is present. Missing
key ⇒ calm `Unavailable`/`Not checked` status, never an error to the user.

## Privacy invariants (enforced in code)

- Only **accepted/verified** extracted facts feed enrichment (never suggestions, rejected facts, or raw
  evidence/OCR/screenshots/PDFs).
- Indicators carrying tokens/signed-URLs/PII are classed `do_not_send_external` and are **withheld at
  dispatch** — they never reach any external provider.
- Phones/emails are never sent to URL/IP reputation providers.
- VirusTotal uses **GET reports only** — no `POST /urls` (submission) and no `POST /files` (upload).
- urlscan (when built) will **search existing public scans only** — never auto-submit user URLs.
- AbuseIPDB **checks accepted PUBLIC IPv4 only** (private/loopback/link-local/CGNAT/multicast/reserved/documentation ranges are excluded at extraction) via `GET /api/v2/check` — never the report endpoint.

## Wording (required / forbidden)

Required: **Risk signals**, **Local indicator**, **External reputation**, **Possible match**,
**Needs verification**, **Provider reported a match**, **No local indicators detected**,
**No external match returned**, **Not checked**.

Forbidden anywhere in output: **safe**, **clean**, **confirmed fraud**, **confirmed scam**,
**scammer**, **criminal**. A no-match is "not found in this source", **never** "safe". A provider match
**increases risk but is not proof of fraud** and is never an accusation of a person.

## Enabling a provider (with approval)

1. Obtain a key for the provider (server-side).
2. Set the key + its `*_ENABLED=true` flag in the **server** environment (Cloud Run), `THREAT_INTEL_ENABLED=true`, and `THREAT_INTEL_EXTERNAL_LOOKUPS=true`.
3. Do **not** set provider keys in Vercel/frontend env. Changing production env requires explicit approval.
