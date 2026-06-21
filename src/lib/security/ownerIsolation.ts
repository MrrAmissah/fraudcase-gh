/**
 * Owner isolation helpers — single source of truth for case ownership checks
 * and safe case update field whitelisting. Used by server.ts and regression tests.
 */

export const CASE_UPDATE_ALLOWED_FIELDS = [
  "status",
  "title",
  "description",
  "incidentDate",
] as const;

export type CaseUpdateField = (typeof CASE_UPDATE_ALLOWED_FIELDS)[number];

/** Returns true when the authenticated user owns the case document. */
export function isCaseOwner(
  caseData: { ownerId?: string } | null | undefined,
  authenticatedUid: string
): boolean {
  if (!caseData?.ownerId || !authenticatedUid) return false;
  return caseData.ownerId === authenticatedUid;
}

/**
 * Builds a Firestore-safe update payload from client input.
 * ownerId and other sensitive fields are never copied from the request body.
 */
export function buildCaseUpdatePayload(body: Record<string, unknown>): {
  updates: Partial<Record<CaseUpdateField, unknown>>;
  updatedAt: string;
} {
  const updates: Partial<Record<CaseUpdateField, unknown>> = {};

  for (const field of CASE_UPDATE_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = body[field];
    }
  }

  return {
    updates,
    updatedAt: new Date().toISOString(),
  };
}

/** ownerId must always come from the verified token, never from client-supplied case data on create. */
export function resolveOwnerIdFromToken(authenticatedUid: string): string {
  if (!authenticatedUid || typeof authenticatedUid !== "string") {
    throw new Error("Authenticated UID is required to assign case ownership.");
  }
  return authenticatedUid;
}
