import { auth } from "./client";
import { FraudCase } from "../../types/fraudCase";
import { EvidenceItem } from "../../types/evidence";

/**
 * Utility to fetch a fresh Firebase ID Token and construct Authorization headers.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Authentication session required.");
  }
  // Retrieve token, forcing refresh if expired
  const token = await user.getIdToken(true);
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Retrieve all cases owned by the currently authenticated user.
 */
export async function getCases(): Promise<FraudCase[]> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/cases", { headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to load cases" }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

/**
 * Retrieve a specific case by its unique ID.
 */
export async function getCaseById(id: string): Promise<FraudCase> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/cases/${id}`, { headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to load case details" }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

/**
 * Create a new fraud case, returning the initialized document.
 */
export async function createCase(title: string, description: string, incidentDate?: string): Promise<FraudCase> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify({ title, description, incidentDate }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to create case" }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

/**
 * Add an evidence item to a specific case.
 */
export async function addEvidence(
  caseId: string,
  evidence: Omit<EvidenceItem, "id" | "caseId" | "createdAt">
): Promise<FraudCase> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/cases/${caseId}/evidence`, {
    method: "POST",
    headers,
    body: JSON.stringify(evidence),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to upload evidence" }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

/**
 * Add a file evidence item (multipart upload) to a specific case.
 */
export async function addEvidenceFile(
  caseId: string,
  file: File,
  metadata: {
    type: string;
    title: string;
    originalText?: string;
  }
): Promise<FraudCase> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Authentication session required.");
  }
  const token = await user.getIdToken(true);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", metadata.type);
  formData.append("title", metadata.title);
  if (metadata.originalText) {
    formData.append("originalText", metadata.originalText);
  }

  const response = await fetch(`/api/cases/${caseId}/evidence/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
      // Note: Do NOT set "Content-Type" manually because fetch automatically sets correct boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to upload file attachment." }));
    throw new Error(err.error || response.statusText);
  }

  return response.json();
}

/**
 * Delete a specific evidence item from a case.
 */
export async function deleteEvidence(caseId: string, evidenceId: string): Promise<FraudCase> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/cases/${caseId}/evidence/${evidenceId}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to remove evidence" }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

/**
 * Trigger AI analysis for the evidence in a case.
 */
export async function analyzeCase(caseId: string): Promise<FraudCase> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/cases/${caseId}/analyze`, {
    method: "POST",
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to analyze evidence" }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

/**
 * Delete an entire fraud case.
 */
export async function deleteCase(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/cases/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to delete case" }));
    throw new Error(err.error || response.statusText);
  }
}

/**
 * Update case parameters like its metadata.
 */
export async function updateCase(
  id: string,
  updates: { title?: string; description?: string; incidentDate?: string; status?: string }
): Promise<FraudCase> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/cases/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to update case" }));
    throw new Error(err.error || response.statusText);
  }
  return response.json();
}

/**
 * Seed client database with custom isolated demo cases.
 */
export async function seedDemoCases(): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/cases/seed", {
    method: "POST",
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to load demo cases" }));
    throw new Error(err.error || response.statusText);
  }
}

