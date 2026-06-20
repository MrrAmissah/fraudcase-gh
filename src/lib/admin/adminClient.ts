import { auth } from "../firebase/client";
import { CommunitySignal, CommunitySignalsResponse, ReviewedStatus } from "../../types/communitySignal";

/** Raised on a 403 so the admin page can render an access-denied state. */
export class AdminAccessError extends Error {}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Authentication session required.");
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Capability probe — returns whether the signed-in user is an admin. Non-fatal:
 * returns false on any error so it can never break the rest of app startup.
 */
export async function getAdminStatus(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    const token = await user.getIdToken();
    const res = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.isAdmin;
  } catch {
    return false;
  }
}

export async function listCommunitySignals(params: { status?: string } = {}): Promise<CommunitySignalsResponse> {
  const headers = await authHeaders();
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  const query = qs.toString();
  const res = await fetch(`/api/admin/community-signals${query ? `?${query}` : ""}`, { headers });
  if (res.status === 403) throw new AdminAccessError("Admin access required.");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to load community signals." }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function updateCommunitySignal(
  id: string,
  updates: { reviewedStatus?: ReviewedStatus; adminNote?: string; clusterId?: string | null }
): Promise<CommunitySignal> {
  const headers = await authHeaders();
  const res = await fetch(`/api/admin/community-signals/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });
  if (res.status === 403) throw new AdminAccessError("Admin access required.");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update signal." }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}
