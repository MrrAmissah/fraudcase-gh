import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import QuickCheckHero from "../components/QuickCheckHero";
import QuickCheckInputPanel from "../components/QuickCheckInputPanel";
import QuickCheckResultCard from "../components/QuickCheckResultCard";
import { runQuickCheck, submitQuickCheckSignal } from "../lib/quickCheck/quickCheckClient";
import { QuickCheckResult } from "../types/quickCheck";

interface QuickCheckPageProps {
  isAuthenticated: boolean;
  /** Persists the redacted result as a private case (signed in) or stashes it for after sign-in. */
  onSaveAsCase: (result: QuickCheckResult) => Promise<void>;
  onBackToLanding: () => void;
}

/**
 * Public, no-sign-up Quick Check flow: Input → Analyze → Result. Renders without an
 * authenticated user (mounted before the auth gate in App.tsx). Nothing anonymous is persisted.
 */
export default function QuickCheckPage({
  isAuthenticated,
  onSaveAsCase,
  onBackToLanding,
}: QuickCheckPageProps) {
  const [result, setResult] = useState<QuickCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAnalyze = async (text: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await runQuickCheck(text);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Quick Check failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveAsCase(result);
      // On success the app navigates away (to the new case or to sign-in); no further UI needed.
    } catch (err: any) {
      setSaveError(err?.message || "We couldn't save this as a case just now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Submits the redacted result as an anonymous community signal. Throws on failure so the
  // result card can show a calm error and keep the consent panel open for retry.
  const handleShareSignal = async () => {
    if (!result) return;
    await submitQuickCheckSignal(result);
  };

  const handleNewCheck = () => {
    setResult(null);
    setError(null);
    setSaveError(null);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 py-4" id="quick-check-page">
      <button
        onClick={onBackToLanding}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-sans cursor-pointer"
      >
        <ArrowLeft size={14} />
        Back to home
      </button>

      {!result ? (
        <>
          <QuickCheckHero />
          <QuickCheckInputPanel onAnalyze={handleAnalyze} isLoading={isLoading} error={error} />
        </>
      ) : (
        <QuickCheckResultCard
          result={result}
          isAuthenticated={isAuthenticated}
          isSaving={isSaving}
          saveError={saveError}
          onSave={handleSave}
          onNewCheck={handleNewCheck}
          onShareSignal={handleShareSignal}
        />
      )}
    </div>
  );
}
