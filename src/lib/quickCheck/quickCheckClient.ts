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

/**
 * Submit a redacted Quick Check result as an anonymous community signal. No auth.
 * Sends only the already-redacted result; the server re-verifies redaction and stores
 * masked/derived data only.
 */
export async function submitQuickCheckSignal(result: QuickCheckResult): Promise<void> {
  const response = await fetch("/api/quick-check/submit-signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consentGiven: true, result }),
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: "Could not submit the signal." }));
    throw new Error(err.error || response.statusText);
  }
}
