# Gemini Quota and Billing Controls

**Status:** Sprint 1 documentation · Sprint 2 alerting  
**Parent:** [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md)

Gemini powers Quick Check analysis and (Sprint 3+) private multimodal extraction. Uncontrolled access is a **cost and availability risk**.

---

## Cost surfaces

| Route | Model use | Relative cost |
|---|---|---|
| `POST /api/quick-check/analyze` | Text generation | Medium (public, high volume) |
| `POST /api/quick-check/analyze-file` | Multimodal (when enabled) | High |
| `POST /api/cases/:id/analyze` | Text case analysis | Medium |
| `POST /api/cases/:id/evidence/:evidenceId/extract` | Image/PDF multimodal extraction (private, consent-gated, behind `MULTIMODAL_EXTRACTION_ENABLED`) | High |

Mitigations stack: **rate limits → App Check → quotas → billing alerts → circuit breaker**.

---

## Google Cloud billing alerts

1. Open [Google Cloud Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets).
2. Create budget for the Firebase/GCP project linked to Gemini.
3. Set thresholds: **50%, 80%, 100%** of monthly budget.
4. Notification channels: email + Slack/PagerDuty for ops.
5. **Note:** Budget alerts notify but do **not** hard-stop API calls — pair with quotas and rate limits.

---

## Gemini API quotas

1. Google AI Studio / Cloud Console → API quotas for Generative Language API.
2. Set conservative daily request quotas during launch.
3. Monitor 429 responses in application logs.
4. Document quota increase request process for traffic growth.

Suggested starting caps (tune per traffic):

| Operation | Daily quota (launch) |
|---|---|
| Public Quick Check analyze | 5,000 requests |
| Private case analyze | 2,000 requests |
| Multimodal extract | 500 requests |

---

## Application-level controls

Already in code:

- Heuristic fallback when `GEMINI_API_KEY` unset or model errors
- Public rate limits (in-memory; shared store Sprint 2)

Add in Sprint 2:

```typescript
// Pseudocode — circuit breaker on repeated Gemini failures
if (geminiFailureStreak > 10) {
  return heuristicFallback("AI temporarily unavailable");
}
```

Log structured events (no content):

```json
{ "event": "gemini_request", "route": "/api/quick-check/analyze", "latencyMs": 1200, "status": "ok" }
```

---

## Environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-only; from Secret Manager in prod |
| `GEMINI_MODEL` | Optional override (default `gemini-3.5-flash`) |
| `GEMINI_MAX_DAILY_REQUESTS` | Optional app-level cap (Sprint 2) |
| `GEMINI_ANALYSIS_TIMEOUT_MS` | Optional per-call analysis timeout (ms); default 15000; slow Gemini falls back to the heuristic |
| `MULTIMODAL_EXTRACTION_ENABLED` | Master switch for private image/PDF extraction (Sprint 3). Default off; only `true` enables. |
| `MULTIMODAL_EXTRACTION_TIMEOUT_MS` | Optional per-call extraction timeout (ms); default 30000 |

Never expose `GEMINI_API_KEY` to the client.

---

## Monitoring checklist

- [ ] Billing budget alerts configured
- [ ] Gemini quota limits set
- [ ] Dashboard: requests/min by route
- [ ] Alert: 429 rate > threshold
- [ ] Alert: analyze latency p95 > 10s
- [ ] Weekly review of Gemini spend vs Quick Check volume

---

## Incident runbook (cost spike)

1. Check rate limit hit metrics and App Check failure rate.
2. Temporarily lower public daily caps in Redis/WAF.
3. Set `APP_CHECK_ENFORCE=true` if not already.
4. Disable public file analyze route via feature flag if abused.
5. Review GCP billing breakdown for Generative Language API.
6. Post-incident: adjust limits, add CAPTCHA if bot pattern.

---

## Sprint 1 deliverable

Documentation complete. Alert configuration is operator action in GCP console (Sprint 2 verification).

---

_Last updated: 2026-06-21_
