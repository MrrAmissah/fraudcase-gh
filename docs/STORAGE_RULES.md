# Firebase Cloud Storage — Recommended Security Rules

Companion to `firestore.rules`. Covers the evidence-file bucket used by FraudCase GH.

## Storage layout

Evidence files are stored under a per-user, per-case isolated path (see `server.ts`,
the `/evidence/upload` route):

```
users/{uid}/cases/{caseId}/evidence/{evidenceId}/{fileName}
```

## ⚠️ Current enforcement model — these rules are DORMANT today

Exactly as with `firestore.rules`, **the Express backend uses the Firebase Admin SDK, which
bypasses Storage Security Rules entirely.** All current access is mediated by the server:

- **Upload** (`POST /api/cases/:id/evidence/upload`) — `requireAuth` verifies the Firebase ID
  token, then the handler checks `caseData.ownerId === req.user.uid` before writing.
- **Download** (`GET /api/cases/:id/evidence/:evidenceId/file`) — same token + ownership check;
  the file is streamed back through the server, never via a public/object URL.
- Clients **never** touch Cloud Storage directly.

So today, security rests on the Express layer. The rules below are **recommended and should be
deployed as defense-in-depth**, and they become **load-bearing** the moment any direct-client
Storage access is introduced (e.g. switching to client SDK uploads or signed URLs). Deploy them
now so that path is safe by default.

## Recommended rules

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Per-user evidence files: only the owning user may read/write their own path.
    match /users/{uid}/cases/{caseId}/evidence/{evidenceId}/{fileName} {

      // Read only your own evidence.
      allow read: if request.auth != null
                  && request.auth.uid == uid;

      // Create/update only under your own uid, with size + content-type constraints
      // mirroring the server-side allowlist (10 MB cap; PNG/JPEG/WebP/PDF/TXT/CSV/JSON/HTML).
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches(
                        'image/png|image/jpeg|image/pjpeg|image/webp|application/pdf|text/plain|text/csv|application/json|text/html'
                      );

      // Delete only your own evidence.
      allow delete: if request.auth != null
                    && request.auth.uid == uid;
    }

    // Default deny: nothing else in the bucket is readable or writable by clients.
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Notes
- `request.auth.uid == uid` enforces that the path's user segment matches the caller — the same
  owner-isolation the Express layer enforces.
- Storage rules **cannot** validate file *content* (magic bytes). That check lives server-side in
  `src/lib/security/fileValidation.ts`. The `contentType` constraint here only filters the declared
  MIME, so it is a coarse second gate, not a replacement for server validation.
- Keep the bucket private (no public/`allUsers` access) so the only read path is the authenticated
  server proxy.

### Deploy
```bash
# firebase.json should reference this rules file, e.g. "storage": { "rules": "storage.rules" }
firebase deploy --only storage
```
_(Copy the block above into a `storage.rules` file at the repo root before deploying.)_
