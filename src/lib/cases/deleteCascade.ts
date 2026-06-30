/**
 * Cascade deletion for a case's out-of-document resources.
 *
 * `DELETE /api/cases/:id` historically deleted only the Firestore case document. But:
 *  - Firestore does NOT delete subcollections when a parent doc is deleted, so the case's
 *    `extractionRuns` audit docs survive as orphans.
 *  - The case's evidence files live in Cloud Storage (and a DEV-ONLY local backup), which the doc
 *    delete never touches.
 * Both leak after a "delete" — a data-retention/privacy and storage-cost problem for sensitive
 * fraud evidence. This helper purges those resources, then deletes the doc.
 *
 * Semantics: each storage/subcollection purge is BEST-EFFORT and isolated, so a transient failure is
 * logged (ops' only orphan signal) but never blocks the authoritative case-doc deletion. A transient
 * GCS error therefore still returns success with the doc gone, by design.
 *
 * Ownership MUST be verified by the caller before invoking this — the prefix delete is destructive
 * and unconditional.
 */
import path from "node:path";

export type CascadePurgeEvent = "gcs_purge_failed" | "local_purge_failed" | "extraction_runs_purge_failed";

export interface CascadeDeleteCaseDeps {
  /**
   * The RAW auth uid. MUST be the same uid evidence `storagePath`s are keyed under (the upload route
   * builds them from `req.user.uid`, not a resolved owner id) — otherwise the prefix matches nothing
   * and everything is silently re-orphaned.
   */
  uid: string;
  caseId: string;
  /** Absolute working directory used to locate the DEV-ONLY local backup dir. */
  cwd: string;
  /** Best-effort: delete every stored object under the given prefix (trailing slash included). */
  purgeStoragePrefix(prefix: string): Promise<void>;
  /** Best-effort: recursively remove the local-dev backup dir if it exists. */
  purgeLocalDir(absDir: string): void;
  /** Delete every doc in the case's `extractionRuns` subcollection. */
  purgeExtractionRuns(): Promise<void>;
  /** Authoritative: delete the case document. */
  deleteCaseDoc(): Promise<void>;
  /** Warn-level logger for a best-effort purge failure. */
  onPurgeError(event: CascadePurgeEvent, err: unknown): void;
}

export async function cascadeDeleteCase(deps: CascadeDeleteCaseDeps): Promise<void> {
  // 1. Cloud Storage: the case's isolated evidence folder. The trailing slash is load-bearing —
  //    without it the prefix would also match sibling cases (e.g. `case-12` vs `case-120`). Built as a
  //    literal (GCS object names always use "/"), never via path.join.
  try {
    await deps.purgeStoragePrefix(`users/${deps.uid}/cases/${deps.caseId}/`);
  } catch (err) {
    deps.onPurgeError("gcs_purge_failed", err);
  }

  // 2. DEV-ONLY local backup directory for this case.
  try {
    deps.purgeLocalDir(path.join(deps.cwd, "secure_uploads", deps.uid, deps.caseId));
  } catch (err) {
    deps.onPurgeError("local_purge_failed", err);
  }

  // 3. `extractionRuns` audit subcollection — Firestore does not cascade subcollections on doc delete.
  try {
    await deps.purgeExtractionRuns();
  } catch (err) {
    deps.onPurgeError("extraction_runs_purge_failed", err);
  }

  // 4. The case document itself — authoritative; runs even if a best-effort purge above failed.
  await deps.deleteCaseDoc();
}
