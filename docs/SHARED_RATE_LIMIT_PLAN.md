# Shared rate limiting

Referenced from `src/lib/security/rateLimit.ts`. This document was cited by that code for a while
before it existed; it now describes what is implemented.

## The problem

`/api/quick-check/analyze`, `/api/quick-check/analyze-file`, and `/api/quick-check/submit-signal`
are public and unauthenticated, and the first two each bill a Gemini call. They are protected by
per-IP caps in `server.ts`:

| Limiter | Cap |
|---|---|
| `qc_analyze` daily | 15 per IP per UTC day |
| `qc_analyze_burst` | 5 per 5 minutes |
| `qc_file_burst` | 3 per 5 minutes |
| `signal` daily | 10 per IP per UTC day |
| `signal_burst` | 5 per 10 minutes |

Those caps were enforced by an in-memory `Map` **per process**. Production runs Cloud Run with
`autoscaling.knative.dev/maxScale=20` and no session affinity, so consecutive requests from one
caller can land on different instances, each holding its own counter. The effective ceiling was
therefore up to roughly **20x** the configured cap, and no configuration made it otherwise:
`RATE_LIMIT_REDIS_URL` was an env name with no implementation behind it, which logged a warning and
silently fell back to memory.

Store failures also failed **open**, so any limiter error became an unmetered allowance.

## What is implemented

`FirestoreRateLimitStore` (`src/lib/security/firestoreRateLimitStore.ts`) satisfies the existing
`RateLimitStore` interface using a transactional counter document per key and window.

**Why Firestore rather than Redis or Upstash.** Firestore is already provisioned, already a
dependency, already reachable with the runtime service account's existing permissions, and needs no
new service to run, secure, pay for, or rotate credentials against. At these caps the cost is
negligible: a Quick Check performs two transactions (burst plus daily), so roughly two reads and two
writes.

**Windows are identical to the in-memory store.** Daily is a UTC calendar day, with the day baked
into the document id so a new day is simply a new document and no reset logic is needed. Burst is a
fixed window measured from the first hit, not a rolling one, matching the previous semantics exactly.
Blocked hits do not increment the counter.

**Selection is explicit.** `createRateLimitStore` returns the in-memory store unless
`RATE_LIMIT_STORE=firestore`, and additionally requires `RATE_LIMIT_HASH_SALT`. Any missing
precondition logs the reason and falls back to memory, so a misconfiguration degrades to the old
behavior rather than crashing the server or persisting weak hashes.

## Privacy

Limiter keys are `namespace:ip`. This application deliberately keeps IP addresses **in memory only**,
so persisting them to Firestore would introduce a new class of stored personal data.

Document ids are therefore an HMAC-SHA256 of the key under a server-side salt, truncated to 128 bits.
A plain SHA-256 would not be sufficient: the entire IPv4 address space is small enough to enumerate
exhaustively, so unsalted digests of IP addresses are reversible in minutes. Without a salt of at
least 16 characters the store refuses to construct, and the factory falls back to memory.

Stored fields are `count`, `window` or `windowStart`, and `expiresAt`. Nothing caller-derived is
persisted, and `firestoreRateLimitStore.test.ts` asserts that neither the raw IP nor the raw limiter
key appears in any document id or written field.

`firestore.rules` denies client access to `rateLimits` explicitly. The Admin SDK bypasses rules, so
this is defense in depth: a client that could write there would lift its own caps.

## Failure policy

A store outage is **not** the same condition as being over the limit, and the two are no longer
conflated:

| Condition | Response |
|---|---|
| Over the configured cap | `429` with the limiter's over-limit message |
| Store threw (transaction failure, Firestore unavailable) | `503` with a distinct "temporarily unavailable" message |

Public limiters default to `failMode: "closed"`. For endpoints that bill a model call, briefly
refusing requests is strictly better than serving an unmetered allowance. `failMode: "open"` remains
available for routes where availability outweighs metering. Every store error logs
`rate_limit_store_error` with the limiter namespace and the applied policy, so quota pressure and
infrastructure trouble are separable in logs.

## Enabling it in production

1. Generate a salt and store it in Secret Manager (never in an env file, never in a build arg):

   ```
   openssl rand -hex 32 | gcloud secrets create RATE_LIMIT_HASH_SALT --data-file=-
   gcloud secrets add-iam-policy-binding RATE_LIMIT_HASH_SALT \
     --member=serviceAccount:fraudcase-prod-run@stellar-perigee-498907-c4.iam.gserviceaccount.com \
     --role=roles/secretmanager.secretAccessor
   ```

   Changing the salt later invalidates every existing counter, which hands out one fresh allowance
   per caller. Rotate deliberately, ideally right after a UTC day boundary.

2. Configure the service:

   ```
   gcloud run services update fraudcase-prod --region europe-west1 \
     --project stellar-perigee-498907-c4 \
     --update-env-vars RATE_LIMIT_STORE=firestore \
     --update-secrets RATE_LIMIT_HASH_SALT=RATE_LIMIT_HASH_SALT:latest
   ```

3. Enable the TTL policy so counters are reaped. Without it the collection grows without bound;
   correctness is unaffected, since every window is keyed:

   ```
   gcloud firestore fields ttls update expiresAt \
     --collection-group=rateLimits \
     --enable-ttl \
     --database=ai-studio-36d6feb3-b3c2-4e2a-9c6b-46c7b67a02e9 \
     --project=stellar-perigee-498907-c4
   ```

4. Confirm it took effect. Look for `rate_limit_store_firestore_enabled` in the logs, then exceed a
   burst cap deliberately and confirm a `429` arrives on roughly the 6th rapid call rather than
   after 20 instances' worth:

   ```
   for i in $(seq 1 8); do
     curl -s -o /dev/null -w "%{http_code}\n" -X POST \
       https://fraudcase-prod-583548147736.europe-west1.run.app/api/quick-check/analyze \
       -H 'Content-Type: application/json' -d '{"text":"rate limit probe"}'
   done
   ```

   Note this probe bills a Gemini call per allowed request, so keep the loop short.

Rollback is `--remove-env-vars RATE_LIMIT_STORE`, which reverts to in-memory limiting without a
redeploy of the image.

## Known limits

- **Per-IP, not per-person.** Callers behind one NAT or mobile carrier gateway share a bucket, and a
  caller with many addresses gets many buckets. Only authentication or attestation fixes that, which
  is what App Check and CAPTCHA enforcement are for (`docs/APP_CHECK_IMPLEMENTATION_PLAN.md`). The
  shared limiter is a floor, not a complete abuse defense.
- **Contention.** A single caller hammering one key serializes transactions on one document.
  Firestore retries and then throws, which under the fail-closed default surfaces as `503` to a
  caller who is over their cap anyway.
- **`X-Forwarded-For` trust.** `getClientIp` only honors the header when `TRUST_PROXY=true`
  (set in production, where Cloud Run fronts the service). Enabling it anywhere the app is directly
  reachable would make the client IP spoofable and every per-IP cap trivially bypassable.
