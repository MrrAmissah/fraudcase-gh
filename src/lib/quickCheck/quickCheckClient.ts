import { QuickCheckResult } from "../../types/quickCheck";

/**
 * Public Quick Check API client. No authentication header is sent — this is the
 * intentional no-sign-up path. The server redacts the submitted text before any AI
 * analysis and persists nothing.
 */
export async function runQuickCheck(text: string): Promise<QuickCheckResult> {
  const response = await fetch("/api/quick-check/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: "Quick Check could not be completed." }));
    throw new Error(err.error || response.statusText);
  }

  return response.json();
}
