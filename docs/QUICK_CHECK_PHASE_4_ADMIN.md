# Quick Check Phase 4 — Admin Community Signals Dashboard

Admin-only review of redacted community signals (from Phase 3). Signals are **possible
patterns**, not accusations — the UI uses careful, non-accusatory language throughout.

## Admin auth model
- `requireAdmin` (server middleware): verifies the Firebase ID token, reads the decoded email,
  and checks it against the `ADMIN_EMAILS` allowlist.
  - No / invalid token → **401**.
  - Valid token, email **not** allowlisted → **403**.
- **Fail-closed**: if `ADMIN_EMAILS` is empty/unset, the allowlist is empty → every signed-in user
  gets 403 → the dashboard is inaccessible by default.
- The server enforces access. Hiding the nav link is **cosmetic only** — `GET /api/admin/me`
  returns `{ isAdmin }` so the client can show/hide the "Signals" link without leaking the
  allowlist, and the page itself renders an access-denied state if the data fetch returns 403.

### `ADMIN_EMAILS` setup
```
# .env  (comma-separated, case-insensitive)
ADMIN_EMAILS="you@example.com,admin@example.com"
```
Added to `.env.example`. Restart the server after changing it.

## Routes
| Method | Path | Guard | Purpose |
|--------|------|-------|---------|
| GET | `/api/admin/me` | `requireAuth` | `{ isAdmin }` for the signed-in user |
| GET | `/api/admin/community-signals` | `requireAdmin` | stats + filtered/sorted signal list |
| PATCH | `/api/admin/community-signals/:id` | `requireAdmin` | update `reviewedStatus` / `adminNote` / `clusterId` |

- **GET** query params (optional): `status`, `category`, `minRiskScore`, `limit` (≤500). Filtering,
  sorting (newest first), and stats are computed **in memory** to avoid composite indexes — fine for
  MVP volume; move to aggregation/pagination at scale.
- **PATCH** accepts only `reviewedStatus` (`pending|reviewed|false_positive|useful`), `adminNote`
  (capped at 1000 chars and **re-redacted** on save — so an identifier typed into a note is masked),
  and `clusterId`. `redactedText` is **never** accepted; **no deletes** in this phase.

## UI behavior
- View-state route `admin_signals` (this app has no URL router; there is no literal
  `/admin/community-signals` URL). The "Signals" nav link appears **only** for admins.
- `AdminSignalsPage`: stats cards (total / pending / useful / reviewed / false positive /
  high-risk ≥50), a status filter, a recent-signals table, and a detail drawer.
- `AdminSignalTable` columns: date, category, risk, confidence, masked sender/domain, top
  indicator, status, view.
- `AdminSignalDetailDrawer`: redacted text, possible fraud indicators, extracted entities, a
  privacy reminder, review-status controls, and an admin-note field. `recommendedNextSteps`
  renders only if present (Phase 3 does not store it today).
- High-risk threshold = **riskScore ≥ 50**, aligned with `getRiskLevel`'s "High" boundary.

## Privacy boundaries
- The dashboard shows a standing reminder: *"These are redacted community signals, not official
  reports or confirmed fraud cases."*
- Never displayed: raw phone numbers, full emails, card/bank numbers, PINs/secrets, raw files, or
  private case data. Signals are already redacted at write time (Phase 3) and the admin note is
  re-redacted on save.
- `communitySignals` remains **server-only**: `firestore.rules` denies all client read/write, and
  the Admin SDK (which bypasses rules) is the only accessor. Normal users cannot call the admin API
  (403) and cannot read the collection directly (rules deny).

## Verification (local)
- `npm run lint`, `npm run build` — pass.
- No-token requests to all three admin routes → **401** (also proves the routes are registered
  ahead of the SPA catch-all).
- Not runtime-testable here (no Firebase credentials / no real ID token), exactly like the existing
  private `/api/cases` routes: the `403` (valid non-admin token) and authorized `200`/PATCH paths
  (admin token + ADC for the Firestore read/write).

## Remaining production hardening
- Replace the email allowlist with real custom-claim roles (`admin: true`) once a role system
  exists; `ADMIN_EMAILS` is an interim control.
- App Check / rate limiting on admin routes; audit logging of review actions.
- Move stats/list to Firestore aggregation + server-side pagination at scale.
- Clustering: populate `clusterId`, derive `normalizedSender`, add repeated-domain/sender views.
